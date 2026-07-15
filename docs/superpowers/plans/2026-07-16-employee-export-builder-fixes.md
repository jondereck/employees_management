# Employee Export Builder Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist Employee Export Builder templates in Postgres via dedicated CRUD APIs (per Clerk user + department), migrate once from localStorage, and polish Export Options UI (hover descriptions, remove Expand/Shrink, fix Order drag vs scroll).

**Architecture:** New `EmployeeExportTemplate` Prisma model stores `name`/`description` plus JSON `config`. REST under `/api/[departmentId]/export-templates`. Client helpers replace localStorage CRUD for the live picker; one-time per-department migrate when DB is empty. UI fixes land in `download-button.tsx`.

**Tech Stack:** Next.js App Router, Clerk auth, Prisma + Postgres, Zod, `@dnd-kit/*`, existing toast/`ActionTooltip` patterns.

## Global Constraints

- Ownership: templates scoped to Clerk `userId` + `departmentId` only (never shared across users).
- Duplicate template names allowed.
- Migrate from `hrps.userTemplates` only when DB list length is 0 for that user+dept; flag `hrps.userTemplates.migrated.<departmentId>`; clear LS templates after success.
- Keep JSON import/export (`__kind__: "hrps.export.templates"`); import creates via API.
- Order persistence = `selectedKeys` order (do not rely on `columnOrder`).
- Auth: require Clerk `userId`; verify department exists for that owner with `prisma.department.findFirst({ where: { id: departmentId, userId } })` like `app/api/[departmentId]/employees/route.ts`.
- Update `CHANGELOG.md` Unreleased + **Last updated** on each task that lands user-visible/code changes.
- Do not wire unused `components/export-modal/` extract.
- Commit after each task; do not push unless asked.

## File structure

| File | Responsibility |
|------|----------------|
| `prisma/schema.prisma` | `EmployeeExportTemplate` model + `Department` relation |
| `prisma/migrations/...` | SQL migration |
| `lib/export-template-config.ts` | Shared Zod config schema + map row ↔ DTO (server-safe) |
| `app/api/[departmentId]/export-templates/route.ts` | GET list, POST create |
| `app/api/[departmentId]/export-templates/[templateId]/route.ts` | PATCH, DELETE |
| `utils/export-templates-api.ts` | Client fetch helpers + migrate + import via API |
| `utils/export-templates.ts` | Keep types, last-used/recent, JSON blob shape helpers; LS CRUD kept only for migrate source read / legacy |
| `components/download-button.tsx` | Wire API, migrate on open, UI polish |
| `components/ui/export-template-picker.tsx` | Async delete/clear if needed (loading props) |
| `CHANGELOG.md` | Unreleased notes |

---

### Task 1: Prisma model + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: migration via `npx prisma migrate dev`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Produces: Prisma model `EmployeeExportTemplate` with fields `id`, `departmentId`, `userId`, `name`, `description?`, `config Json`, `createdAt`, `updatedAt`; indexes `[departmentId, userId]` and `[departmentId, userId, updatedAt]`; relation on `Department.employeeExportTemplates`.

- [ ] **Step 1: Add model to schema**

Add to `Department` relations:

```prisma
employeeExportTemplates EmployeeExportTemplate[]
```

Add model:

```prisma
model EmployeeExportTemplate {
  id           String     @id @default(cuid())
  departmentId String
  userId       String
  name         String
  description  String?
  config       Json
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  department   Department @relation(fields: [departmentId], references: [id], onDelete: Cascade)

  @@index([departmentId, userId])
  @@index([departmentId, userId, updatedAt])
}
```

- [ ] **Step 2: Run migrate**

```bash
npx prisma migrate dev --name employee_export_templates
npx prisma generate
```

Expected: migration applied; client regenerated.

- [ ] **Step 3: Changelog + commit**

```text
- YYYY-MM-DD — feat: EmployeeExportTemplate Prisma model for saved export layouts
```

```bash
git add prisma CHANGELOG.md
git commit -m "feat: add EmployeeExportTemplate model"
```

---

### Task 2: API routes (CRUD)

**Files:**
- Create: `lib/export-template-config.ts`
- Create: `app/api/[departmentId]/export-templates/route.ts`
- Create: `app/api/[departmentId]/export-templates/[templateId]/route.ts`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: Prisma `EmployeeExportTemplate`
- Produces HTTP:
  - `GET /api/[departmentId]/export-templates` → `{ items: ExportTemplateDto[] }`
  - `POST` body `{ name, description?, config }` → `ExportTemplateDto` (201)
  - `PATCH /[templateId]` body `{ name?, description?, config? }` → `ExportTemplateDto`
  - `DELETE /[templateId]` → `{ ok: true }`
- `ExportTemplateDto`: flatten `id`, `name`, `description`, `createdAt`, `updatedAt`, plus fields from `config` (`selectedKeys` required).

- [ ] **Step 1: Shared Zod + mappers in `lib/export-template-config.ts`**

```ts
import { z } from "zod";

export const exportTemplateConfigSchema = z
  .object({
    selectedKeys: z.array(z.string().min(1)).min(1).max(200),
    statusFilter: z.enum(["all", "active", "retired"]).optional(),
    appointmentFilters: z.union([z.array(z.string()), z.literal("all")]).optional(),
    idColumnSource: z.string().optional(),
    positionReplaceRules: z.array(z.unknown()).optional(),
    paths: z.record(z.unknown()).optional(),
    sheetName: z.string().optional(),
    templateVersion: z.number().optional(),
    officesSelection: z.array(z.string()).optional(),
    sheetMode: z.enum(["perOffice", "merged", "plain"]).optional(),
    sortLevels: z.array(z.unknown()).optional(),
    filterGroupMode: z.enum(["office", "bioIndex"]).optional(),
    headsMode: z.unknown().optional(),
    __version__: z.number().optional(),
  })
  .passthrough();

export const createExportTemplateBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  config: exportTemplateConfigSchema,
});

export const patchExportTemplateBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).optional().nullable(),
    config: exportTemplateConfigSchema.optional(),
  })
  .refine((v) => v.name !== undefined || v.description !== undefined || v.config !== undefined, {
    message: "At least one of name, description, config is required",
  });
```

Map row → DTO by spreading `(config as object)` under `id/name/description/createdAt/updatedAt` (ISO strings). Strip ownership fields from config if present.

- [ ] **Step 2: Implement GET/POST route**

Pattern from employees route: `auth()`, require `userId`, check department ownership, then query/create with `userId` + `departmentId`. Order list by `updatedAt desc`.

- [ ] **Step 3: Implement PATCH/DELETE route**

`findFirst` where `{ id: templateId, departmentId, userId }`; if missing → 404. Update only provided fields. Delete same filter.

- [ ] **Step 4: Changelog + commit**

```text
- YYYY-MM-DD — feat: export-templates REST API (list/create/update/delete)
```

```bash
git add lib/export-template-config.ts app/api/[departmentId]/export-templates CHANGELOG.md
git commit -m "feat: add export-templates CRUD API"
```

---

### Task 3: Client API helpers + migrate + import/export via API

**Files:**
- Create: `utils/export-templates-api.ts`
- Modify: `utils/export-templates.ts` (export `getUserTemplates` / migrate helpers as needed; add `isLocalTemplatesMigrated`, `markLocalTemplatesMigrated`, `clearLocalUserTemplatesStorage`)
- Modify: `CHANGELOG.md`

**Interfaces:**
- Produces:
  - `fetchExportTemplates(departmentId: string): Promise<ExportTemplate[]>`
  - `createExportTemplate(departmentId, { name, description?, ...configFields }): Promise<ExportTemplate>`
  - `updateExportTemplate(departmentId, id, patch): Promise<ExportTemplate>`
  - `deleteExportTemplate(departmentId, id): Promise<void>`
  - `clearAllExportTemplates(departmentId, ids: string[]): Promise<void>` — sequential DELETE
  - `migrateLocalTemplatesIfNeeded(departmentId): Promise<{ migrated: number; skipped: boolean }>`
  - `importTemplatesViaApi(departmentId, obj): Promise<{ added; skipped }>` — POST each valid template (ignore old ids; server generates new)
  - `templatesToExportBlob(templates: ExportTemplate[]): Blob` — same `__kind__` payload

Migrate algorithm (exact):
1. If `localStorage['hrps.userTemplates.migrated.' + departmentId] === '1'` → `{ migrated: 0, skipped: true }`
2. `GET` DB list
3. Read LS via `getUserTemplates()`
4. If LS empty → set flag → return
5. If DB length > 0 → set flag (leave LS) → return
6. Else POST each LS template’s name/description/config; on any failure throw/return without setting flag
7. On full success: set flag, `setUserTemplates([])`, remap last-used/recent if possible else clear last-used

- [ ] **Step 1: Implement `utils/export-templates-api.ts`**
- [ ] **Step 2: Add migrate flag helpers on `utils/export-templates.ts`**
- [ ] **Step 3: Changelog + commit**

```text
- YYYY-MM-DD — feat: client helpers for DB export templates + LS migrate
```

```bash
git add utils/export-templates-api.ts utils/export-templates.ts CHANGELOG.md
git commit -m "feat: add export template API client and migrate helper"
```

---

### Task 4: Wire Export Builder to DB CRUD

**Files:**
- Modify: `components/download-button.tsx`
- Modify: `components/ui/export-template-picker.tsx` (async-friendly callbacks: `deleteUserTemplate` / `clearAllUserTemplates` may return `void | Promise<void>`)
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes Task 3 helpers
- On `modalOpen` become true with `departmentId`: run migrate then `fetchExportTemplates` into `templates` state; set `templatesLoading`
- Save new / overwrite / rename / delete / clear-all / import / export use API
- Keep `rememberTemplateUsage` / last-used in LS against DB ids
- Toasts on error; disable picker actions while loading/saving

- [ ] **Step 1: Replace LS CRUD calls in save/overwrite/rename/delete/clear/import/export**
- [ ] **Step 2: Load + migrate when modal opens**
- [ ] **Step 3: Update picker prop types for async delete/clear**
- [ ] **Step 4: Changelog + commit**

```text
- YYYY-MM-DD — feat: Employee Export Builder saves templates to DB
```

```bash
git add components/download-button.tsx components/ui/export-template-picker.tsx CHANGELOG.md
git commit -m "feat: wire Export Builder templates to database CRUD"
```

---

### Task 5: UI polish (hover descriptions, remove expand, drag/scroll)

**Files:**
- Modify: `components/download-button.tsx`
- Modify: `CHANGELOG.md`

**Requirements:**
1. Wrap each Export Options tab `Button` in `ActionTooltip` with `EXPORT_TAB_DESCRIPTIONS[tab.key]`; remove the always-visible `<span>` description under the label; tighten button height (`min-h-10` / single-line).
2. Remove `modalSize` state, `toggleModalSize`, Expand/Shrink button, and `export.modalSize` persistence; use fixed `MODAL_WIDTH_CLASSES.roomy` (or current default width class).
3. DnD: activation distance ≥ 10px on PointerSensor; keep listeners only on grip (already); add `restrictToParentElement` (from `@dnd-kit/modifiers`) alongside `restrictToVerticalAxis`; set `autoScroll={false}` (or `{ enabled: false }`); keep list in `max-h` overflow container.

- [ ] **Step 1: Hover-only tab descriptions**
- [ ] **Step 2: Remove Expand/Shrink**
- [ ] **Step 3: Fix Order drag vs scroll**
- [ ] **Step 4: Changelog + commit**

```text
- YYYY-MM-DD — ui: Export Builder hover tab hints, fixed modal size, stabler column order drag
```

```bash
git add components/download-button.tsx CHANGELOG.md
git commit -m "ui: polish Export Builder options and column order drag"
```

---

## Manual test plan (after Task 5)

1. Open Export Builder → templates load from API; no Expand/Shrink; tab descriptions on hover only.
2. Save template → reload page / other browser → template still there (same user+dept).
3. Overwrite, rename, delete work; another Clerk user does not see them.
4. Browser with old `hrps.userTemplates` and empty DB → migrate once; reopen does not duplicate.
5. JSON export/import via header buttons.
6. Order tab: scroll list without reordering; drag grip to reorder.

## Spec coverage check

| Spec item | Task |
|-----------|------|
| Prisma model + indexes | 1 |
| REST CRUD + Zod + auth | 2 |
| Client API + migrate + JSON IO | 3 |
| Wire modal/picker | 4 |
| Hover descriptions | 5 |
| Remove Expand/Shrink | 5 |
| Drag/scroll fix | 5 |
| Duplicate names allowed | 2 (no unique on name) |
| Per user+dept | 2 |
| Keep JSON import/export | 3–4 |
