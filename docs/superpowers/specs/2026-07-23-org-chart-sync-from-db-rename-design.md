# Org Chart “Sync from DB” Rename Design

## Goal

Make the existing org-chart DB reconcile action clearer by renaming “Build from DB” to “Sync from DB”. Behavior stays the same.

## Context

`Build from DB` already syncs the open chart against live employees (`isArchived: false`):

- Refreshes employee fields from DB
- Drops people no longer active / in that office
- Adds newly active employees
- Preserves layout and connections
- If an office is focused/selected, only that office is updated

Users expected a separate Sync button; renaming removes the confusion.

## Approved design

UI copy changes in `components/tools/org-chart/OrgChartTool.tsx` only:

| Surface | New copy |
|---|---|
| Button label | Sync from DB |
| Button tooltip (`title`) | Sync active employees from DB. If an office is selected, only that office is updated. |
| Success toast title | Synced from DB |
| Success toast (office selected) | Selected office synced: inactive/removed people dropped; new active employees added. Layout kept. |
| Success toast (no office) | Chart synced from DB. Layout kept. |
| Error toast title | Failed to sync from DB |

Internal handler name `handleBuildFromDb` may stay or be renamed for consistency; no functional change required.

## Out of scope

- Reconcile logic (`lib/org-chart-reconcile.ts`)
- Preview / version APIs
- New Sync button or remove-only mode
- Auto-save of synced result as a new version

## Verification

- Manual: with an office selected, Sync still scopes to that office and shows the office-specific toast.
- Manual: without office selection, Sync updates the whole chart and shows the global toast.
- Update Unreleased changelog.
