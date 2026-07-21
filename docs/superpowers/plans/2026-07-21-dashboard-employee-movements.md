# Dashboard Employee Movements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the New Hires metric with a monthly Employee Movements card and modal covering hired, promoted, and separated employees.

**Architecture:** A pure utility owns Manila month boundaries, movement filtering, sorting, fallbacks, and event-detail parsing. `getDashboardSummary` performs two bounded Prisma queries, while a dedicated client card renders the summary with accessible Radix tabs inside the existing dialog.

**Tech Stack:** Next.js 14, React 18, TypeScript, Prisma, Tailwind CSS, Radix Dialog/Tabs, Node test runner.

## Global Constraints

- Hired uses `Employee.dateHired`, including employees archived later in the same month.
- Promoted uses non-deleted `EmploymentEvent` rows of type `PROMOTED`.
- Separated uses non-deleted `EmploymentEvent` rows of type `TERMINATED`.
- Month boundaries use `Asia/Manila` and Prisma UTC range filters.
- Total equals hired + promoted + separated movement counts; people may appear in multiple categories.
- Each category sorts by effective date descending, then employee name.
- Preserve dashboard grid order, equal height, responsiveness, dark mode, keyboard/focus behavior, and profile navigation.
- No dependencies, schema changes, commits, or unrelated cleanup.

---

### Task 1: Employee Movement Data Summary

**Files:**
- Create: `lib/dashboard-employee-movements.ts`
- Create: `tests/dashboard-employee-movements-summary.test.ts`
- Modify: `actions/get-dashboard-summary.ts`
- Delete: `lib/dashboard-new-hires.ts`
- Delete: `tests/dashboard-new-hires-summary.test.ts`

**Interfaces:**

```typescript
export type DashboardMovementInput = {
  id: string;
  employeeId: string;
  name: string;
  office: string | null;
  position: string | null;
  occurredAt: Date | string;
  details?: string | null;
  deletedAt?: Date | string | null;
};

export type DashboardMovementRow = {
  id: string;
  employeeId: string;
  name: string;
  office: string;
  position: string;
  dateLabel: string;
  details?: string;
  href: string;
};

export type DashboardMovementCategory = {
  count: number;
  employees: DashboardMovementRow[];
};

export type DashboardEmployeeMovementsSummary = {
  total: number;
  monthLabel: string;
  hired: DashboardMovementCategory;
  promoted: DashboardMovementCategory;
  separated: DashboardMovementCategory;
};

export function getManilaMonthUtcRange(now?: Date): {
  start: Date;
  end: Date;
  monthLabel: string;
};

export function buildDashboardEmployeeMovementsSummary(
  input: {
    hired: DashboardMovementInput[];
    promoted: DashboardMovementInput[];
    separated: DashboardMovementInput[];
  },
  departmentId: string,
  now?: Date,
): DashboardEmployeeMovementsSummary;
```

- [ ] Write failing tests first for:
  - July Manila boundaries: start `2026-06-30T16:00:00.000Z`, end `2026-07-31T16:00:00.000Z`;
  - December-to-January rollover;
  - category and total counts;
  - one employee appearing in more than one category;
  - deleted events and invalid dates excluded;
  - newest-first/name sorting;
  - office/position fallbacks;
  - JSON event details prefer description, then title; plain text and malformed JSON remain readable;
  - profile href and Manila-formatted date label.

- [ ] Run RED:

```powershell
npx tsx --test tests/dashboard-employee-movements-summary.test.ts
```

Expected: `MODULE_NOT_FOUND`.

- [ ] Implement month boundaries by extracting Manila year/month using `Intl.DateTimeFormat(...).formatToParts()`, then constructing UTC instants with the fixed Manila offset:

```typescript
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const start = new Date(Date.UTC(year, month - 1, 1) - MANILA_OFFSET_MS);
const end = new Date(Date.UTC(year, month, 1) - MANILA_OFFSET_MS);
```

- [ ] Build each category by excluding deleted/invalid/out-of-month rows, parsing details, sorting, and mapping the exact serialized row type.

- [ ] Integrate into `getDashboardSummary`:
  - compute the range before `Promise.all`;
  - remove `DashboardNewHiresSummary`, `newHires`, and the old builder;
  - remove `position: true` from the general active employee select if no longer used there;
  - add `hiredThisMonth` query without `isArchived: false`:

```typescript
prismadb.employee.findMany({
  where: {
    departmentId,
    dateHired: { gte: movementRange.start, lt: movementRange.end },
  },
  select: {
    id: true,
    prefix: true,
    firstName: true,
    middleName: true,
    lastName: true,
    suffix: true,
    nickname: true,
    position: true,
    dateHired: true,
    offices: { select: { name: true } },
  },
})
```

  - add `movementEventsThisMonth` query:

```typescript
prismadb.employmentEvent.findMany({
  where: {
    type: { in: ["PROMOTED", "TERMINATED"] },
    deletedAt: null,
    occurredAt: { gte: movementRange.start, lt: movementRange.end },
    employee: { departmentId },
  },
  select: {
    id: true,
    type: true,
    details: true,
    occurredAt: true,
    deletedAt: true,
    employee: {
      select: {
        id: true,
        prefix: true,
        firstName: true,
        middleName: true,
        lastName: true,
        suffix: true,
        nickname: true,
        position: true,
        offices: { select: { name: true } },
      },
    },
  },
})
```

  - map hired employees and split event rows into promoted/separated inputs;
  - return `employeeMovements: DashboardEmployeeMovementsSummary`.

- [ ] Run GREEN:

```powershell
npx tsx --test tests/dashboard-employee-movements-summary.test.ts tests/dashboard-plantilla-summary.test.ts
npx tsc --noEmit --pretty false
```

Expected: all tests pass and TypeScript exits 0.

---

### Task 2: Employee Movements Card and Modal

**Files:**
- Create: `components/dashboard/dashboard-employee-movements-card.tsx`
- Create: `tests/dashboard-employee-movements-modal.test.ts`
- Modify: `app/(dashboard)/[departmentId]/(routes)/page.tsx`
- Modify: `tests/dashboard-metric-card-borders.test.ts`
- Modify: `CHANGELOG.md`
- Delete: `components/dashboard/dashboard-new-hires-metric-card.tsx`
- Delete: `tests/dashboard-new-hires-modal.test.ts`

- [ ] Write failing source-contract tests first:
  - page renders `DashboardEmployeeMovementsCard` with `dashboardSummary.employeeMovements`;
  - no New Hires component import remains;
  - client component uses `DialogTrigger asChild`;
  - title is `Employee Movements`;
  - card renders total and Hired/Promoted/Separated counts;
  - `Tabs`, `TabsList`, three `TabsTrigger`, and matching `TabsContent` values exist;
  - each tab label includes its count;
  - each category has an empty state;
  - movement rows render name, office, position, dateLabel, optional details, and profile href;
  - list uses `role="list"`, `max-h-[55dvh]`, and `overflow-y-auto`;
  - card/trigger use `h-full`, indigo light/dark borders, focus ring, and semantic button;
  - metric-border test checks the new indigo component.

- [ ] Run RED:

```powershell
npx tsx --test tests/dashboard-employee-movements-modal.test.ts tests/dashboard-metric-card-borders.test.ts
```

Expected: new component/module assertions fail.

- [ ] Build `DashboardEmployeeMovementsCard` as a client component:
  - use `ArrowRightLeft` card icon and category icons `UserPlus`, `TrendingUp`, `UserMinus`;
  - primary animated value is `total`;
  - compact card breakdown displays all three category counts;
  - card border/focus is indigo;
  - dialog title/description use total and `monthLabel`;
  - Radix Tabs default to `hired`;
  - triggers are at least 44px tall and include count badges;
  - each `TabsContent` renders a shared movement-list helper;
  - rows remain `DashboardNavLink` buttons and display optional event details;
  - empty messages are exactly:
    - `No employees hired this month`
    - `No promotions this month`
    - `No separations this month`
  - use near-full mobile width, `max-w-2xl`, `max-h-[85dvh]`, and list-only scrolling.

- [ ] Replace the page import/render with:

```tsx
<DashboardEmployeeMovementsCard {...dashboardSummary.employeeMovements} />
```

- [ ] Add newest changelog entry:

```markdown
- 2026-07-21 — feat: expand the dashboard monthly metric into hired, promoted, and separated employee movements
```

- [ ] Run focused and regression verification:

```powershell
npx tsx --test tests/dashboard-employee-movements-summary.test.ts tests/dashboard-employee-movements-modal.test.ts tests/dashboard-metric-card-borders.test.ts
npx tsx --test tests/dashboard-employee-movements-summary.test.ts tests/dashboard-employee-movements-modal.test.ts tests/dashboard-metric-card-borders.test.ts tests/dashboard-workforce-composition.test.ts tests/dashboard-compact-layout.test.ts tests/dashboard-plantilla-summary.test.ts tests/dashboard-plantilla-card.test.ts
npx tsc --noEmit --pretty false
npm run lint
```

Expected: all selected tests pass, TypeScript exits 0, and changed files have no lint warnings/errors.

- [ ] Manual authenticated QA:
  - verify total and category counts;
  - open with pointer, Enter, and Space;
  - switch all tabs by pointer and keyboard;
  - verify empty states, list scrolling, row navigation, Escape close, focus restoration, 375px width, and dark mode.
