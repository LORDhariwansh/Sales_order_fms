# Row Level Security (RLS) Specification

This document maps the security constraints to PostgreSQL Row Level Security (RLS) policies. All tables in the database must have RLS enabled (`ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`).

---

## 1. Master & Configuration Data

### `workflow_definitions`, `workflow_stages`, `holidays`
- **SELECT:** `true` (Available to all authenticated internal users to render the UI).
- **INSERT / UPDATE / DELETE:** 
  - `auth.uid() IN (SELECT user_id FROM user_roles WHERE role_id = 'MIS_ROLE_ID')`
  - *Only the MIS team can modify system configuration and TAT rules.*

### `customers`, `transporters`
- **SELECT:** `true` (Available to all authenticated users for dropdown population).
- **INSERT / UPDATE:**
  - Allowed for `MIS` and `Admin`.
  - Allowed for `Create` (Order Entry) to add new customers if necessary.

---

## 2. Core Transactional Data

### `orders`
- **SELECT:** `true` (All authenticated internal users can view orders for cross-department transparency).
- **INSERT:**
  - Allowed for users with the `Create` role (Order Entry personnel).
- **UPDATE:**
  - Allowed for `Admin` or `MIS`.
  - Allowed for the assigned `Salesman` (if limited to updating non-critical text fields before Dispatch).
- **DELETE:**
  - `false` (Orders cannot be hard-deleted. They must be transitioned to a `Cancelled` state or flagged as `is_archived`).

### `order_stages` & `tasks` (Checklists)
- **SELECT:** `true`
- **UPDATE / INSERT:**
  - A user can only update an `order_stage` (to mark it completed) OR answer a `task` checklist if:
    1. The stage `status` is currently `Pending`.
    2. The user possesses the `role` required by the parent `workflow_stages.responsible_role_id`.
    *(Implemented via a PostgreSQL `EXISTS` subquery joining `user_roles` against the required stage role).*

---

## 3. Financial Sub-Domains

### `invoices`
- **SELECT:** `true`
- **INSERT / UPDATE:**
  - Restricted to users possessing the `CA` (Chartered Accountant/Finance) or `Admin` role.

### `credit_notes`
- **SELECT:** `true`
- **INSERT / UPDATE:**
  - Initial creation allowed by `CA` or `Create` (depending on who drafts it).
  - Updating `approval_status` to 'Approved' is strictly restricted to `Admin` and `CA`.

---

## 4. Documents & Storage

### `documents` (Database Table)
- **SELECT:** `true` (Visibility of the metadata record).
- **INSERT:**
  - Permitted for users executing the active stage (e.g., `SC` role inserting Gatepass records).

### `fms-documents` (Supabase Storage Bucket)
- **Bucket Policy:** Private.
- **SELECT (Read):** Users must request a time-bound Signed URL via the Supabase Client. No public unauthenticated access is allowed.
- **INSERT (Upload):** Authenticated users can upload objects if they are currently assigned to the active workflow stage.
- **UPDATE / DELETE:** Restricted to `MIS` and `Admin`. Normal users cannot delete financial records like Biltys or Invoices once uploaded.

---

## 5. System Integrity

### `audit_logs`
- **SELECT:** 
  - Restricted to `MIS`, `Admin`, and `EA` (Executive Assistants).
- **INSERT:**
  - `false` (No user or role can manually insert an audit log).
  - Insertions are performed strictly via PostgreSQL database `AFTER UPDATE` / `AFTER INSERT` triggers executing under elevated security definer contexts.
- **UPDATE / DELETE:**
  - `false` (Audit logs are immutable).
