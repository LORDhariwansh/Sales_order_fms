# TAT / SLA Engine Specification

## 1. Stage SLA Data Model

Each stage instance in the database will track the following fields. These are populated and mutated strictly via PostgreSQL triggers and RPCs using the authoritative server clock (`NOW()`).

- `planned_start`: Timestamp when the stage became ready/active.
- `planned_completion`: The calculated absolute deadline (`due_at`).
- `actual_start`: Timestamp when a user first interacts with the stage (e.g., opens the checklist).
- `actual_completion`: Timestamp when the stage transaction successfully commits.
- `due_at`: Semantic alias for `planned_completion`.
- `delay`: Interval difference between `actual_completion` and `planned_completion` (can be negative if early).
- `sla_status`: The dynamic state of the stage, evaluated at query time or via a materialized view.

---

## 2. SLA States

The engine relies on a strict state machine to evaluate SLA health:

- **NOT_STARTED:** Stage is created but upstream dependencies are not met.
- **IN_PROGRESS:** Dependencies met, `actual_start` is populated, but `actual_completion` is null.
- **ON_TIME:** Stage is completed and `actual_completion` <= `planned_completion`.
- **DUE_SOON:** Active stage where the server `CURRENT_TIMESTAMP` is within 1 business hour of `planned_completion`.
- **OVERDUE:** Active stage where server `CURRENT_TIMESTAMP` > `planned_completion`.
- **COMPLETED:** Stage successfully finished (a terminal state, can be combined with ON_TIME or OVERDUE for reporting).
- **CANCELLED:** Stage aborted due to an overarching order cancellation.
- **BLOCKED:** Stage cannot proceed because an assigned user is on leave, or a critical system error exists.

---

## 3. Working Time Configuration

Based on the workbook's `Settings`, `Holiday`, and `Doer Leave` sheets, TAT is NOT based on raw 24/7 calendar hours. The system uses strict business constraints:

- **Business Hours:** 10:00 AM to 08:00 PM (10 hours per day).
- **Working Days:** Monday through Saturday.
- **Weekends:** Sundays are completely excluded from the SLA clock.
- **Holidays:** Specific dates listed in the `holidays` configuration table are skipped.
- **Leave (Doer Leave):** If the assigned user (`doer_id`) has an active entry in `leave_records` for a given day, the SLA clock for their specific assigned stages pauses until they return, OR the task must be escalated/re-assigned to prevent SLA breaches.

---

## 4. Service Design: `calculateDeadline()`

This function acts as the core of the TAT Engine. It must be implemented as a PL/pgSQL Stored Procedure or a secure Supabase Edge Function.

**Inputs:**
- `startTime` (Timestamptz): The `actual_completion` timestamp of the blocking dependency.
- `TAT_hours` (Integer): The configured duration for the stage from `workflow_stages`.
- `holidayCalendar` (Array of Dates): Fetched dynamically from the `holidays` table.
- `workingSchedule` (Object): Preconfigured as `{ start: "10:00:00", end: "20:00:00", activeDays: [1,2,3,4,5,6] }`.
- `leaveRules` (Array of Date Ranges): Fetched from `leave_records` for the specific assigned user.

**Iterative Algorithm:**
1. **Initialize:** `currentTime = startTime`, `remainingHours = TAT_hours`.
2. **Bounds Alignment Check:** 
   - If `currentTime` is outside business hours (e.g., 9:00 PM), advance `currentTime` to 10:00 AM of the next valid working day.
3. **Evaluation Loop:** While `remainingHours > 0`:
   - **Check Weekend:** If `currentTime` falls on a Sunday (`EXTRACT(DOW) = 0`), advance `currentTime` to Monday 10:00 AM.
   - **Check Holidays:** If `DATE(currentTime)` exists in `holidayCalendar`, advance `currentTime` to the next day at 10:00 AM.
   - **Check Leave:** If `DATE(currentTime)` overlaps with the user's `leaveRules`, advance `currentTime` to the next day at 10:00 AM (and optionally flag for MIS reassignment).
   
   - If the day is valid and working:
     - Calculate available hours left in the current business day (`20:00:00 - TIME(currentTime)`).
     - **If** `remainingHours <= availableHours`:
       - `deadline = currentTime + remainingHours`
       - `remainingHours = 0` (Break loop)
     - **Else**:
       - `remainingHours = remainingHours - availableHours`
       - Advance `currentTime` to 10:00 AM of the next valid working day.
4. **Return:** The resulting `deadline` timestamp is securely saved as `planned_completion`.

---

## 5. Security & Integrity Policies

- **No Client-Side Authority:** SolidJS components are strictly prohibited from calculating, mutating, or submitting the `planned_completion` time. 
- **Read-Only Timestamps:** The client receives the `due_at` timestamp purely for rendering localized UI countdowns.
- **Server Authority:** Only the PostgreSQL database triggers or Edge Functions can calculate the deadline. `actual_completion` is automatically stamped by the DB upon transaction commit, entirely ignoring any timestamps provided by the browser payload.
