# Business Rule Specification

## 1. BUSINESS RULES (Core Logic & Validation)

**BR-001**
**Name:** Archival Eligibility
**Trigger:** Daily chron job / Order Status Change
**Conditions:** 
1. Stage Complete is "Done" OR Order Status is "Cancel"
2. Current Date > 15 days since the completion/cancellation date.
**Required data:** Stage Completion Date, Order Status, Current Date
**Action:** Flag the order as archived.
**Result:** Order is moved out of active processing views.
**Blocking:** No
**Responsible:** System
**Error:** N/A
**Source:** Data Sheet!Archive Data (BN)

**BR-001b**
**Name:** Price Mismatch Validation
**Trigger:** Pricelist Submission
**Conditions:** The submitted sales price differs from the standard pricing master for the selected items.
**Required data:** Base Price, Quoted Price
**Action:** Automatically route the order to Admin Approval stage.
**Result:** Order requires explicit commercial override before PO can be sent.
**Blocking:** Yes (Blocks Send PO stage)
**Responsible:** Pricelist / Admin
**Error:** "Price mismatch requires admin override."
**Source:** Data Sheet!Price Mismatch (R)

**BR-002**
**Name:** Holiday TAT Exclusions
**Trigger:** Turnaround Time (TAT) Calculation
**Conditions:** The target date falls on a Sunday OR exists in the system `Holiday` list.
**Required data:** Target Date, Holiday Array Configuration
**Action:** Skip the non-working day when adding TAT hours to the planned deadline.
**Result:** SLA timeline extends to the next valid working day.
**Blocking:** No
**Responsible:** System
**Error:** N/A
**Source:** Holiday Sheet!Formula (D, L)

**BR-003**
**Name:** Special Customer Flagging
**Trigger:** Order Entry
**Conditions:** Customer Name exists in the predefined `Special Customer` master list.
**Required data:** Customer Name, Dropdown Data
**Action:** Set Special Customer flag to True.
**Result:** An extra "Special Stage" is injected into the workflow prior to completion.
**Blocking:** Yes (Blocks final completion if special stage is pending)
**Responsible:** System
**Error:** "Special stage incomplete."
**Source:** Data Sheet!Special Customer (DJ)

**BR-004**
**Name:** Email Routing - TCI Transporter
**Trigger:** Dispatch Stage Completion
**Conditions:** Transporter Name = "TCI" AND Combine Email is present.
**Required data:** Transporter Name, Customer Email
**Action:** Queue TCI-specific email template for the customer.
**Result:** Customer receives TCI tracking notification.
**Blocking:** No
**Responsible:** System
**Error:** "Transporter email template or address missing."
**Source:** Data Sheet!TCI Email (EH)

**BR-005**
**Name:** Email Routing - Direct Transporter
**Trigger:** Post-Dispatch / Invoice Upload
**Conditions:** Transporter = "DIRECT" AND (Invoice, Summary, Bilty, Qty, Amount, Docket, E-Way Bill) are fully uploaded.
**Required data:** Invoice File, Summary File, Bilty File, E-Way Bill, Docket No.
**Action:** Queue Direct Delivery email template with full documentation.
**Result:** Full direct delivery packet sent to customer.
**Blocking:** No
**Responsible:** System
**Error:** "Incomplete documentation for direct email."
**Source:** Data Sheet!Direct Email (EI)

---

## 2. WORKFLOW RULES (Process Sequencing)

**BR-006**
**Name:** Dispatch Stage Unlock
**Trigger:** Submit RC & Vehicle Checklist
**Conditions:** The Vehicle number must match the Invoice and E-Way Bill.
**Required data:** RC Document confirmation, E-Way Bill, Vehicle Number
**Action:** Unlocks the "Send to Dispatch" stage.
**Result:** Dispatch team is authorized to upload the Gatepass.
**Blocking:** Yes
**Responsible:** Dispatch Team / Admin
**Error:** "Vehicle details must match E-Way Bill before dispatch is allowed."
**Source:** Data Sheet!RC & Vehicle Checklist (DG) / checklist!AV

**BR-007**
**Name:** Invoice Document Consolidation
**Trigger:** Invoice Upload Stage
**Conditions:** New Invoice, Summary, and Bilty must be uploaded simultaneously.
**Required data:** Invoice PDF, Summary PDF, Bilty PDF, Invoice Amount, Docket No, Expiry Date
**Action:** Validates presence of all mandatory financial documents.
**Result:** Marks "Invoice Detail" as Done.
**Blocking:** Yes (Cannot proceed to completion without all three)
**Responsible:** Accounts / Billing Team
**Error:** "Missing mandatory invoice documents."
**Source:** Data Sheet!Invoice Detail (DF) / checklist!AX:BG

**BR-008**
**Name:** Credit Note (CN) Dependency
**Trigger:** CN Drafting Stage
**Conditions:** CN Applicable flag is true (set during Order Entry/Admin).
**Required data:** CN Remark, Approval Status
**Action:** Mandates execution of CN Approval -> CN Prepare sub-flow.
**Result:** Credit Note is formally generated and approved.
**Blocking:** Yes (Blocks final closure)
**Responsible:** CA / Admin
**Error:** "Pending Credit Note approval."
**Source:** Data Sheet!CN Approve (BG)

**BR-009**
**Name:** Leave Delegation Pause
**Trigger:** Task Assignment
**Conditions:** Assigned "Doer" is marked as on Leave in the `Doer Leave` table.
**Required data:** User ID, Leave Schedule
**Action:** Temporarily pause TAT SLA OR re-assign task to backup Doer.
**Result:** Prevents SLA breaches due to scheduled PTO.
**Blocking:** No
**Responsible:** MIS / System
**Error:** N/A
**Source:** Doer Leave Sheet (Hidden logic)

---

## 3. DATABASE CONSTRAINTS (Data Integrity)

**BR-010**
**Name:** Unique Submission ID
**Trigger:** Insert New Order
**Conditions:** Submission ID (or Order ID) must be strictly unique.
**Required data:** Submission ID
**Action:** Reject database insert/update.
**Result:** Prevents duplicate orders from identical form submissions.
**Blocking:** Yes
**Responsible:** Database
**Error:** "Submission ID already exists."
**Source:** Data Sheet!Submission ID (CE)

**BR-011**
**Name:** Delivery Address Code Integrity
**Trigger:** Delivery Address Selection
**Conditions:** The Delivery Address selected must explicitly map to the predefined Customer Code (e.g., `AT1-Delivery 1`).
**Required data:** Customer Name, Delivery Code
**Action:** Lock the address based on the relational mapping.
**Result:** Prevents shipping to unapproved locations.
**Blocking:** Yes
**Responsible:** Database
**Error:** "Invalid delivery address for selected customer."
**Source:** Dropdown Sheet!Delivery Address (M)

**BR-012**
**Name:** Valid Document References
**Trigger:** Upload Document
**Conditions:** All document paths stored must be valid URIs mapping to the storage bucket.
**Required data:** File Path / URL
**Action:** Reject null or improperly formatted URLs for mandatory uploads.
**Result:** Maintains strict document traceability.
**Blocking:** Yes
**Responsible:** Database / Storage API
**Error:** "Invalid document URL format."
**Source:** Data Sheet (Upload Columns)

---

## 4. SECURITY RULES (Access & Authorization)

**BR-013**
**Name:** Role-Based Stage Execution
**Trigger:** Execute Workflow Action (e.g., Admin Approve)
**Conditions:** The authenticated user must belong to the specific required group for that stage (e.g., Admin group for Admin Link).
**Required data:** User ID, User Role, Stage Requirement
**Action:** Deny access or disable the action button.
**Result:** Secures commercial and financial steps.
**Blocking:** Yes
**Responsible:** Authentication System / Database RLS
**Error:** "You do not have permission to approve this stage."
**Source:** Settings Sheet!Edit User Group (O/Y)

**BR-014**
**Name:** Master Data Modification Restriction
**Trigger:** Edit Customer/Salesman/TAT Config
**Conditions:** The user's role must be strictly "MIS".
**Required data:** User Role
**Action:** Reject update requests to master tables from non-MIS users.
**Result:** Prevents unauthorized changes to pricing or routing logic.
**Blocking:** Yes
**Responsible:** Database RLS
**Error:** "Only MIS team can modify master data."
**Source:** Settings Sheet!MIS Role (Z)

---

## 5. UI BEHAVIOR (Frontend Display Logic)

**BR-015**
**Name:** Dynamic Stage Actions
**Trigger:** Render Order Row
**Conditions:** 
- If the stage is incomplete (null in DB), render the primary "Action Button" for that stage.
- If the stage is complete, render a disabled "Done" badge.
**Required data:** Stage Completion Timestamps
**Action:** Toggle UI component based on boolean state.
**Result:** User immediately knows what actions are pending.
**Blocking:** No
**Responsible:** Frontend
**Error:** N/A
**Source:** Data Sheet (FormEditUrl / VLOOKUP link logic)

**BR-016**
**Name:** SLA Breach Highlighting
**Trigger:** Render Dashboard/Order List
**Conditions:** The current timestamp is greater than the calculated Planned Completion Date for an active stage.
**Required data:** Planned Date, Actual Date (or Current Date if null)
**Action:** Apply critical warning styles (e.g., red text/background) to the stage column.
**Result:** Draws immediate attention to bottlenecked orders.
**Blocking:** No
**Responsible:** Frontend
**Error:** N/A
**Source:** Current Stage Sheet (Implied by TAT tracking delays)

**BR-017**
**Name:** Mandatory Field Locking
**Trigger:** Submitting a Modal/Form
**Conditions:** Any field marked as "Required" in the associated Checklist Spec is null or empty.
**Required data:** Form State
**Action:** Disable the submission button and highlight missing fields.
**Result:** Ensures data is complete before hitting the backend.
**Blocking:** Yes (Frontend execution block)
**Responsible:** Frontend
**Error:** "Please fill all required fields before proceeding."
**Source:** checklist Sheet (Required asterisk fields in original Google Forms)
