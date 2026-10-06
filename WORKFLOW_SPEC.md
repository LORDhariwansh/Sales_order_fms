# Workflow Specification

Based on the `Data` and `Current Stage` sheets, the actual sequence of operations is highly parallelized and conditional, relying on checklists.

### Stages

1. **Order Entry (PI Entry)**
   - **Purpose:** Initiates the FMS.
   - **Trigger:** Google Form submission.
   - **Next:** PI Maker Checklist, Pricelist, Admin Approval.

2. **PI Maker**
   - **Purpose:** Proforma Invoice generation.
   - **Completion Condition:** PI Maker Checklist form submitted.

3. **Pricelist (Sales/Pricing)**
   - **Purpose:** Validates and confirms the pricing.
   - **Dependencies:** Order Entry.
   - **Completion Condition:** Pricelist Link form submitted.

4. **Admin Approval**
   - **Purpose:** Commercial/Admin validation.
   - **Dependencies:** Order Entry, PI Maker.
   - **Completion Condition:** Admin Link form submitted.

5. **Send PO**
   - **Purpose:** Purchase Order generation.
   - **Dependencies:** Admin Approval.
   - **Completion Condition:** Send PO form submitted.

6. **PI Checker**
   - **Purpose:** Quality control of PI.
   - **Completion Condition:** PI Checker Link form submitted.

7. **RC & Vehicle Checklist**
   - **Purpose:** Validation of transport vehicle (RC matched with Invoice).
   - **Completion Condition:** RC form submitted.

8. **Dispatch**
   - **Purpose:** Movement of goods.
   - **Checklist:** Send to Dispatch Checklist.
   - **Completion Condition:** Combine Dispatch Update form submitted.

9. **Invoice Preparation & Upload**
   - **Purpose:** Final financial document generation.
   - **Uploads:** New Invoice Upload, Summary Upload, Bilty Upload.
   - **Completion Condition:** All three documents uploaded (Invoice, Summary, Bilty).

10. **Credit Note (CN) Flow (Conditional)**
    - **Purpose:** Issue CN if applicable (e.g. price mismatch or specific terms).
    - **Sub-stages:** CN Drafting -> CN Approval -> CN Prepare.

11. **Archive**
    - **Purpose:** Close the order.
    - **Trigger:** System automatically archives 15 days after Completion or immediately on Cancellation.

### Conditional Behaviors
- **Direct Dispatch vs TCI:** If transporter is "TCI", specific TCI emails are generated. If "DIRECT", a "Direct Email" payload is generated containing Invoice, Summary, Bilty, E-Way Bill, and Driver Contact.
- **Special Customer:** If Customer is marked as "Special" in Dropdown, an additional "Special Stg" form is required.
