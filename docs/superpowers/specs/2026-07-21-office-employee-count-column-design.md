# Office Employee Count Column Design

## Goal

Show active and archived employee counts for each assigned office in one Offices table column.

## Behavior

- The column title is `Employees`.
- Values render as `Active | Archived`.
- Active is green and archived is red.
- Accessible text identifies both values without relying on color.
- Employees are counted by their current assigned office, whether or not they have a plantilla position.
- Counts update through the existing workforce SWR and Pusher invalidation flow.

## Architecture

Extend the existing workforce metrics with assigned active and archived employee counts. Fetch all department employees in the workforce summary route, count each by assigned office, and preserve existing plantilla/cross-office rules by excluding archived or unlinked employees only from those calculations.
