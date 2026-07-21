# Dashboard Plantilla Card Design

## Goal

Replace the dashboard's top-level **Pending Approvals** metric card with one compact **Plantilla** card matching the user-approved balanced mockup. The card must show the department's active plantilla capacity without changing the other dashboard cards.

## Approved appearance

- Title: `Plantilla`
- Primary value: total active plantilla slots
- Secondary values on one row:
  - filled slots in emerald
  - vacant slots in amber
- A thin emerald occupancy progress bar
- Footer labels: `Occupancy` on the left and the percentage on the right
- Violet plantilla icon treatment and violet card border
- Keep the existing dashboard card height, rounded corners, glass background, spacing, dark-mode behavior, and responsive four-card grid.
- Use tabular numerals and the dashboard's `AnimatedNumber` treatment for total, filled, and vacant values; render occupancy as a stable formatted percentage.

The card links to `/{departmentId}/offices`, where the detailed workforce dashboard already exists.

## Data definition

Use the same definitions as the existing office workforce summary:

- **Total**: active plantilla positions in the department.
- **Filled**: active plantilla positions linked to a non-archived employee.
- **Vacant**: active slots minus filled slots.
- **Occupancy**: `filled / total * 100`, displayed with at most one decimal place.
- If total is zero, occupancy is `0%` and the progress bar remains empty.

This keeps dashboard totals consistent with the Offices workforce dashboard.

## Implementation approach

Extend `getDashboardSummary(departmentId)` with a `plantilla` summary object. Fetch the department's plantilla positions and only the employee fields needed for occupancy, then calculate totals through the existing `aggregateOfficeWorkforce` utility so business rules are not duplicated.

Create a focused dashboard `PlantillaMetricCard` presentation in the overview page rather than expanding the generic `MetricCard` API with plantilla-specific fields. Replace only the current Pending Approvals card in the top metric grid. Keep Pending Approvals in the existing Needs Attention panel so review work remains visible.

## Loading and error behavior

The dashboard remains server-rendered and continues using its existing aggregate `Promise.all` request. A database failure follows the dashboard's current route-level error handling. No separate client fetch, loading flash, or realtime subscription is added.

## Accessibility

- The complete card is one keyboard-focusable link to Offices.
- Filled and vacant states use text labels in addition to color.
- The progress bar exposes an accessible occupancy label and numeric value.
- Violet, emerald, and amber text must retain readable contrast in light and dark themes.

## Tests and verification

- Unit-test the plantilla totals and zero-total occupancy behavior at the summary/aggregation boundary.
- Verify the dashboard no longer renders the Pending Approvals top card.
- Verify the Needs Attention pending-approval row remains.
- Verify the Plantilla card links to the department Offices route.
- Run the relevant test suite, TypeScript check, and lint/build checks supported by the repository.
- Visually check desktop and narrow responsive layouts in light mode; confirm dark-mode classes remain consistent with existing cards.

## Out of scope

- Removing the Pending Approvals item from Needs Attention.
- Changing the Offices workforce dashboard.
- Adding a new API endpoint or realtime refresh to the overview.
- Adding plantilla drilldowns directly inside the compact card.
