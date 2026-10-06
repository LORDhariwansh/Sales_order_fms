# Worksheet Inventory

| Sheet | Purpose | Important? | Related To | Notes |
|---|---|---|---|---|
| **Data** | Main transaction table for all orders | Yes | Checklists, Dropdowns | Contains the primary state, formulas for pulling form data, and stage statuses |
| **Settings** | Configuration for TAT, Groups, Colors | Yes | Workflows, TAT | Defines TAT hours per stage, roles, and reminder groups |
| **Dropdown** | Master Data for Customers, Salesmen, Emails | Yes | Data | Used for data validation and VLOOKUPs (Customer Name, Email, WA ID, Address) |
| **checklist** | Consolidated form responses for checklists | Yes | Data, Forms | Stores answers for PI Maker, Admin, Dispatch, RC & Vehicle checklists |
| **Current Stage** | Workflow tracking (Planned vs Actual) | Yes | Data, TAT | Computes delays and TAT for each workflow step (e.g. CN Drafting, PI Entry) |
| **Holiday** | List of non-working days for TAT | Yes | TAT, Settings | Uses `WORKDAY` logic to exclude Sundays and specific dates from SLA |
| **Archive** | Stores completed or cancelled orders | Yes | Data | Orders move here when `Archive Data`="Yes" (15 days after completion/cancellation) |
| **IDS & IDS2** | Webhook/Form response dumps | Yes | Data, Dispatch | Sources for Gatepass, Transporter, Advance Amount, Vehicle Number |
| **Messages** | Notification templates | No | Communications | Email and WhatsApp body templates |
| **Dashboard** | Visual summary for users | No | Reports | Uses Table View to show KPIs |
| **CN INVOICE REPORT** | Specific report for Credit Notes | No | Reports | |
| **Rep_Stage, Rep_Ord_Status, Rep_Pending, Rep_Activity_Funnel, Rep_Step** | Reporting aggregations | No | Reports | Hidden sheets powering the dashboard |
| **Table View** | Data aggregation for Dashboard | No | Dashboard | Hidden |
| **20.05.2025** | Snapshot or backup sheet | No | - | Hidden |
| **Doer Leave** | Tracks employee leaves | Yes | TAT | Used to pause TAT or re-assign tasks (Hidden) |
| **AI, HTML** | Technical helper sheets | No | Notifications | |

## General Architecture Notes
The workbook acts as a relational database where `Data` is the central "Orders" table. Google Forms submit data to `IDS`, `IDS2`, and `checklist`, which are then pulled into `Data` via `VLOOKUP` or `XLOOKUP` on the `Submission ID` or `Record No`. TAT is calculated in `Current Stage` using the `Holiday` sheet to skip weekends and holidays.
