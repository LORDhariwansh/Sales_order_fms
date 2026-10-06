# Security Specification

This document defines the Role-Based Access Control (RBAC) and authorization architecture for the FMS using Supabase Auth, PostgreSQL, and explicitly mapped permissions.

---

## 1. Roles

Derived strictly from the `ROLE_PERMISSION_SPEC.md` (extracted from the Google Sheets `Settings` and `Dropdown` tabs):

| Role Code | Description |
|---|---|
| `Create` | Order entry personnel. Initiates FMS records and drafts the Proforma Invoice (PI). |
| `Pricelist` | Sales and commercial team responsible for approving standard/custom pricing. |
| `Admin` | High-level commercial approvers. Handles overrides for price mismatches and stage gating. |
| `CA` | Finance and accounting. Responsible for Credit Notes (CN), Invoice details, and final billing. |
| `SC` | Supply Chain / Dispatch. Responsible for logistics, vehicle checks, and biltys. |
| `MIS` | Management Information Systems. Full system administrators. Manages master data and overrides. |
| `EA` | Executive Assistant / Management reporting viewers. |
| `NK` | Specific identifier/legacy role (Read-only/Audit). |

---

## 2. Granular Permissions

Instead of hardcoding role checks, roles are mapped to discrete, granular permissions.

### Order Operations
- `orders.view`: Can view the order list and basic details.
- `orders.create`: Can initiate a new order (`Create` role).
- `orders.edit`: Can modify non-financial details on an active order.
- `orders.cancel`: Can cancel an order (`Admin`, `MIS`).

### Stage Completion Permissions
- `stage.pi.complete`: Submit PI (`Create`).
- `stage.pricelist.complete`: Approve pricing (`Pricelist`).
- `stage.admin.complete`: Commercial approval (`Admin`).
- `stage.po.complete`: Upload Purchase Order (`Admin`, `Create`).
- `stage.rc_vehicle.complete`: Verify truck and RC (`SC`).
- `stage.dispatch.complete`: Upload gatepass and short/excess details (`SC`).

### Financial Permissions
- `invoice.view`: View generated invoices.
- `invoice.create`: Upload final tax invoice and bilty (`CA`).
- `credit_note.view`: View CN requests.
- `credit_note.approve`: Authorize CN generation (`CA`, `Admin`).

### Administrative Permissions
- `master_data.manage`: Edit Dropdowns, Transporters, Customers, Holidays (`MIS`).
- `reports.view`: Access analytics and dashboards (`MIS`, `EA`, `Admin`).

---

## 3. Teams Architecture

To support the "Reminder Grps" and regional "Sales Groups" mapped in the original workbook:

### `teams`
- Groups of users (e.g., "North Dispatch Team", "Corporate Billing").
- Used primarily for routing notifications (TCI Emails, WhatsApp alerts) to the correct group of people when a stage unlocks.

### `team_members`
- Joins a `user_id` to a `team_id`.
- Allows the engine to assign a `stage_instance` to an entire team (e.g., `SC`) rather than a single individual, enabling any team member to pick up the task and establish the `actual_start` timestamp.

---

## 4. Fundamental Security Requirements

1. **Frontend Visibility is NOT Security:** Hiding a button in SolidJS does not secure the database. Every action must be enforced by PostgreSQL RLS or server-side functions.
2. **Never Expose the Service Role Key:** The `SUPABASE_SERVICE_ROLE_KEY` must strictly reside in server-side Edge Functions or secure backends. The SolidJS app must only use the `SUPABASE_ANON_KEY`.
3. **Private Document Storage:** The Supabase Storage bucket (`fms-documents`) must be set to **Private**. The frontend must request time-limited **Signed URLs** to view or download Gatepasses, Invoices, and Biltys.
4. **Server-Side Validation:** All Stage completions and deadline SLA calculations must happen inside a secure PostgreSQL transaction. The browser cannot be trusted to send correct timestamps or force a stage to "Done".
