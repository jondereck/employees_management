# Dashboard Employee Movements Design

## Goal

Replace the single-purpose **New Hires This Month** metric with one compact **Employee Movements** card covering hires, promotions, and separations for the current Manila calendar month.

## Card

- Title: **Employee Movements**
- Primary value: total movement count, calculated as hires + promotions + separations.
- Show three compact breakdowns: **Hired**, **Promoted**, and **Separated**.
- Use an indigo movement icon and matching light/dark border.
- Preserve the current top-grid position, equal height, glass styling, responsive behavior, keyboard activation, and visible focus ring.
- Clicking the card opens the movement-details modal even when every count is zero.

## Data definitions

- **Hired:** employees whose `Employee.dateHired` falls within the current calendar month, including employees later archived during the same month.
- **Promoted:** non-deleted `EmploymentEvent` rows with type `PROMOTED` and `occurredAt` within the month.
- **Separated:** non-deleted `EmploymentEvent` rows with type `TERMINATED` and `occurredAt` within the month.
- Month boundaries use `Asia/Manila` and are converted to UTC for Prisma range queries.
- A person may appear in more than one category. Counts represent movements, not unique employees.
- Sort each category by effective date descending, then employee name.

## Modal

- Title: **Employee Movements**
- Description shows the current month and total movements.
- Provide three accessible tabs/toggles with count badges: Hired, Promoted, and Separated.
- Each row shows employee name, office, position, movement date, and event details when available.
- Clicking a row opens `/{departmentId}/employees/{employeeId}`.
- Each category has its own clear empty state.
- Keep the header/tabs visible while only the movement list scrolls.
- Preserve Radix dialog focus trapping, Escape/overlay dismissal, close control, and focus restoration.

## Architecture

1. Add a pure utility that builds Manila month UTC boundaries and serializes movement rows/summaries.
2. Add two focused Prisma queries to `getDashboardSummary`:
   - employees hired in the month;
   - promotion/separation events in the month, including employee office/profile fields.
3. Replace `newHires` with `employeeMovements` in `DashboardSummary`.
4. Replace the New Hires client card with a focused Employee Movements client component.
5. Keep all fetching server-side; client state controls only the selected modal category.

## Error and edge behavior

- Ignore deleted promotion/separation events.
- Invalid dates are excluded by range queries and guarded by the serializer.
- Blank names, offices, positions, or details use concise display fallbacks.
- Duplicate event records remain separate movements because they are separate timeline events.
- A zero-total card remains interactive and opens the Hired empty state by default.

## Verification

- Unit tests cover Manila month boundaries, category totals, sorting, overlaps, fallbacks, and deleted-event exclusion at the query contract.
- Source-contract tests cover Prisma filters, card replacement, counts, accessible category controls, row navigation, empty states, and responsive scrolling.
- Existing dashboard, Plantilla, compact-layout, and metric-border tests remain green.
- TypeScript and lint remain clean in changed files.
- Update the Unreleased changelog.

## Out of scope

- Transfers, reassignments, awards, and contract renewals.
- Historical month switching.
- Editing movement events from the dashboard modal.
- Database schema changes or new dependencies.
