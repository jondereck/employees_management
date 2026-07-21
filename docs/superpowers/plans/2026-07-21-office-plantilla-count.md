# Office Plantilla Count Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sortable Offices-table column showing each office's total number of plantilla positions.

**Architecture:** Extend the existing server-rendered Prisma office query with a relation `_count`, map that value into the existing `OfficesColumn` DTO, and render it through the current TanStack table configuration. No new endpoint, client request, schema change, or dependency is needed.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma 5, TanStack React Table 8, Node test runner via `tsx`.

## Global Constraints

- Count all `PlantillaPosition` rows related to an office, including vacant and inactive positions.
- Display `0` for an office with no plantilla positions.
- Label the column **Total Plantilla** and sort it numerically.
- Preserve existing office search, pagination, column visibility, and row actions.
- Add an Unreleased entry to `CHANGELOG.md` and set `Last updated` to `2026-07-21`.
- Do not create a git commit unless the user explicitly requests one.

---

## File Structure

- `app/(dashboard)/[departmentId]/(routes)/offices/page.tsx`: fetch and map each office's plantilla relation count.
- `app/(dashboard)/[departmentId]/(routes)/offices/components/columns.tsx`: type and display the new numeric column.
- `tests/offices-columns.test.ts`: verify the table exposes a sortable Total Plantilla accessor.
- `CHANGELOG.md`: record the completed feature.

### Task 1: Add and verify the Total Plantilla column

**Files:**
- Create: `tests/offices-columns.test.ts`
- Modify: `app/(dashboard)/[departmentId]/(routes)/offices/page.tsx:11-29`
- Modify: `app/(dashboard)/[departmentId]/(routes)/offices/components/columns.tsx:14-79`
- Modify: `CHANGELOG.md:1-8`

**Interfaces:**
- Consumes: Prisma relation `Offices.plantillaPositions` and generated relation count `_count.plantillaPositions: number`.
- Produces: `OfficesColumn.plantillaCount: number` and a TanStack column with `accessorKey: "plantillaCount"`.

- [ ] **Step 1: Write the failing column test**

Create `tests/offices-columns.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { columns } from "../app/(dashboard)/[departmentId]/(routes)/offices/components/columns";

test("offices table exposes a sortable Total Plantilla column", () => {
  const column = columns.find(
    (candidate) =>
      "accessorKey" in candidate && candidate.accessorKey === "plantillaCount",
  );

  assert.ok(column);
  assert.equal(column.enableSorting, true);
  assert.equal(column.sortingFn, "basic");
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
npx tsx --test tests/offices-columns.test.ts
```

Expected: FAIL because no `plantillaCount` column exists.

- [ ] **Step 3: Fetch and map the Prisma relation count**

In `app/(dashboard)/[departmentId]/(routes)/offices/page.tsx`, extend the existing include:

```ts
include: {
  billboard: true,
  _count: {
    select: {
      plantillaPositions: true,
    },
  },
},
```

Add the mapped DTO property:

```ts
plantillaCount: item._count.plantillaPositions,
```

Because this relation count has no `where` filter, it includes both active and inactive positions; occupancy does not affect the count.

- [ ] **Step 4: Type and render the numeric column**

In `components/columns.tsx`, add this property to `OfficesColumn`:

```ts
plantillaCount: number;
```

Insert the column after **Bio Index Code** and before **Date**:

```tsx
{
  accessorKey: "plantillaCount",
  header: ({ column }) => (
    <DataTableColumnHeader column={column} title="Total Plantilla" />
  ),
  cell: ({ row }) => row.original.plantillaCount,
  sortingFn: "basic",
  enableSorting: true,
},
```

Prisma returns `0` for an empty relation count, so no fallback or loading state is required.

- [ ] **Step 5: Run the focused test and verify it passes**

Run:

```powershell
npx tsx --test tests/offices-columns.test.ts
```

Expected: one passing test and zero failures.

- [ ] **Step 6: Update the changelog**

In `CHANGELOG.md`, change:

```md
**Last updated: 2026-07-21**
```

Add this as the first entry under `## Unreleased`:

```md
- 2026-07-21 — feat: Offices table shows sortable total plantilla count per office
```

- [ ] **Step 7: Run full verification**

Run:

```powershell
npm test
npx tsc --noEmit
```

Expected: all tests pass and TypeScript exits with no errors.

- [ ] **Step 8: Review the final diff**

Run:

```powershell
git diff -- "app/(dashboard)/[departmentId]/(routes)/offices/page.tsx" "app/(dashboard)/[departmentId]/(routes)/offices/components/columns.tsx" "tests/offices-columns.test.ts" "CHANGELOG.md"
```

Expected: only the Prisma relation count, DTO/column updates, focused test, and changelog entry appear. Do not commit unless explicitly requested.
