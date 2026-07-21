# Bulk Office Deletion Reassignment Design

## Goal

Replace per-employee destination controls in the office deletion modal with one office and optional division selection applied to every affected employee.

## Behavior

- A destination office is required when employees are affected.
- The destination division is optional and appears only when the selected office has divisions.
- The selected office applies to every affected employee.
- The selected division applies only to employees whose affected relationships include `assigned`.
- Employee cards remain visible as read-only context, including relationship and archived badges.
- Changing the destination office clears the selected division.

## Data Flow

The client expands the single selection into the existing per-employee reassignment payload. The existing DELETE endpoint continues validating every employee, destination office, and assigned employee division, so no API contract or database behavior changes.

## Verification

A pure helper test covers payload expansion, including assigned and non-assigned employees. Focused tests, TypeScript, and lint verify the UI integration.
