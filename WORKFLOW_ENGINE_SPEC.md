# Workflow Engine Specification

This specification defines a purely configuration-driven state machine for the FMS. No workflow routing, checklist requirement, or TAT logic should be hardcoded in the SolidJS frontend. The UI simply renders state and forms dynamically based on this engine.

---

## 1. Logical Models

To support dynamic routing, dependencies, and SLAs, the engine requires the following relational models:

### Definition Models (The Template)
- **`workflow_definitions`**: The overarching process template (e.g., "Standard FMS v1"). Contains a name, version, and active status.
- **`workflow_stages`**: The major milestones within a definition (e.g., "PI Maker", "Admin Approval", "Dispatch"). Contains a name, base TAT hours, and responsible role ID.
- **`workflow_steps`**: Sub-actions required to complete a stage (e.g., "Gatepass Upload", "Verify Vehicle"). Acts as the template for checklists and document requirements.
- **`workflow_dependencies`**: Defines cross-stage prerequisites. E.g., Stage ID "Dispatch" depends on Stage ID "RC & Vehicle".
- **`workflow_rules`**: Defines logical constraints evaluated during transitions (e.g., JSONB `{"field": "cn_applicable", "operator": "eq", "value": true}`).
- **`workflow_transitions`**: Directed graph edges defining the flow. Connects `from_stage_id` to `to_stage_id`. If `rule_id` is present, the transition only occurs if the rule evaluates to true (conditional branching).

### Execution Models (The Runtime)
- **`workflow_instances`**: Represents an active, running workflow attached to a specific `order_id`. Tracks the `current_stage_id` and overall `status` (Active, Completed, Cancelled).
- **`stage_instances`**: The execution record of a stage for a specific instance. Tracks `status` (Pending, Active, Skipped, Completed), `planned_deadline`, `actual_completion`, and `completed_by`.
- **`tasks`**: Actionable units of work instantiated from `workflow_steps` for a specific `stage_instance`. Tracks user input (checklist answers, document URLs) and `status`.

---

## 2. Core Operations

These operations should ideally be exposed as PostgreSQL Functions (RPCs) or executed within a Supabase Edge Function to guarantee security and consistency.

### `getStageDependencies(stage_id)`
- **Logic:** Queries `workflow_dependencies` to return a list of `required_stage_id`s that must be complete before this stage can begin.

### `isStageBlocked(stage_instance_id)`
- **Logic:** Calls `getStageDependencies`. Checks the `stage_instances` for this workflow instance. If any required stage is not `Completed` or `Skipped`, returns `true` (blocked).

### `canStartStage(stage_instance_id, user_id)`
- **Logic:** Returns `true` if:
  1. `isStageBlocked()` is `false`.
  2. `stage_instances.status` is `Pending`.
  3. The `user_id` possesses the `responsible_role_id` assigned to this stage.

### `getNextStage(current_stage_id, order_data)`
- **Logic:** Queries `workflow_transitions` where `from_stage_id = current_stage_id`. Evaluates attached `workflow_rules` against the `order_data` payload. Returns the valid `to_stage_id`.

### `shouldCreateCreditNote(order_data)`
- **Logic:** A specific implementation of a rule evaluation. Reads `order_data.cn_applicable` or `order_data.price_mismatch`. If true, returns `true` to force a conditional transition to the "CN Drafting" stage.

### `calculateStageDeadline(stage_id, start_timestamp)`
- **Logic:** Fetches `tat_hours` from `workflow_stages`. Iterates forward hour-by-hour from `start_timestamp`, skipping hours outside business hours (10:00 AM - 08:00 PM) and skipping days found in the `holidays` table, until the required `tat_hours` are consumed. Returns the resulting `planned_date`.

### `calculateSLAStatus(stage_instance_id)`
- **Logic:** Compares `planned_date` to `CURRENT_TIMESTAMP` (if active) or `actual_date` (if completed). Returns `ON_TIME`, `AT_RISK` (within 1 hr of deadline), or `BREACHED`.

### `createNextTask(stage_instance_id)`
- **Logic:** Queries `workflow_steps` for the new stage. Inserts rows into the `tasks` table, requiring the user to fulfill checklists or document uploads.

### `skipStage(stage_instance_id, reason, user_id)`
- **Logic:** Updates `stage_instances.status = 'Skipped'`. Logs the `reason` in `audit_logs`. Immediately invokes `determineNextStage()` to keep the workflow moving.

### `completeStage(stage_instance_id, payload, user_id)`
- **Logic:** The primary progression mutation. Triggers the Atomic Stage Transition described below.

---

## 3. Atomic Stage Transition

To ensure data integrity and prevent partial workflow states (e.g., checklist saved but stage not progressed), the transition must occur within a **single PostgreSQL Transaction (`BEGIN ... COMMIT`)**.

When `completeStage()` is invoked, the database executes the following sequence atomically:

1. **Save Submitted Data:** Upsert checklist responses or document paths from the payload into the `tasks` table.
2. **Validate Checklist:** Ensure all `tasks` where `is_required = true` and type = `checklist` have a non-null response. Rollback if validation fails.
3. **Validate Required Documents:** Ensure all `tasks` where `is_required = true` and type = `document` contain valid Supabase Storage URLs. Rollback if missing.
4. **Complete Stage:** Update `stage_instances` -> set `status = 'Completed'`, `actual_completion = NOW()`, `completed_by = user_id`.
5. **Record History:** Save the state of the stage into a `stage_history` table (or rely on the `audit_logs`).
6. **Determine Next Stage:** Call `getNextStage(current_stage_id, order_data)`. Evaluates rules (e.g., checking if Credit Note or Special Customer stages are required).
7. **Update Current Stage:** Update `workflow_instances.current_stage_id` to the new stage ID.
8. **Calculate Deadline:** Call `calculateStageDeadline()` to determine the SLA deadline for the new stage based on `NOW()`. Insert the new `stage_instance` with status `Pending` and the calculated `planned_deadline`.
9. **Create Next Task:** Call `createNextTask()` to populate the required checklists/documents for the newly created stage instance.
10. **Create Notification:** Insert an event into a `notifications` table or a job queue (e.g., `pg_net` or Supabase Webhooks) to dispatch the required Email/WhatsApp routing for the new stage (e.g., TCI Email).
11. **Create Audit Record:** Insert a row into `audit_logs` capturing the user, the stage completed, the new stage initiated, and the payload.

*Failure at any of these 11 steps throws an exception, rolling back the entire transaction. No partial states will ever be saved.*
