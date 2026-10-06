# Field Specification (Data Sheet)

| Column Name | Data Type | Required? | Business Meaning | Source | Calculated? | Notes |
|---|---|---|---|---|---|---|
| **Submission ID** | Number | Yes | Unique identifier for the order | Form Submission | No | Primary Key |
| **Timestamp** | DateTime | Yes | When the order was created | System | No | Basis for TAT |
| **Customer Name** | String | Yes | Name of the buyer | Dropdown | No | Drives VLOOKUPs for emails/address |
| **Sales Man** | String | Yes | Assigned sales representative | Dropdown | No | |
| **Delivery Address** | Text | Yes | Destination address | Dropdown/IDS | Yes | Pulled via VLOOKUP based on Customer Code |
| **Transporter Name** | String | No | Logistics partner | IDS/Checklist | Yes | `VLOOKUP` from IDS sheet |
| **Vehicle Number** | String | No | Truck/Van number | IDS/Checklist | Yes | |
| **Gate Pass Upload** | URL | No | Link to gate pass document | IDS | Yes | |
| **Invoice Number** | String | No | Official invoice ID | Checklist | Yes | Extracted from `New Invoice Upload` form |
| **Invoice Amount** | Number | No | Total order value | Checklist | Yes | |
| **Docket No.** | String | No | Courier/Transporter tracking | Checklist | Yes | |
| **E-Way Bill Expiry Date**| Date | No | Validity of E-Way bill | Checklist | Yes | |
| **Archive Data** | Boolean | No | Flags if order is archived | Formula | Yes | `="Yes"` if stage complete > 15 days or cancelled |
| **TCI Email / Direct Email**| String | No | Routing logic for notifications | Formula | Yes | Conditionally sets email based on Transporter |
| **Send PO** | String/URL | No | Link to generate PO | Formula | Yes | Contains pre-filled Google Form URL |
| **PI Checker Link** | String/URL | No | Link for PI checking | Formula | Yes | |
| **Admin Link** | String/URL | No | Link for Admin approval | Formula | Yes | |
| **Pricelist Link** | String/URL | No | Link for Pricelist update | Formula | Yes | |
| **CN Drafting Updated** | String/URL | No | Status of Credit Note drafting | Formula | Yes | |
| **CN Approve** | String/URL | No | Status of Credit Note approval | Formula | Yes | |
| **Combine Dispatch Update**| String/URL | No | Dispatch completion trigger | Formula | Yes | |
| **FormEditUrl** | URL | No | Direct link to edit order | Formula | Yes | Appends Submission ID to base URL |

*(Note: Most workflow links dynamically evaluate to "Done" or "Yes" if the corresponding `checklist` sheet contains an entry for this order, otherwise they render a Google Form URL with pre-filled parameters.)*
