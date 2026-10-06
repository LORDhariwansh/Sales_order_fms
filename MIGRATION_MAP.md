# Google Sheets to Supabase Migration Map

This document outlines the staging architecture and exact mapping rules to migrate historical data from the `Sale Order FMS.xlsx` workbook into the normalized PostgreSQL schema without data loss.

---

## 1. Migration Staging Architecture

To prevent dirty data from corrupting the production database, the migration follows an ELT (Extract, Load, Transform) pipeline using staging tables in Supabase:

1. **Google Sheets (Source):** The original `.xlsx` file is left strictly read-only.
2. **Raw Import (`stg_raw_*`):** Raw CSV dumps of `Data`, `Dropdown`, and `Current Stage` are loaded directly into loosely typed `stg_raw` PostgreSQL tables (all columns as `TEXT`).
3. **Cleaning:** Trimming whitespace, removing empty rows, handling `#N/A`, `#REF!`, and casting text dates to valid ISO8601 timestamps.
4. **Normalization:** Extracting unique Customers, Salesmen, and Transporters from the flat order data into their respective master tables.
5. **Mapping:** Translating raw order columns into `orders`, `invoices`, `dispatch`, and `order_stages`.
6. **Validation:** Running SQL constraints to catch orphan records and invalid dates.
7. **Production Tables:** Final `INSERT INTO... SELECT` commands push verified data into the production tables.

---

## 2. Validation & Error Handling Architecture

Errors are **never silently discarded**. Any row failing validation is skipped from the production insert and written to a `migration_errors` reporting table containing:
`error_id`, `source_table`, `source_record_id`, `error_type`, `error_message`, `raw_data_json`.

**Detection Rules:**
- **Duplicate Record Numbers:** `submission_id` appearing multiple times in `Data`.
- **Missing Customers:** Orders referencing a Customer Name not found in the `Dropdown` / Master list.
- **Invalid Users:** Salesmen or "Doers" whose emails do not match an existing registered Supabase Auth profile.
- **Invalid Dates:** Timestamp strings like `46240.78611111` (Excel serial dates) that fail to convert to valid `Timestamptz`.
- **Invalid Stages / TAT:** Missing planned dates or chronological errors (e.g., actual completion before actual start).
- **Orphan Records:** Rows in `Current Stage` that have no matching `Submission ID` in `Data`.
- **Invalid Relationships:** A delivery address code that doesn't map to the specified customer.

---

## 3. Exhaustive Field Mappings

### 3.1. Customers Master
**OLD SHEET:** Dropdown
**OLD COLUMN:** CUSTOMER NAME (AL)
**NEW TABLE:** customers
**NEW COLUMN:** name
**TRANSFORMATION:** `TRIM(UPPER(name))`
**VALIDATION:** Must not be null or empty.
**ERROR HANDLING:** Log `MISSING_CUSTOMER_NAME`.

**OLD SHEET:** Dropdown
**OLD COLUMN:** CUSTOMER EMAIL ID (T)
**NEW TABLE:** customers
**NEW COLUMN:** email
**TRANSFORMATION:** `TRIM(LOWER(email))`
**VALIDATION:** Must be a valid email string if present.
**ERROR HANDLING:** Log `INVALID_EMAIL_FORMAT`.

**OLD SHEET:** Dropdown
**OLD COLUMN:** Special Customer (AA)
**NEW TABLE:** customers
**NEW COLUMN:** is_special
**TRANSFORMATION:** `IF 'Yes' THEN true ELSE false`
**VALIDATION:** None.
**ERROR HANDLING:** Default to false.

### 3.2. Customer Addresses
**OLD SHEET:** Dropdown
**OLD COLUMN:** CUSTOMER CODE (K)
**NEW TABLE:** customer_addresses
**NEW COLUMN:** address_code
**TRANSFORMATION:** Extract raw string (e.g. `AT1-Delivery 1`).
**VALIDATION:** Must not be null.
**ERROR HANDLING:** Log `ORPHAN_ADDRESS`.

**OLD SHEET:** Dropdown
**OLD COLUMN:** DELIVERY ADDRESS (M)
**NEW TABLE:** customer_addresses
**NEW COLUMN:** address_text
**TRANSFORMATION:** Strip line breaks, trim.
**VALIDATION:** Must map to a valid `customers.id`.
**ERROR HANDLING:** Log `INVALID_ADDRESS_MAPPING`.

### 3.3. Users / Profiles
**OLD SHEET:** Dropdown
**OLD COLUMN:** SALESMAN EMAIL ID (U)
**NEW TABLE:** profiles
**NEW COLUMN:** email
**TRANSFORMATION:** Trim, lowercase.
**VALIDATION:** Must match an auth.users record.
**ERROR HANDLING:** Log `INVALID_USER`.

**OLD SHEET:** Dropdown
**OLD COLUMN:** PO WHATS APP ID (AN)
**NEW TABLE:** profiles
**NEW COLUMN:** whatsapp_id
**TRANSFORMATION:** Trim string.
**VALIDATION:** None.
**ERROR HANDLING:** Ignore if invalid.

### 3.4. Orders (Core)
**OLD SHEET:** Data
**OLD COLUMN:** Submission ID (CE)
**NEW TABLE:** orders
**NEW COLUMN:** submission_id
**TRANSFORMATION:** Cast to `Text`.
**VALIDATION:** Must be strictly unique across the database.
**ERROR HANDLING:** Log `DUPLICATE_SUBMISSION_ID`.

**OLD SHEET:** Data
**OLD COLUMN:** Timestamp (B)
**NEW TABLE:** orders
**NEW COLUMN:** created_at
**TRANSFORMATION:** Convert Excel Serial DateTime to Postgres `Timestamptz`.
**VALIDATION:** Must be a valid date <= `NOW()`.
**ERROR HANDLING:** Log `INVALID_ORDER_DATE`.

**OLD SHEET:** Data
**OLD COLUMN:** Archive Data (BN)
**NEW TABLE:** orders
**NEW COLUMN:** is_archived
**TRANSFORMATION:** `IF 'Yes' THEN true ELSE false`.
**VALIDATION:** None.
**ERROR HANDLING:** Default to `false`.

### 3.5. Dispatch
**OLD SHEET:** Data
**OLD COLUMN:** Transporter (CA)
**NEW TABLE:** dispatch
**NEW COLUMN:** transporter_id
**TRANSFORMATION:** Lookup `transporters.id` by trimmed name.
**VALIDATION:** Must reference existing transporter.
**ERROR HANDLING:** Log `MISSING_TRANSPORTER`.

**OLD SHEET:** Data
**OLD COLUMN:** Weight (CB)
**NEW TABLE:** dispatch
**NEW COLUMN:** weight_kg
**TRANSFORMATION:** Strip "KG", cast to numeric.
**VALIDATION:** Valid numeric weight >= 0.
**ERROR HANDLING:** Log `INVALID_WEIGHT_FORMAT`.

**OLD SHEET:** Data
**OLD COLUMN:** Vehicle Number (DE)
**NEW TABLE:** dispatch
**NEW COLUMN:** vehicle_number
**TRANSFORMATION:** Trim string.
**VALIDATION:** None.
**ERROR HANDLING:** None.

### 3.6. Invoices
**OLD SHEET:** Data
**OLD COLUMN:** Invoice Number (CQ)
**NEW TABLE:** invoices
**NEW COLUMN:** invoice_number
**TRANSFORMATION:** Trim string.
**VALIDATION:** Must be unique per order.
**ERROR HANDLING:** Log `DUPLICATE_INVOICE`.

**OLD SHEET:** Data
**OLD COLUMN:** Invoice Amount (CR)
**NEW TABLE:** invoices
**NEW COLUMN:** invoice_amount
**TRANSFORMATION:** Cast to numeric.
**VALIDATION:** Must be >= 0.
**ERROR HANDLING:** Log `INVALID_INVOICE_AMOUNT`.

**OLD SHEET:** Data
**OLD COLUMN:** Qty (CS)
**NEW TABLE:** invoices
**NEW COLUMN:** quantity
**TRANSFORMATION:** Cast to integer.
**VALIDATION:** Must be >= 0.
**ERROR HANDLING:** Log `INVALID_QUANTITY`.

**OLD SHEET:** Data
**OLD COLUMN:** Docket No. (CT)
**NEW TABLE:** invoices
**NEW COLUMN:** docket_no
**TRANSFORMATION:** Trim string.
**VALIDATION:** None.
**ERROR HANDLING:** None.

**OLD SHEET:** Data
**OLD COLUMN:** E-Way Bill Expiry Date (CU)
**NEW TABLE:** invoices
**NEW COLUMN:** eway_bill_expiry
**TRANSFORMATION:** Excel Serial to Date.
**VALIDATION:** Valid date.
**ERROR HANDLING:** Log `INVALID_EXPIRY_DATE`.

### 3.7. Workflow Stages & History
*(This strategy applies identically to all stages: PI Entry, Pricelist, Admin Approval, RC & Vehicle, Dispatch, etc.)*

**OLD SHEET:** Current Stage
**OLD COLUMN:** PI Entry Actual (AA)
**NEW TABLE:** order_stages
**NEW COLUMN:** actual_date
**TRANSFORMATION:** Excel Serial to Timestamptz. Insert row where `stage_id = 'pi_entry_id'`.
**VALIDATION:** Must be a valid date.
**ERROR HANDLING:** Log `INVALID_STAGE_DATE`.

**OLD SHEET:** Current Stage
**OLD COLUMN:** PI Checker Planned (CM)
**NEW TABLE:** order_stages
**NEW COLUMN:** planned_date
**TRANSFORMATION:** Excel Serial to Timestamptz.
**VALIDATION:** `planned_date` must not be null if stage exists.
**ERROR HANDLING:** Log `MISSING_PLANNED_DATE`.

**OLD SHEET:** Current Stage
**OLD COLUMN:** PI Checker Actual (CO)
**NEW TABLE:** order_stages
**NEW COLUMN:** status
**TRANSFORMATION:** `IF NOT NULL THEN 'Completed' ELSE 'Pending'`.
**VALIDATION:** `actual_date` must be >= `planned_date` (chronological validation if strictly enforced).
**ERROR HANDLING:** Log `CHRONOLOGICAL_ERROR`.

### 3.8. Documents (Legacy Google Drive)
*(Google Drive URLs are preserved natively in the `documents` table without immediate binary download).*

**OLD SHEET:** Data
**OLD COLUMN:** Gate Pass Upload (AP)
**NEW TABLE:** documents
**NEW COLUMN:** storage_path
**TRANSFORMATION:** Extract URL, set `document_type = 'Gatepass'`.
**VALIDATION:** Regex match for valid URI (`^https?://`).
**ERROR HANDLING:** Log `INVALID_DOCUMENT_URL`.

**OLD SHEET:** Data
**OLD COLUMN:** New Invoice Upload (DX)
**NEW TABLE:** documents
**NEW COLUMN:** storage_path
**TRANSFORMATION:** Extract URL, set `document_type = 'Invoice'`.
**VALIDATION:** Valid URI.
**ERROR HANDLING:** Log `INVALID_DOCUMENT_URL`.

**OLD SHEET:** Data
**OLD COLUMN:** New Bility Upload (DZ)
**NEW TABLE:** documents
**NEW COLUMN:** storage_path
**TRANSFORMATION:** Extract URL, set `document_type = 'Bilty'`.
**VALIDATION:** Valid URI.
**ERROR HANDLING:** Log `INVALID_DOCUMENT_URL`.
