# Dashboard New Hires Modal Design

## Goal

Replace the ambiguous **Active This Month** dashboard metric with an actionable **New Hires This Month** metric and an accessible employee-detail modal.

## Approved behavior

- The count represents non-archived employees whose official `Employee.dateHired` falls within the current calendar month and year in the `Asia/Manila` time zone.
- Use `dateHired`, not `createdAt` or `updatedAt`; editing an old employee must not increase the count.
- The metric retains the current emerald icon, border, equal-height layout, and responsive dashboard placement.
- The whole metric card is a button. Clicking or pressing Enter/Space opens a modal even when the count is zero.
- Remove the dashboard call to `getMonthlyEmployeeActivity`; this metric no longer represents created or updated records.

## Modal content

- Title: **New Hires This Month**
- Description identifies the displayed calendar month and year.
- Show the total count and a list sorted by newest hire date first, then employee name.
- Each row shows:
  - employee name;
  - office;
  - position;
  - formatted hire date.
- Clicking a row navigates to `/{departmentId}/employees/{employeeId}`.
- When no employees match, show **No new hires this month** and a short explanation.

## Responsive interaction

- Use the existing Radix-based dialog primitives for focus trapping, Escape dismissal, overlay dismissal, and focus restoration.
- Desktop uses a centered, compact dialog.
- Mobile uses a near-full-width dialog with a maximum viewport-relative height.
- Only the employee list scrolls when needed; the title and close control remain available.
- Interactive controls have visible focus states and at least a 44px touch target.
- The trigger has a descriptive accessible label including the count.

## Architecture and data flow

1. Extend `DashboardSummary` with a `newHires` summary containing `count`, `monthLabel`, and employee rows.
2. Reuse the existing active employee query in `getDashboardSummary`; add only the missing `position` field.
3. Filter hire dates by Manila calendar year and month, sort them, and map them into serializable modal rows.
4. Add a focused client component for the metric trigger and dialog. Keep data fetching on the server.
5. Render this component in the existing metric grid in place of `Active This Month`.

## Error and edge behavior

- Invalid dates are excluded rather than breaking the dashboard.
- Missing or blank office/position values display **Unassigned Office** or **Position not specified**.
- A zero count still opens the empty state so the interaction remains predictable.
- The existing dashboard error behavior remains unchanged if the server query itself fails.

## Verification

- Unit tests cover Manila month/year filtering, exclusion of archived or out-of-month records, sorting, and invalid dates.
- Source-contract/component tests verify the old activity metric is removed, the new summary is rendered, and the accessible dialog/list behavior exists.
- Existing compact-layout, metric-border, Plantilla, and workforce-composition tests remain green.
- TypeScript and lint remain clean in changed files.
- Update the Unreleased changelog.

## Out of scope

- Rehire detection based on `latestAppointment`.
- A dedicated filtered Employees route.
- Month switching or historical new-hire reporting inside the modal.
- Database schema changes.
