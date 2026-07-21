# Dashboard New Hires Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Active This Month with an accurate Manila-calendar New Hires count whose card opens an accessible employee-detail modal.

**Architecture:** Build the new-hire summary in a pure tested utility, populate it from the dashboard's existing active-employee query, and pass serialized rows to one focused client component. The server dashboard remains responsible for fetching; the client component owns only dialog state and navigation interactions.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Prisma, Tailwind CSS, Radix Dialog, Node test runner.

## Global Constraints

- Count non-archived employees by `Employee.dateHired`, never `createdAt` or `updatedAt`.
- Current month and year use `Asia/Manila`.
- Sort rows by newest hire date first, then employee name.
- The card remains emerald, equal-height, responsive, and keyboard accessible.
- The modal must open for zero results and display `No new hires this month`.
- Rows display employee name, office, position, and formatted hire date and navigate to the employee profile.
- Invalid dates are excluded.
- Do not add dependencies or change the database schema.
- Preserve unrelated uncommitted changes and do not commit.

---

### Task 1: Build the New-Hire Dashboard Summary

**Files:**
- Create: `lib/dashboard-new-hires.ts`
- Create: `tests/dashboard-new-hires-summary.test.ts`
- Modify: `actions/get-dashboard-summary.ts`

**Interfaces:**
- Produces:

```typescript
export type DashboardNewHireInput = {
  id: string;
  name: string;
  office: string | null;
  position: string | null;
  dateHired: Date | string;
  isArchived: boolean;
};

export type DashboardNewHireRow = {
  id: string;
  name: string;
  office: string;
  position: string;
  hireDateLabel: string;
  href: string;
};

export type DashboardNewHiresSummary = {
  count: number;
  monthLabel: string;
  employees: DashboardNewHireRow[];
};

export function buildDashboardNewHiresSummary(
  employees: DashboardNewHireInput[],
  departmentId: string,
  now?: Date,
  timeZone?: string,
): DashboardNewHiresSummary;
```

- Consumers: `DashboardSummary.newHires` and `DashboardNewHiresMetricCard`.

- [ ] **Step 1: Write failing utility tests**

Create `tests/dashboard-new-hires-summary.test.ts` with deterministic `now` values and assertions covering:

```typescript
test("includes only active employees hired in the Manila calendar month", () => {
  const summary = buildDashboardNewHiresSummary(
    [
      employee({ id: "included", dateHired: "2026-07-15T04:00:00.000Z" }),
      employee({ id: "previous", dateHired: "2026-06-30T15:59:59.000Z" }),
      employee({ id: "archived", dateHired: "2026-07-10T00:00:00.000Z", isArchived: true }),
    ],
    "department-1",
    new Date("2026-07-21T08:00:00.000Z"),
  );

  assert.equal(summary.count, 1);
  assert.equal(summary.monthLabel, "July 2026");
  assert.equal(summary.employees[0].id, "included");
});

test("uses Manila boundaries when UTC and Manila months differ", () => {
  const summary = buildDashboardNewHiresSummary(
    [employee({ dateHired: "2026-06-30T16:00:00.000Z" })],
    "department-1",
    new Date("2026-07-01T01:00:00.000Z"),
  );

  assert.equal(summary.count, 1);
});

test("sorts newest hire dates first then names", () => {
  const summary = buildDashboardNewHiresSummary(
    [
      employee({ id: "older", name: "Older Employee", dateHired: "2026-07-01T00:00:00.000Z" }),
      employee({ id: "z", name: "Zulu Employee", dateHired: "2026-07-20T00:00:00.000Z" }),
      employee({ id: "a", name: "Alpha Employee", dateHired: "2026-07-20T00:00:00.000Z" }),
    ],
    "department-1",
    new Date("2026-07-21T08:00:00.000Z"),
  );

  assert.deepEqual(summary.employees.map((item) => item.id), ["a", "z", "older"]);
});

test("excludes invalid dates and supplies display fallbacks", () => {
  const summary = buildDashboardNewHiresSummary(
    [
      employee({ id: "invalid", dateHired: "not-a-date" }),
      employee({ id: "fallback", office: " ", position: "", dateHired: "2026-07-10T00:00:00.000Z" }),
    ],
    "department-1",
    new Date("2026-07-21T08:00:00.000Z"),
  );

  assert.equal(summary.count, 1);
  assert.equal(summary.employees[0].office, "Unassigned Office");
  assert.equal(summary.employees[0].position, "Position not specified");
  assert.equal(summary.employees[0].href, "/department-1/employees/fallback");
});
```

Define a local `employee(overrides)` fixture with valid defaults so every assertion is self-contained.

- [ ] **Step 2: Run the focused test and observe RED**

Run:

```powershell
npx tsx --test tests/dashboard-new-hires-summary.test.ts
```

Expected: FAIL with `MODULE_NOT_FOUND` for `lib/dashboard-new-hires`.

- [ ] **Step 3: Implement the pure summary utility**

Create `lib/dashboard-new-hires.ts`. Use `Intl.DateTimeFormat(...).formatToParts()` to extract year/month in the requested time zone; do not compare UTC `getMonth()` values.

Core implementation:

```typescript
const DEFAULT_TIME_ZONE = "Asia/Manila";

const getYearMonth = (value: Date | string, timeZone: string) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);
  return {
    date,
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
  };
};
```

Filter non-archived rows whose extracted year/month match `now`, sort by parsed timestamp descending then `name.localeCompare`, and map to the exact exported row type. Generate:

```typescript
monthLabel: new Intl.DateTimeFormat("en-US", {
  timeZone,
  month: "long",
  year: "numeric",
}).format(now)
```

and:

```typescript
hireDateLabel: new Intl.DateTimeFormat("en-PH", {
  timeZone,
  month: "short",
  day: "numeric",
  year: "numeric",
}).format(parsedDate)
```

- [ ] **Step 4: Run utility tests and observe GREEN**

Run:

```powershell
npx tsx --test tests/dashboard-new-hires-summary.test.ts
```

Expected: 4 tests pass, 0 fail.

- [ ] **Step 5: Populate `DashboardSummary.newHires`**

In `actions/get-dashboard-summary.ts`:

```typescript
import {
  buildDashboardNewHiresSummary,
  type DashboardNewHiresSummary,
} from "@/lib/dashboard-new-hires";
```

Add:

```typescript
newHires: DashboardNewHiresSummary;
```

to `DashboardSummary`.

Add `position: true` to the existing `activeEmployees` select. Do not add another Prisma query.

Before the return, map the existing active rows:

```typescript
const newHires = buildDashboardNewHiresSummary(
  activeEmployees.map((employee) => ({
    id: employee.id,
    name: fullNameFromParts(employee) || "Unnamed employee",
    office: employee.offices?.name ?? null,
    position: employee.position,
    dateHired: employee.dateHired,
    isArchived: false,
  })),
  departmentId,
);
```

Return `newHires` alongside the existing summary fields.

- [ ] **Step 6: Verify Task 1**

Run:

```powershell
npx tsx --test tests/dashboard-new-hires-summary.test.ts tests/dashboard-plantilla-summary.test.ts
npx tsc --noEmit --pretty false
```

Expected: 7 tests pass and TypeScript exits 0.

---

### Task 2: Add the Clickable Metric and Accessible Modal

**Files:**
- Create: `components/dashboard/dashboard-new-hires-metric-card.tsx`
- Create: `tests/dashboard-new-hires-modal.test.ts`
- Modify: `app/(dashboard)/[departmentId]/(routes)/page.tsx`
- Modify: `tests/dashboard-metric-card-borders.test.ts`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes:

```typescript
type DashboardNewHiresMetricCardProps = DashboardNewHiresSummary;
```

- Produces: a client-rendered emerald metric card and Radix dialog; no fetching or mutations.

- [ ] **Step 1: Write failing source-contract tests**

Create `tests/dashboard-new-hires-modal.test.ts` asserting:

```typescript
assert.doesNotMatch(pageSource, /getMonthlyEmployeeActivity/);
assert.doesNotMatch(pageSource, /Active This Month/);
assert.match(pageSource, /DashboardNewHiresMetricCard/);
assert.match(pageSource, /dashboardSummary\.newHires/);
assert.match(componentSource, /"use client"/);
assert.match(componentSource, /DialogTrigger asChild/);
assert.match(componentSource, /New Hires This Month/);
assert.match(componentSource, /No new hires this month/);
assert.match(componentSource, /aria-label=\{`View \$\{count\} new hires/);
assert.match(componentSource, /max-h-\[55dvh\] overflow-y-auto/);
assert.match(componentSource, /employee\.office/);
assert.match(componentSource, /employee\.position/);
assert.match(componentSource, /employee\.hireDateLabel/);
assert.match(componentSource, /href=\{employee\.href\}/);
```

Update the emerald-border test in `tests/dashboard-metric-card-borders.test.ts` to inspect `dashboard-new-hires-metric-card.tsx` instead of searching for the removed `Active This Month` `MetricCard`. Keep Total Employees, Offices, and Plantilla assertions unchanged.

- [ ] **Step 2: Run tests and observe RED**

Run:

```powershell
npx tsx --test tests/dashboard-new-hires-modal.test.ts tests/dashboard-metric-card-borders.test.ts
```

Expected: FAIL because the client component does not exist and the page still imports/renders monthly activity.

- [ ] **Step 3: Create the client metric/dialog component**

Create `components/dashboard/dashboard-new-hires-metric-card.tsx` with:

```tsx
"use client";

import { CalendarPlus, UserPlus } from "lucide-react";

import { AnimatedNumber } from "@/components/animated-number";
import { DashboardNavLink } from "@/components/dashboard/dashboard-nav";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardNewHiresSummary } from "@/lib/dashboard-new-hires";

export function DashboardNewHiresMetricCard({
  count,
  monthLabel,
  employees,
}: DashboardNewHiresSummary) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`View ${count} new hires for ${monthLabel}`}
          className="block h-full w-full cursor-pointer rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <Card className="group relative h-full overflow-hidden rounded-2xl border border-emerald-400/80 bg-white/40 shadow-sm backdrop-blur-xl transition hover:bg-white/60 dark:border-emerald-500/50 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/30 to-transparent dark:from-white/[0.04]" />
            <CardHeader className="relative z-10 flex flex-row items-center justify-between space-y-0 p-3 pb-1.5 sm:p-4 sm:pb-2">
              <CardTitle className="text-xs font-semibold text-slate-600 dark:text-slate-300 sm:text-sm">
                New Hires This Month
              </CardTitle>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 sm:h-10 sm:w-10">
                <CalendarPlus className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
              </span>
            </CardHeader>
            <CardContent className="relative z-10 p-3 pt-0 sm:p-4 sm:pt-0">
              <div className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums dark:text-slate-100">
                <AnimatedNumber value={count} />
              </div>
              <div className="mt-1 min-h-[18px]">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Based on official hire date.
                </p>
              </div>
            </CardContent>
          </Card>
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-2xl p-0">
        <DialogHeader className="border-b px-5 py-4 pr-12 text-left">
          <DialogTitle>New Hires This Month</DialogTitle>
          <DialogDescription>{monthLabel} · {count} employees</DialogDescription>
        </DialogHeader>
        <div className="max-h-[55dvh] overflow-y-auto px-4 py-3">
          {employees.length ? (
            <div className="space-y-2">
              {employees.map((employee) => (
                <DashboardNavLink
                  key={employee.id}
                  href={employee.href}
                  className="flex min-h-11 w-full items-start justify-between gap-3 rounded-xl border p-3 text-left transition hover:bg-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {employee.name}
                    </p>
                    <p className="truncate text-xs text-slate-600 dark:text-slate-300">
                      {employee.office}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {employee.position}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-emerald-700 tabular-nums dark:text-emerald-300">
                    {employee.hireDateLabel}
                  </span>
                </DashboardNavLink>
              ))}
            </div>
          ) : (
            <div className="flex min-h-40 flex-col items-center justify-center text-center">
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                <UserPlus className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                No new hires this month
              </p>
              <p className="mt-1 max-w-xs text-xs text-slate-500 dark:text-slate-400">
                Employees will appear here based on their official hire date.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

Import `Card`, `CardContent`, `CardHeader`, and `CardTitle` from `@/components/ui/card`. Keep the shown `aria-hidden`, tabular numerals, and `min-h-11` touch target unchanged.

- [ ] **Step 4: Replace the old dashboard metric**

In `app/(dashboard)/[departmentId]/(routes)/page.tsx`:

- remove `Bell`;
- remove the `getMonthlyEmployeeActivity` import;
- remove `monthlyActivity` from Promise destructuring;
- remove its Promise entry;
- import `DashboardNewHiresMetricCard`;
- replace the old `MetricCard` with:

```tsx
<DashboardNewHiresMetricCard {...dashboardSummary.newHires} />
```

Do not change metric order, grid classes, or other dashboard sections.

- [ ] **Step 5: Update the changelog**

Add as the newest Unreleased entry:

```markdown
- 2026-07-21 — feat: replace dashboard activity count with a clickable monthly new-hires modal
```

Keep `**Last updated: 2026-07-21**`.

- [ ] **Step 6: Run focused tests and observe GREEN**

Run:

```powershell
npx tsx --test tests/dashboard-new-hires-summary.test.ts tests/dashboard-new-hires-modal.test.ts tests/dashboard-metric-card-borders.test.ts
```

Expected: all new-hire and metric-border tests pass.

- [ ] **Step 7: Run dashboard regression verification**

Run:

```powershell
npx tsx --test tests/dashboard-new-hires-summary.test.ts tests/dashboard-new-hires-modal.test.ts tests/dashboard-metric-card-borders.test.ts tests/dashboard-workforce-composition.test.ts tests/dashboard-compact-layout.test.ts tests/dashboard-plantilla-summary.test.ts tests/dashboard-plantilla-card.test.ts
npx tsc --noEmit --pretty false
npm run lint
```

Expected: all selected tests pass, TypeScript exits 0, and lint reports no new errors or warnings in changed files.

- [ ] **Step 8: Manual interaction check**

With an authenticated dashboard:

1. Confirm the second metric reads **New Hires This Month** and has an emerald border.
2. Activate it with mouse, Enter, and Space.
3. Confirm the modal traps focus, closes with Escape and the close control, and restores focus to the card.
4. Confirm name, office, position, and hire date are readable at desktop and 375px width.
5. Confirm a row opens the correct employee profile.
6. Confirm zero results show the approved empty state.
7. Confirm dark mode contrast and scrolling behavior.
