# Dashboard Metric Card Borders Design

## Goal

Make the four dashboard metric cards visually consistent and make Total Employees navigable.

## Approved design

- Total Employees uses a blue border matching its icon and links to `/{departmentId}/employees`.
- Active This Month uses an emerald border matching its icon and remains non-clickable.
- Plantilla keeps its violet border and Offices link.
- Offices uses a cyan border matching its icon and remains linked to `/{departmentId}/offices`.
- Preserve equal heights, glass backgrounds, dark mode, responsive two/four-column grid, focus rings, and existing content.

## Implementation

Extend the generic `MetricCard` with a border class prop. Apply semantic border classes per card instead of changing the shared glass-card token. Add the Employees route to Total Employees.

## Verification

- Source contract verifies the three generic border colors and Total Employees link.
- Existing dashboard tests remain green.
- TypeScript and lint remain clean in changed files.
- Update the Unreleased changelog.
