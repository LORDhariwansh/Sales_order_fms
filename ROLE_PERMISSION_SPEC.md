# Roles and Permissions Specification

Based on the `Settings` and `Dropdown` sheets, the following teams/roles exist in the system.

## Roles / Groups
1. **Create** (Order Entry)
2. **MIS** (Management Information Systems / Overrides)
3. **Pricelist** (Sales/Commercial team handling pricing)
4. **Admin** (Final commercial approval before PO)
5. **CA** (Chartered Accountant / Finance)
6. **SC** (Supply Chain)
7. **EA** (Executive Assistant / Management)
8. **NK** (Specific user/role identifier)

## Reminder Groups
Reminders are routed to specific groups based on the stage:
- Pricelist, Admin, CA, SC, EA, NK

*Target Architecture:* These roles should be implemented as a `roles` table in PostgreSQL. Supabase Auth users will map to these roles, and RLS (Row Level Security) policies will dictate which roles can approve which stages (e.g., only `Admin` can update `admin_approval_actual`).
