# FMS Reconciliation Report: Legacy (Google Sheets) vs. Modern (Supabase)

This report reconciles the architectural and behavioral differences between the old spreadsheet-based Sales Order FMS and the new normalized PostgreSQL architecture. 

Because the migration pipeline strictly parses historical data into a normalized state machine, several behavioral differences ("mismatches") emerge by design. This document outlines how 10 representative scenarios are handled across both systems.

---

## 1. Normal Order Progression
- **Old Behavior:** Users manually typed timestamps into the `Current Stage` sheet (e.g., PI Entry Actual, PI Checker Actual) to advance the workflow.
- **New Behavior:** Users click a "Complete Stage" button in the SolidJS UI. The `complete_stage` RPC automatically locks the row, timestamps `actual_date` with the server clock (`NOW()`), and auto-generates the next stage row.
- **Mismatch:** You can no longer backdate or manually manipulate completion times to avoid SLA penalties.
- **Severity:** `Low` (Intended security enhancement).
- **Fix:** Educate team that timestamps are now fully automated and immutable.

## 2. Overdue Order (TAT Calculation)
- **Old Behavior:** TAT deadlines were calculated using Excel formulas (`NETWORKDAYS`, `MOD`, `WORKDAY`), occasionally desyncing if the `Holidays` sheet wasn't updated perfectly.
- **New Behavior:** TAT is evaluated by the `calculate_deadline()` PostgreSQL PL/pgSQL function strictly respecting the 10:00 AM - 08:00 PM business hours and the `holidays` table.
- **Mismatch:** Historical SLA deadlines migrated from Excel may differ slightly (by a few hours) from what the new DB calculates, especially if historical leave/holidays were missing from the old sheet.
- **Severity:** `Medium`.
- **Fix:** The `migration-map` strictly preserves the *historical* `planned_date` directly from the Excel column rather than recalculating old orders with the new engine. The new engine only applies to new stages.

## 3. Order with CN (Credit Note) Applicable
- **Old Behavior:** Salesman checked a "CN Applicable" column. Humans manually remembered to loop in the `CA` role for draft and approval before invoicing.
- **New Behavior:** If `cn_applicable = TRUE`, the workflow engine's rule evaluator automatically routes the next stage to the `CA` role and blocks Invoice generation until CN is approved.
- **Mismatch:** Legacy orders marked "CN Applicable" but missing CN data might get stuck in the new engine.
- **Severity:** `High`.
- **Fix:** The migration scripts must map legacy completed orders directly to `status = 'Completed'` to bypass retroactive workflow enforcement on old data.

## 4. CN Not Applicable
- **Old Behavior:** Column left blank or marked 'No'.
- **New Behavior:** `cn_applicable` defaults to `FALSE`. Workflow automatically bypasses the CN Draft/Approve stages and routes Dispatch straight to Invoice Upload.
- **Mismatch:** None. Perfect 1:1 mapping.

## 5. Price Mismatch
- **Old Behavior:** Handled via a manual "Price Difference" text column and an override by Admin.
- **New Behavior:** Triggers an explicit conditional workflow rule routing the order back to the `Pricelist` role for re-approval before Admin can sign off.
- **Mismatch:** Stricter enforcement. An order cannot proceed to PO if the mismatch is unresolved.
- **Severity:** `Low` (Intended compliance upgrade).

## 6. Completed Order
- **Old Behavior:** Order lingered in the active sheet until someone archived it.
- **New Behavior:** Reaching the final workflow stage (Invoice Upload) automatically flags the parent order `status = 'Completed'`.
- **Mismatch:** Legacy system relied on human action for completion; new system is state-derived.

## 7. Archived Order
- **Old Behavior:** Flagged "Yes" in the `Archive Data` column (BN) and moved/hidden.
- **New Behavior:** `is_archived = TRUE` Boolean set on the `orders` table. Excluded from default Dashboard metrics via `WHERE is_archived = false`.
- **Mismatch:** None. The migration script maps the 'Yes' string to the `TRUE` boolean perfectly.

## 8. Order with Documents
- **Old Behavior:** Users pasted raw Google Drive URL strings into cells (e.g., Gate Pass Upload AP).
- **New Behavior:** Files are uploaded to the private `fms-documents` Supabase bucket.
- **Mismatch:** Legacy orders have Google Drive URLs; New orders have Supabase Storage paths.
- **Severity:** `Medium`.
- **Fix:** The `documents` table natively supports absolute HTTP URLs. The UI `DocumentManager.tsx` handles both by opening standard URLs normally and generating Signed URLs for Supabase paths. No code fix required.

## 9. Order with Incomplete Checklist
- **Old Behavior:** Users could physically type "Done" in the `Current Stage` sheet even if checklist columns were empty.
- **New Behavior:** The `complete_stage_advanced()` RPC executes a `COUNT()` on missing required `order_checklist_items`. If `> 0`, it raises a PostgreSQL exception and aborts the transaction.
- **Mismatch:** Legacy orders might show as "Completed" despite missing checklists. The new system makes this mathematically impossible.
- **Severity:** `Critical` (During Migration).
- **Fix:** The `import-data` migration script disables the checklist triggers during the historical data import, allowing legacy "dirty" orders to be imported as-is. Triggers are re-enabled for all orders created post-launch.

## 10. Order with Conditional Workflow
- **Old Behavior:** Branching relied entirely on human memory (e.g., "If Transporter is X, do Y").
- **New Behavior:** `workflow_transitions` and `workflow_rules` dictate flow.
- **Mismatch:** If a legacy order skipped a stage irregularly, the new state machine might view the order as "Broken" or "Blocked" if evaluated retroactively.
- **Severity:** `Medium`.
- **Fix:** Similar to #9, historical workflow progression is mapped statically using the `order_stages.actual_date` columns. The workflow engine will only evaluate transition rules for *active* or *future* stages, gracefully accepting the legacy history.

---

### Conclusion & Migration Verdict
The architectural shift from a flat, mutable spreadsheet to a normalized, ACID-compliant database introduces deliberate constraints. 

By strategically ignoring retroactive rule evaluation on historical stages (preserving old timestamps and statuses exactly as they were in Excel), **no critical unresolvable mismatches exist.** The migration pipeline is designated as **SAFE and SUCCESSFUL**.
