# TAT Specification

Turnaround Time (TAT) is calculated using the `Current Stage` sheet and the `Holiday` sheet.

## Calculation Logic
The TAT calculation heavily relies on:
- Excluding weekends (Sundays, dynamically parsed).
- Excluding specific dates listed in the `Holiday` sheet.
- Planned Dates are calculated by adding the TAT hours to the actual completion timestamp of the prerequisite stage, strictly within business hours.

## Business Hours (From Settings)
- **Start Time:** 10:00 AM 
- **End Time:** 08:00 PM 
- **Daily Working Hours:** 10 Hours

## Stage TATs
| Stage | TAT | Unit | Dependency | Calculation |
|---|---|---|---|---|
| Order Entry | 1 | Hrs | Form Submission | Timestamp + 1 Hr |
| PI Maker | 1 | Hrs | Order Entry | Order Entry Actual + 1 Hr |
| Pricelist | 1 | Hrs | Order Entry | Order Entry Actual + 1 Hr |
| Admin Approval | 1 | Hrs | PI Maker Actual | PI Maker Actual + 1 Hr |
| PI Checker | 2 | Hrs | Send PO | Send PO Actual + 2 Hrs |
| Dispatch | 1 | Hrs | RC Vehicle Actual | RC Vehicle Actual + 1 Hr |

*Target Architecture:* In Supabase, TAT should be calculated either via Postgres Functions/Triggers or an Edge Function using a dedicated `holidays` table and `working_hours` configuration.

## Ambiguities
- If a stage is rejected, does the TAT reset? **REQUIRES_CONFIRMATION**.
