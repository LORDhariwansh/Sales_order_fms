# Report Specification

The workbook contains several reporting and dashboard sheets.

## Dashboard & Summary Sheets
1. **Dashboard:** The main visual interface. Pulls data from `Table View` and the `Rep_*` sheets.
2. **CN INVOICE REPORT:** Specific reporting on Credit Notes, tracking CN reasons, amounts, and cancellation remarks.
3. **Rep_Stage:** Aggregates orders by their current workflow stage.
4. **Rep_Ord_Status:** Groups orders by overarching statuses (Pending, Dispatched, Cancelled, Archived).
5. **Rep_Pending:** Filters orders that have breached TAT or are currently awaiting action.
6. **Rep_Activity_Funnel:** Calculates conversion and flow rates between major stages (Order -> PI -> Dispatch -> Invoice).

## Target Architecture
- The SolidJS frontend will use Supabase queries to generate these aggregations dynamically.
- For heavy analytical queries (like `Rep_Activity_Funnel`), we will create **PostgreSQL Views** (e.g., `view_activity_funnel`, `view_pending_orders`) to offload the calculation from the frontend and ensure high performance.
