# Plantilla bulk paste create

**Date:** 2026-07-14  
**Status:** Approved
**Approach:** Option 1 — paste → preview → confirm create  
**Decisions:** Bulk create all lines (B); smart Status match with None + warning on miss (A)

## Goal

Allow HR to paste a multi-line list of plantilla rows (from Excel/Word/Sheets) into the Add plantilla dialog and create one `PlantillaPosition` per line in a single confirm action.

## Paste format

Each non-empty line supports **3 or 4 columns** (tab or 2+ spaces):

```
ItemNo <sep> Title <sep> SalaryGrade <sep> Status   (4 columns — ItemNo optional)
Title <sep> SalaryGrade <sep> Status                 (3 columns — no item number)
```

Examples (with item numbers):

```
12-1	Municipal Mayor	27	Elected
12-2	Sr. Admin. Assistant III (Private Sec. II)	15	Co-Terminus
12-3	Administrative Aide IV (Clerk II)	4	Co-Terminus
```

Examples (without item numbers):

```
Municipal Mayor	27	Elected
Sr. Admin. Assistant III (Private Sec. II)	15	Co-Terminus
Administrative Aide IV (Clerk II)	4	Co-Terminus
```

Parsing rules:

- Split lines on `\n` / `\r\n`; skip blank lines.
- **4 columns:** ItemNo | Title | SG (1–33) | Status — item numbers may include hyphens (e.g. `12-1`).
- **3 columns:** Title | SG | Status — `itemNumber` is `null` on each row.
- **3 columns with item:** ItemNo | Title | SG — status omitted.
- Separators: tab preferred; else 2+ consecutive spaces.
- Single line **without** a recognisable column split → normal Position title typing (no bulk mode).
- Empty / missing ItemNo column → `null` (Casual-style slots).
- Division / Active: use current dialog defaults (division selector + Active toggle apply to all pasted rows).
- Max **50** rows per paste.
- Duplicate item numbers within paste or in department are rejected on create.

## Status matching

- Normalize label and catalog names: lowercase; remove spaces, hyphens, underscores.
- Match against Employee Type `name`, then `value` if needed.
- No match → `employeeTypeId = null`, row flagged with warning in preview.
- Case-insensitive exact / normalized equality only (no fuzzy edit-distance in v1).

## UI

1. **Add plantilla item** dialog (create only; not edit).
2. User pastes into **Position title** (or a clearly labelled paste-aware control in that field area).
3. If bulk paste detected → switch dialog body to a **preview table**: Item No. | Title | SG | Status | Notes.
4. Unmatched statuses show a short note (e.g. “Status not found → None”).
5. **Confirm** creates all rows; **Back** returns to normal form (optional: keep parsed rows in memory).
6. Success toast: e.g. `Created 3 · 1 status unmatched (set to None)`.
7. Errors (validation / API): stay on preview; show toast above modal (existing z-index).

Quantity stepper remains for identical multi-create of a **single** title; bulk paste is the path for **different** titles. Do not combine quantity × pasted list in v1.

## API

- Prefer extending `POST /api/[departmentId]/offices/[officeId]/plantilla` with:

  ```ts
  { items: Array<{ itemNumber?, title, salaryGrade?, employeeTypeId?, officeDivisionId?, isActive? }> }
  ```

  — or a dedicated `POST .../plantilla/bulk` if the single-item contract stays cleaner.
- Server: validate each row (reuse `normalizePlantillaInput`), resolve/re-check employee types belong to department, create in one `$transaction`.
- Cap: reject if `items.length > 50` or empty.
- Response: `{ count, items, warnings?: string[] }` (e.g. how many statuses were unmatched — client may already know; server can omit match warnings if client resolved IDs).

Client resolves Status → `employeeTypeId` before POST so bulk payload stays id-based; parser helpers live in `lib/plantilla.ts` (pure + unit tested).

## Out of scope

- Division column in paste
- Edit-dialog paste
- Fuzzy status matching beyond normalize-equality
- Creating missing Employee Types from paste
- Raising identical-quantity max (still 10) for non-paste flow

## Implementation sketch

- `lib/plantilla.ts`: `parsePlantillaPaste`, `matchEmployeeTypeId`, `MAX_PLANTILLA_PASTE_ROWS`
- `tests/plantilla.test.ts`: paste parse + status match cases
- `office-plantilla-section.tsx`: paste detect → preview → confirm
- Plantilla POST (or `/bulk`): transactional multi-create
- `CHANGELOG.md` Unreleased line
