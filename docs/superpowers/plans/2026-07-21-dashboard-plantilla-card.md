# Dashboard Plantilla Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dashboard's Pending Approvals top metric with the approved single-card Plantilla summary showing total, filled, vacant, and occupancy.

**Architecture:** Add a pure dashboard-specific adapter around the existing office workforce aggregation, then populate it from the server-rendered dashboard summary action. Render a dedicated local Plantilla card in the overview page so the generic metric card remains simple and the existing Needs Attention pending-approval row is preserved.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Prisma, Tailwind CSS, Lucide React, Node test runner via `tsx --test`.

## Global Constraints

- Match the approved balanced mockup: violet border/icon, total as the primary number, filled and vacant secondary values, emerald progress bar, and occupancy footer.
- Total means active plantilla positions; filled means active positions occupied by non-archived employees; vacant means active minus filled.
- Display occupancy with at most one decimal place and use `0%` for zero active slots.
- Keep Pending Approvals in Needs Attention.
- Link the complete Plantilla card to `/{departmentId}/offices`.
- Do not add dependencies, a new API endpoint, client-side fetching, or realtime subscriptions.
- Update `CHANGELOG.md` under Unreleased with `- 2026-07-21 — ui: replace the dashboard Pending Approvals metric with a compact Plantilla occupancy card`.
- Do not create a git commit unless the user separately requests one.

---

### Task 1: Dashboard Plantilla Summary

**Files:**
- Create: `lib/dashboard-plantilla.ts`
- Create: `tests/dashboard-plantilla-summary.test.ts`
- Modify: `actions/get-dashboard-summary.ts:1-82,225-end`

**Interfaces:**
- Consumes: `AggregateOfficeWorkforceInput` and `aggregateOfficeWorkforce` from `lib/office-workforce.ts`.
- Produces: `DashboardPlantillaSummary` and `buildDashboardPlantillaSummary(input): DashboardPlantillaSummary`.
- Extends `DashboardSummary` with `plantilla: DashboardPlantillaSummary`.

- [ ] **Step 1: Write the failing summary tests**

Create `tests/dashboard-plantilla-summary.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { buildDashboardPlantillaSummary } from "../lib/dashboard-plantilla";

test("builds active plantilla totals and rounded occupancy", () => {
  const summary = buildDashboardPlantillaSummary({
    offices: [],
    plantillaPositions: [
      { id: "filled", officeId: "office-1", isActive: true },
      { id: "vacant", officeId: "office-1", isActive: true },
      { id: "inactive", officeId: "office-1", isActive: false },
    ],
    employees: [
      {
        id: "active",
        officeId: "office-1",
        plantillaPositionId: "filled",
        isArchived: false,
      },
      {
        id: "archived",
        officeId: "office-1",
        plantillaPositionId: "vacant",
        isArchived: true,
      },
    ],
  });

  assert.deepEqual(summary, {
    total: 2,
    filled: 1,
    vacant: 1,
    occupancyRate: 50,
  });
});

test("returns a zero-safe occupancy rate", () => {
  assert.deepEqual(
    buildDashboardPlantillaSummary({
      offices: [],
      plantillaPositions: [],
      employees: [],
    }),
    { total: 0, filled: 0, vacant: 0, occupancyRate: 0 },
  );
});

test("rounds occupancy to one decimal place", () => {
  const summary = buildDashboardPlantillaSummary({
    offices: [],
    plantillaPositions: [
      { id: "one", officeId: "office-1", isActive: true },
      { id: "two", officeId: "office-1", isActive: true },
      { id: "three", officeId: "office-1", isActive: true },
    ],
    employees: [
      {
        id: "active",
        officeId: "office-1",
        plantillaPositionId: "one",
        isArchived: false,
      },
    ],
  });

  assert.equal(summary.occupancyRate, 33.3);
});
```

- [ ] **Step 2: Run the focused test and confirm the expected failure**

Run:

```powershell
npx tsx --test tests/dashboard-plantilla-summary.test.ts
```

Expected: FAIL because `../lib/dashboard-plantilla` does not exist.

- [ ] **Step 3: Implement the pure summary adapter**

Create `lib/dashboard-plantilla.ts`:

```ts
import {
  aggregateOfficeWorkforce,
  type AggregateOfficeWorkforceInput,
} from "@/lib/office-workforce";

export type DashboardPlantillaSummary = {
  total: number;
  filled: number;
  vacant: number;
  occupancyRate: number;
};

export function buildDashboardPlantillaSummary(
  input: AggregateOfficeWorkforceInput,
): DashboardPlantillaSummary {
  const totals = aggregateOfficeWorkforce(input).totals;
  const total = totals.activePlantillaSlots;
  const filled = totals.filledPlantillaSlots;

  return {
    total,
    filled,
    vacant: totals.vacantPlantillaSlots,
    occupancyRate:
      total === 0 ? 0 : Math.round((filled / total) * 1000) / 10,
  };
}
```

- [ ] **Step 4: Extend the dashboard action type and imports**

In `actions/get-dashboard-summary.ts`, import the adapter and type:

```ts
import {
  buildDashboardPlantillaSummary,
  type DashboardPlantillaSummary,
} from "@/lib/dashboard-plantilla";
```

Add this field to `DashboardSummary`:

```ts
plantilla: DashboardPlantillaSummary;
```

- [ ] **Step 5: Fetch the minimal plantilla occupancy inputs**

Append `plantillaPositions` and `plantillaEmployees` to the existing `Promise.all` destructuring and add these queries to the same array:

```ts
prismadb.plantillaPosition.findMany({
  where: { departmentId },
  select: { id: true, officeId: true, isActive: true },
}),
prismadb.employee.findMany({
  where: {
    departmentId,
    isArchived: false,
    plantillaPositionId: { not: null },
  },
  select: {
    id: true,
    officeId: true,
    plantillaPositionId: true,
    isArchived: true,
  },
}),
```

Add this property to the final returned `DashboardSummary` object:

```ts
plantilla: buildDashboardPlantillaSummary({
  offices: [],
  plantillaPositions,
  employees: plantillaEmployees,
}),
```

- [ ] **Step 6: Run the focused summary tests**

Run:

```powershell
npx tsx --test tests/dashboard-plantilla-summary.test.ts
```

Expected: 3 tests PASS.

---

### Task 2: Approved Plantilla Metric Card

**Files:**
- Create: `tests/dashboard-plantilla-card.test.ts`
- Modify: `app/(dashboard)/[departmentId]/(routes)/page.tsx:1-12,119-162,361-410`
- Modify: `CHANGELOG.md:4-9`

**Interfaces:**
- Consumes: `dashboardSummary.plantilla: DashboardPlantillaSummary`.
- Produces: local `PlantillaMetricCard({ departmentId, total, filled, vacant, occupancyRate })`.

- [ ] **Step 1: Write the failing source-contract test**

Create `tests/dashboard-plantilla-card.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboardSource = readFileSync(
  "app/(dashboard)/[departmentId]/(routes)/page.tsx",
  "utf8",
);

test("uses the dedicated Plantilla metric in the top dashboard row", () => {
  assert.match(dashboardSource, /function PlantillaMetricCard/);
  assert.match(dashboardSource, />\s*Plantilla\s*</);
  assert.match(dashboardSource, /dashboardSummary\.plantilla/);
  assert.match(dashboardSource, /href=\{`\/\$\{departmentId\}\/offices`\}/);
});

test("removes only the Pending Approvals top metric", () => {
  assert.doesNotMatch(dashboardSource, /title="Pending Approvals"/);
  assert.match(dashboardSource, /label: "Pending approvals"/);
});

test("exposes occupancy progress semantics", () => {
  assert.match(dashboardSource, /role="progressbar"/);
  assert.match(dashboardSource, /aria-valuenow=\{occupancyRate\}/);
  assert.match(dashboardSource, /Occupancy/);
});
```

- [ ] **Step 2: Run the focused UI contract test and confirm failure**

Run:

```powershell
npx tsx --test tests/dashboard-plantilla-card.test.ts
```

Expected: FAIL because `PlantillaMetricCard` is not present and the Pending Approvals metric still renders.

- [ ] **Step 3: Replace the top Pending Approvals metric call**

In `page.tsx`, replace the existing `<MetricCard title="Pending Approvals" ...>` block with:

```tsx
<PlantillaMetricCard
  departmentId={departmentId}
  {...dashboardSummary.plantilla}
/>
```

Remove the now-unused `ShieldCheck` import and add `Briefcase` from `lucide-react`.

- [ ] **Step 4: Implement the approved card**

Add this local component before `MetricCardProps`:

```tsx
type PlantillaMetricCardProps = {
  departmentId: string;
  total: number;
  filled: number;
  vacant: number;
  occupancyRate: number;
};

function PlantillaMetricCard({
  departmentId,
  total,
  filled,
  vacant,
  occupancyRate,
}: PlantillaMetricCardProps) {
  const formattedOccupancy = `${occupancyRate.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}%`;

  return (
    <DashboardNavLink
      href={`/${departmentId}/offices`}
      className="block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
    >
      <Card
        className={`${glassCard} group relative h-full overflow-hidden rounded-2xl border-violet-400/80 transition hover:bg-white/60 dark:border-violet-500/50 dark:hover:bg-white/[0.07]`}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/30 to-transparent dark:from-white/[0.04]" />
        <CardHeader className="relative z-10 flex flex-row items-center justify-between space-y-0 p-4 pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Plantilla
          </CardTitle>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 ring-1 ring-violet-500/20 dark:text-violet-300">
            <Briefcase className="h-5 w-5" aria-hidden="true" />
          </span>
        </CardHeader>
        <CardContent className="relative z-10 p-4 pt-0">
          <div className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums dark:text-slate-100">
            <AnimatedNumber value={total} />
          </div>

          <div className="mt-2 flex items-start gap-5">
            <div>
              <AnimatedNumber
                value={filled}
                className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400"
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Filled</p>
            </div>
            <div>
              <AnimatedNumber
                value={vacant}
                className="text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400"
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Vacant</p>
            </div>
          </div>

          <div
            role="progressbar"
            aria-label={`Plantilla occupancy ${formattedOccupancy}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={occupancyRate}
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300"
              style={{ width: `${occupancyRate}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
            <span>Occupancy</span>
            <span className="font-medium tabular-nums text-slate-700 dark:text-slate-200">
              {formattedOccupancy}
            </span>
          </div>
        </CardContent>
      </Card>
    </DashboardNavLink>
  );
}
```

- [ ] **Step 5: Add the required changelog entry**

Keep `**Last updated: 2026-07-21**` and insert at the top of Unreleased:

```md
- 2026-07-21 — ui: replace the dashboard Pending Approvals metric with a compact Plantilla occupancy card
```

- [ ] **Step 6: Run the focused card contract tests**

Run:

```powershell
npx tsx --test tests/dashboard-plantilla-card.test.ts
```

Expected: 3 tests PASS.

---

### Task 3: Verification

**Files:**
- Verify only; no additional files expected.

**Interfaces:**
- Confirms the summary adapter, server action, and dashboard card work together.

- [ ] **Step 1: Run both feature tests together**

Run:

```powershell
npx tsx --test tests/dashboard-plantilla-summary.test.ts tests/dashboard-plantilla-card.test.ts
```

Expected: 6 tests PASS.

- [ ] **Step 2: Run the complete repository test command**

Run:

```powershell
npm test
```

Expected: all tests PASS. If an unrelated pre-existing failure appears, record its exact test and error without changing unrelated code.

- [ ] **Step 3: Run TypeScript validation**

Run:

```powershell
npx tsc --noEmit --pretty false
```

Expected: exit code 0. If known unrelated baseline errors remain, verify there are no errors in `dashboard-plantilla.ts`, `get-dashboard-summary.ts`, or `page.tsx`.

- [ ] **Step 4: Run lint**

Run:

```powershell
npm run lint
```

Expected: no new lint errors in changed files.

- [ ] **Step 5: Visually verify the running dashboard**

Open the existing development server and confirm:

- the third top card is Plantilla;
- values match the Offices workforce totals;
- the card has a violet border/icon, emerald filled value and progress, amber vacant value, and occupancy footer;
- selecting the card navigates to Offices;
- Pending Approvals remains in Needs Attention;
- the four-card row remains aligned at desktop width and stacks without horizontal scrolling at narrow width.
