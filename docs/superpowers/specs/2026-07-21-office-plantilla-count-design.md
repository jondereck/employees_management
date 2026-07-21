# Office Plantilla Count Design

## Goal

Show the total number of plantilla positions assigned to each office in the Offices table.

## Behavior

- Add a sortable **Total Plantilla** column to the Offices table.
- Count every `PlantillaPosition` related to the office, including vacant and inactive positions.
- Display `0` when an office has no plantilla positions.
- Preserve the existing office search, pagination, column visibility, and row actions.

## Data Flow

Extend the existing server-side `prismadb.offices.findMany` query with Prisma's relation `_count` for `plantillaPositions`. Map the count into the `OfficesColumn` row DTO as `plantillaCount`, then render it through the existing TanStack table column configuration.

This keeps the page to one database query and avoids client-side API requests.

## Files

- `app/(dashboard)/[departmentId]/(routes)/offices/page.tsx`: request and map the relation count.
- `app/(dashboard)/[departmentId]/(routes)/offices/components/columns.tsx`: add the typed, sortable column.
- `CHANGELOG.md`: record the feature and update the last-updated date.

## Verification

- Run the relevant type/build checks.
- Confirm offices with no items show `0`.
- Confirm offices with vacant or inactive items include those items in the total.
- Confirm the new column sorts numerically.
