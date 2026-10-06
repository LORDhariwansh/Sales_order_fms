# Checklist Specification

The system uses several distinct checklists to validate data at different stages. Currently, these are separate Google Forms pushing data into the `checklist` sheet.

## 1. PI Maker Checklist
- **Stage:** PI Entry
- **Validation:** Confirms PI is drafted correctly.

## 2. RC & Vehicle Checklist
- **Stage:** Pre-Dispatch
- **Item:** Vehicle Matched with Invoice & E-Way Bill.
- **Required:** Yes
- **Completion Behavior:** If "Yes", unlocks the Dispatch stage.

## 3. Invoice Prepare Checklist
- **Stage:** Invoicing
- **Validation:** Checks if pricing, quantities, and transporter details are accurate before final invoice generation.

## 4. Dispatch Checklist
- **Stage:** Dispatch
- **Item:** Gatepass Upload, Short & Excess Upload.
- **Attachment Requirement:** Requires Google Drive links (Gatepass).

## 5. New Invoice Upload Checklist (Consolidated)
- **Stage:** Post-Dispatch / Billing
- **Fields Collected:**
  - Invoice Number
  - Invoice Amount
  - Qty
  - Docket No.
  - E-Way Bill Expiry Date
  - Driver Contact Number
- **Attachments:** New Invoice Upload, Summary Upload, Bilty Upload.

*Target Architecture:* In SolidJS, these should not be separate forms, but integrated modal dialogues or stepper components within the Order Detail view, writing directly to the `orders` or `checklists` table.
