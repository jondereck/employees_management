# Employee Export Builder fixes

**Date:** 2026-07-16  
**Status:** Approved for implementation planning  
**Scope:** DB CRUD for export templates + three UI polish fixes  
**Approach:** Dedicated Prisma model + REST CRUD (per user + department); localStorage auto-migrate once

## Goal

Improve the Employee Export Builder so saved templates persist in the database (sync across devices/browsers for the same Clerk user in a department), and clean up three usability issues: always-visible option descriptions, modal Expand/Shrink control, and unreliable column-order drag when the list scrolls.

## Non-goals

- Built-in shared system templates (list remains empty / reserved IDs only).
- Department-wide shared templates (other users do not see each other’s templates).
- Cross-department template sharing for the same user.
- Finishing or wiring the unused `components/export-modal/` extract (work stays in live `download-button.tsx` + helpers unless a small extract clearly helps).
- Changing Excel generation logic beyond reading the same template config shape.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Ownership | Per Clerk `userId` + `departmentId` |
| Storage | Dedicated Prisma model (not analyzer-settings blob) |
| Names | Duplicate names allowed (same as current localStorage behavior) |
| Migration | Auto-migrate `hrps.userTemplates` once → DB, then DB is source of truth |
| JSON import/export | Keep (import creates via API; export downloads from current user list) |
| Descriptions | Hover/tooltip only on Export Options tabs |
| Expand/Shrink | Remove; fixed modal width |
| Drag/order | Fix activation + scroll isolation so scroll does not fake reorder |

---

## §1 — Data model & API

### Prisma model

```prisma
model EmployeeExportTemplate {
  id           String     @id @default(cuid())
  departmentId String
  userId       String
  name         String
  description  String?
  config       Json       // ExportTemplate payload without id/name/description ownership fields
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  department   Department @relation(fields: [departmentId], references: [id], onDelete: Cascade)

  @@index([departmentId, userId])
  @@index([departmentId, userId, updatedAt])
}
```

**`config` JSON** stores the existing client template fields needed to restore the builder state, aligned with `ExportTemplate` in `utils/export-templates.ts`:

- Required: `selectedKeys: string[]`
- Optional (as today): `statusFilter`, `appointmentFilters`, `idColumnSource`, `positionReplaceRules`, `paths`, `sheetName`, `templateVersion`, `officesSelection`, `sheetMode`, `sortLevels`, `filterGroupMode`, `headsMode`, `__version__`
- Do **not** rely on `columnOrder` for save/load; order is the order of `selectedKeys` (current save behavior).
- `id` / `name` / `description` live on the row (API may echo them in the response DTO).

### API routes

Base: `/api/[departmentId]/export-templates`

| Method | Path | Action |
|--------|------|--------|
| `GET` | `/` | List templates for `auth().userId` in that department |
| `POST` | `/` | Create template |
| `PATCH` | `/[templateId]` | Rename and/or overwrite `config` / `description` |
| `DELETE` | `/[templateId]` | Hard delete |

**Auth / tenancy**

- Require Clerk `userId`; reject unauthenticated.
- Verify department access with the same pattern used by other department-scoped APIs.
- All queries filter `departmentId` + `userId`; never return another user’s templates.
- `PATCH` / `DELETE` only if row belongs to current user + department (404 otherwise; no existence leak across users).

**Validation (Zod)**

- `name`: non-empty string, max length 120.
- `description`: optional string, max length 500.
- `config`: object with `selectedKeys` as non-empty `string[]` (max column count consistent with registry size, e.g. ≤ 200).
- Other config fields: soft-validate known keys; ignore unknown keys forward-compatibly.

**Response DTO** (list item / single):

```ts
{
  id: string;
  name: string;
  description?: string | null;
  selectedKeys: string[];
  // …flattened optional ExportTemplate fields from config…
  createdAt: string;
  updatedAt: string;
}
```

Client continues to treat templates as `ExportTemplate`-shaped; mapping lives in a small API client helper.

### localStorage migration

Keys involved:

- `hrps.userTemplates` — source array
- New flag: `hrps.userTemplates.migrated` (or per-department: `hrps.userTemplates.migrated.<departmentId>`)

**Algorithm (client, once per department)**

1. On Export Builder open (authenticated, department known): if migrate flag for this department is set → skip.
2. Else `GET` templates. If `hrps.userTemplates` is empty → set flag and skip.
3. If LS has templates:
   - Prefer migrate when DB list is empty for this user+dept; if DB already has templates, still migrate LS items that are not already present by matching `name` + same `selectedKeys` signature (skip duplicates), or simpler: if DB non-empty, **skip bulk migrate** and only set flag (avoid doubles after partial runs). **Chosen rule:** migrate only when DB list length is 0; otherwise mark migrated and leave LS as unread legacy.
4. `POST` each LS template (use server-generated `id`; do not force old client ids if cuid conflicts — map old→new id in memory for “last used” if needed).
5. On full success: set migrate flag; clear `hrps.userTemplates` (or leave emptied array). Keep `hrps.export.template` / recent ids only if they resolve to new ids; otherwise clear last-used.
6. On partial failure: toast error; do not set flag; retry next open.

**Still localStorage (unchanged prefs, not templates):** sheet mode, offices selection, sort levels, column checkbox prefs, filter group mode, etc., unless already part of a saved template’s `config`.

### JSON import / export

- Export file format stays `__kind__: "hrps.export.templates"`.
- Export downloads the **current DB-backed** list for the user.
- Import parses file → `POST` each template via API (same validation); refresh list; toast counts.

---

## §2 — UI fixes

Primary file: `components/download-button.tsx` (plus `components/ui/export-template-picker.tsx` for template actions).

### 2.1 Export option descriptions → hover only

- Today: `EXPORT_TAB_DESCRIPTIONS` render as visible subtitle under each Export Options tab button (`hidden` only on very small screens).
- Change: remove inline description text from the tab button layout.
- Show the same string via existing tooltip pattern (`ActionTooltip` or equivalent) on hover/focus of the tab control.
- No change to tab labels/icons/behavior.

### 2.2 Remove Expand / Shrink

- Remove header toolbar control that cycles `modalSize` (`cozy` → `roomy` → `xl`).
- Use a single fixed width class (current default / `roomy` equivalent).
- Stop reading/writing `export.modalSize` in this modal.
- Show/Hide for the Export Options panel remains (separate control).

### 2.3 Column Order drag vs scroll

Problem: dragging in the Order list causes the scrollable area to move and/or overly eager collision detection, so items reorder unintentionally.

**Fixes (combine):**

1. Drag only from the **grip handle** (if not already exclusive — ensure the row body / scrollbar do not start a drag).
2. Increase pointer activation distance (approximately 8–12px) so slight movement while scrolling does not activate sortable.
3. Put the order list in a dedicated overflow container; apply dnd-kit modifiers `restrictToVerticalAxis` and parent restriction so the drag stays within the list.
4. Tune `autoScroll`: reduce aggression or disable auto-scroll during reorder if it still causes jump-reorders after (1)–(3).
5. Keep `DragOverlay` ghost for clarity.

Success criteria: wheel/trackpad scroll moves the list without changing order; reorder happens only when the user drags the handle across items.

---

## §3 — Client wiring

### Data access layer

- Keep types and JSON blob helpers in `utils/export-templates.ts`.
- Replace production use of `saveTemplateToLocalStorage`, `overwriteUserTemplateById`, `renameUserTemplateById`, `deleteUserTemplate`, `getUserTemplates` (for the live picker) with API-backed functions, e.g. in `utils/export-templates-api.ts` or adjacent:
  - `fetchExportTemplates(departmentId)`
  - `createExportTemplate(departmentId, input)`
  - `updateExportTemplate(departmentId, id, patch)`
  - `deleteExportTemplate(departmentId, id)`
- Picker + modal: load on open; after create/overwrite/rename/delete await API then refresh list (or patch local state from response).
- Errors: toast with server message when available; do not silently fall back to LS for saves after migration.

### Last-used / recent

- Prefer storing last-used template id in localStorage still (`hrps.export.template`), but resolve against DB list; if missing, clear selection.
- Recent ids list: same; prune ids not in DB list.

### UI states

- Loading: disable template select / show lightweight loading on template bar while first fetch runs.
- Empty: existing empty state copy (“no saved templates”).
- Saving: disable save/overwrite buttons while request in flight.

---

## Error handling

| Case | Behavior |
|------|----------|
| Unauthenticated API | 401; client toast + no migrate |
| Wrong department / other user’s id | 404 |
| Validation failure | 400 with field errors |
| Migrate POST fails mid-batch | Stop; no migrate flag; toast; retry next open |
| Network error on save | Toast; keep editor state so user can retry |

## Testing (manual)

1. Save new template → appears after reload / other browser session (same user + dept).
2. Overwrite, rename, delete → reflected in DB list only for that user.
3. Fresh browser with old `hrps.userTemplates` → one-time migrate when DB empty; second open does not duplicate.
4. JSON export/import round-trip via API.
5. Export Options: descriptions only on hover; no Expand/Shrink button; modal width stable.
6. Column Order: scroll without reorder; intentional handle drag reorders correctly.

## Files likely touched

- `prisma/schema.prisma` (+ migration)
- `app/api/[departmentId]/export-templates/route.ts`
- `app/api/[departmentId]/export-templates/[templateId]/route.ts`
- `utils/export-templates.ts` (trim LS write path for live CRUD)
- new API client helper (optional file)
- `components/download-button.tsx`
- `components/ui/export-template-picker.tsx`
- `CHANGELOG.md`

## Out of scope follow-ups

- Department-shared template library
- Server-side default templates
- Completing `components/export-modal/` refactor
