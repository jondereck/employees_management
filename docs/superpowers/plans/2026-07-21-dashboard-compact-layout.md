# Dashboard Compact Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved stacked-right-rail desktop dashboard and compact mobile dashboard without nested scrolling or lost information.

**Architecture:** Extract Workforce Composition into a focused client component that owns only mobile tab/disclosure state while preserving the current desktop chart layout. Recompose the server dashboard grid so Needs Attention and Incomplete Records share a right rail, then render a six-record responsive missing-data preview with a View all link.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Recharts, Lucide React, Node test runner via `tsx --test`.

## Global Constraints

- Desktop uses Option A: Workforce Composition left; Needs Attention and Incomplete Records stacked right; compact Missing Data full-width; Analytics full-width.
- Mobile uses two KPI columns, one composition donut at a time, collapsed detailed breakdown, and four visible missing-data previews.
- Desktop continues to show all three donuts and Male / Female Counts together.
- Keep the existing sticky top navbar and mobile sidebar; do not add bottom navigation.
- Preserve all current data, links, glass styling, dark mode, semantic colors, focus states, and responsive reading order.
- No nested scroll area in Employees With Missing Data.
- No API, database, dependency, client-fetching, or realtime changes.
- Update `CHANGELOG.md` with `- 2026-07-21 — ui: compact the dashboard layout and mobile workforce composition`.
- Preserve unrelated uncommitted changes and do not create a git commit unless separately requested.

---

### Task 1: Responsive Workforce Composition Component

**Files:**
- Create: `components/dashboard/dashboard-workforce-composition.tsx`
- Create: `tests/dashboard-workforce-composition.test.ts`
- Modify: `app/(dashboard)/[departmentId]/(routes)/page.tsx`

**Interfaces:**
- Consumes existing appointment, gender, eligibility chart slices and all `DashboardGenderCounts` props.
- Produces `DashboardWorkforceComposition(props)` with mobile chart tabs and disclosure state.

- [ ] **Step 1: Write the failing source-contract test**

Create `tests/dashboard-workforce-composition.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const compositionSource = readFileSync(
  "components/dashboard/dashboard-workforce-composition.tsx",
  "utf8",
);
const dashboardSource = readFileSync(
  "app/(dashboard)/[departmentId]/(routes)/page.tsx",
  "utf8",
);

test("defaults the mobile composition to Appointment with all three tabs", () => {
  assert.match(compositionSource, /useState<CompositionChart>\("appointment"\)/);
  assert.match(compositionSource, /Appointment/);
  assert.match(compositionSource, /Gender/);
  assert.match(compositionSource, /Eligibility/);
  assert.match(compositionSource, /role="tablist"/);
});

test("keeps desktop charts visible while mobile shows the selected chart", () => {
  assert.match(compositionSource, /lg:grid-cols-3/);
  assert.match(compositionSource, /hidden lg:block/);
  assert.match(compositionSource, /activeChart/);
});

test("collapses detailed gender counts on mobile only", () => {
  assert.match(compositionSource, /useState\(false\)/);
  assert.match(compositionSource, /aria-expanded=\{detailsOpen\}/);
  assert.match(compositionSource, /View detailed breakdown/);
  assert.match(compositionSource, /hidden lg:block/);
});

test("dashboard delegates workforce composition rendering", () => {
  assert.match(dashboardSource, /<DashboardWorkforceComposition/);
  assert.doesNotMatch(dashboardSource, /<DashboardDonutChart/);
  assert.doesNotMatch(dashboardSource, /<DashboardGenderCounts/);
});
```

- [ ] **Step 2: Run the test and confirm expected failure**

Run:

```powershell
npx tsx --test tests/dashboard-workforce-composition.test.ts
```

Expected: FAIL because the component file does not exist.

- [ ] **Step 3: Implement the client component**

Create `components/dashboard/dashboard-workforce-composition.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import type {
  DashboardChartSlice,
  DashboardGenderCountRow,
  DashboardGenderCountsNested,
} from "@/actions/get-dashboard-summary";
import { DashboardDonutChart } from "@/components/dashboard/dashboard-donut-chart";
import { DashboardGenderCounts } from "@/components/dashboard/dashboard-gender-counts";
import { cn } from "@/lib/utils";

type CompositionChart = "appointment" | "gender" | "eligibility";

type DashboardWorkforceCompositionProps = {
  appointmentSlices: DashboardChartSlice[];
  genderSlices: DashboardChartSlice[];
  eligibilitySlices: DashboardChartSlice[];
  genderCountsByEmployeeType: DashboardGenderCountRow[];
  genderCountsByEligibility: DashboardGenderCountRow[];
  genderCountsBySupervisory: DashboardGenderCountRow[];
  genderCountsByOffice: DashboardGenderCountRow[];
  genderCountsNested: DashboardGenderCountsNested;
};

const charts = [
  {
    key: "appointment",
    label: "Appointment",
    title: "Appointment Type",
    description: "Active workforce mix",
  },
  {
    key: "gender",
    label: "Gender",
    title: "Gender",
    description: "Active employee split",
  },
  {
    key: "eligibility",
    label: "Eligibility",
    title: "Eligibility",
    description: "Top eligibility groups",
  },
] as const;
```

Inside the component:

```tsx
const [activeChart, setActiveChart] =
  useState<CompositionChart>("appointment");
const [detailsOpen, setDetailsOpen] = useState(false);
const dataByChart = {
  appointment: appointmentSlices,
  gender: genderSlices,
  eligibility: eligibilitySlices,
};
```

Render:

```tsx
<>
  <div
    role="tablist"
    aria-label="Workforce composition chart"
    className="mb-3 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 lg:hidden dark:bg-slate-800"
  >
    {charts.map((chart) => (
      <button
        key={chart.key}
        type="button"
        role="tab"
        aria-selected={activeChart === chart.key}
        onClick={() => setActiveChart(chart.key)}
        className={cn(
          "rounded-md px-2 py-2 text-xs font-medium",
          activeChart === chart.key
            ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
            : "text-slate-500 dark:text-slate-400",
        )}
      >
        {chart.label}
      </button>
    ))}
  </div>

  <div className="grid w-full gap-3 lg:grid-cols-3">
    {charts.map((chart) => (
      <div
        key={chart.key}
        className={cn(activeChart !== chart.key && "hidden lg:block")}
      >
        <DashboardDonutChart
          title={chart.title}
          description={chart.description}
          data={dataByChart[chart.key]}
          compact
        />
      </div>
    ))}
  </div>

  <button
    type="button"
    aria-expanded={detailsOpen}
    onClick={() => setDetailsOpen((open) => !open)}
    className="mt-3 flex min-h-11 w-full items-center justify-between rounded-xl border border-white/30 bg-white/35 px-3 text-sm font-semibold text-slate-700 lg:hidden dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200"
  >
    View detailed breakdown
    <ChevronDown
      className={cn("h-4 w-4 transition-transform", detailsOpen && "rotate-180")}
      aria-hidden="true"
    />
  </button>

  <div className={cn("mt-4", !detailsOpen && "hidden lg:block")}>
    <DashboardGenderCounts
      byEmployeeType={genderCountsByEmployeeType}
      byEligibility={genderCountsByEligibility}
      bySupervisory={genderCountsBySupervisory}
      byOffice={genderCountsByOffice}
      nested={genderCountsNested}
    />
  </div>
</>
```

- [ ] **Step 4: Replace direct composition children in the page**

Import `DashboardWorkforceComposition`, remove direct `DashboardDonutChart` and `DashboardGenderCounts` imports, and replace the current chart grid plus gender counts with:

```tsx
<DashboardWorkforceComposition
  appointmentSlices={dashboardSummary.appointmentSlices}
  genderSlices={dashboardSummary.genderSlices}
  eligibilitySlices={dashboardSummary.eligibilitySlices}
  genderCountsByEmployeeType={dashboardSummary.genderCountsByEmployeeType}
  genderCountsByEligibility={dashboardSummary.genderCountsByEligibility}
  genderCountsBySupervisory={dashboardSummary.genderCountsBySupervisory}
  genderCountsByOffice={dashboardSummary.genderCountsByOffice}
  genderCountsNested={dashboardSummary.genderCountsNested}
/>
```

- [ ] **Step 5: Run focused test and TypeScript**

Run:

```powershell
npx tsx --test tests/dashboard-workforce-composition.test.ts
npx tsc --noEmit --pretty false
```

Expected: 4 tests PASS; TypeScript exits 0.

---

### Task 2: Compact Dashboard Grid and Missing-Data Preview

**Files:**
- Create: `tests/dashboard-compact-layout.test.ts`
- Modify: `app/(dashboard)/[departmentId]/(routes)/page.tsx`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes existing `dashboardSummary.incompleteRecords`.
- Produces `incompleteEmployeePreview`, a six-record non-destructive view.

- [ ] **Step 1: Write the failing layout contract test**

Create `tests/dashboard-compact-layout.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  "app/(dashboard)/[departmentId]/(routes)/page.tsx",
  "utf8",
);

test("uses two metric columns on mobile", () => {
  assert.match(source, /grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4/);
});

test("stacks attention and incomplete records in one right rail", () => {
  assert.match(source, /data-dashboard-right-rail/);
  assert.match(source, /Needs Attention/);
  assert.match(source, /Incomplete Records/);
});

test("renders a six-record missing-data preview without nested scrolling", () => {
  assert.match(
    source,
    /dashboardSummary\.incompleteRecords\.employees\.slice\(0, 6\)/,
  );
  assert.doesNotMatch(source, /max-h-\[320px\]/);
  assert.match(source, /sm:grid-cols-2 xl:grid-cols-3/);
});

test("shows the complete missing-record count in View all", () => {
  assert.match(source, /View all \{dashboardSummary\.incompleteRecords\.count\}/);
  assert.match(source, /index >= 4/);
});
```

- [ ] **Step 2: Run test and confirm expected failures**

Run:

```powershell
npx tsx --test tests/dashboard-compact-layout.test.ts
```

Expected: FAIL because the current layout has one mobile metric column, separate second row, and a fixed-height scroll list.

- [ ] **Step 3: Add the preview and compact mobile metric grid**

After `attentionItems`, add:

```ts
const incompleteEmployeePreview =
  dashboardSummary.incompleteRecords.employees.slice(0, 6);
```

Change the metrics wrapper to:

```tsx
<div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
```

Apply responsive compact spacing to generic and Plantilla metric cards:

- mobile header/content padding `p-3`, restored to `p-4` at `sm`;
- mobile icon `h-8 w-8`, restored to `h-10 w-10` at `sm`;
- mobile title `text-xs`, restored to `text-sm` at `sm`;
- keep 44px minimum effective hit area for linked cards.

- [ ] **Step 4: Build the stacked right rail**

Keep the existing desktop two-column wrapper, but change it to `items-start`. Retain Workforce Composition as the first child. Add:

```tsx
<div data-dashboard-right-rail className="grid min-w-0 content-start gap-4">
  {/* existing Needs Attention card */}
  {/* existing Incomplete Records card */}
</div>
```

Move the complete existing Incomplete Records card from the second dashboard grid into this right rail without removing its total, Review link, field counts, or empty state.

- [ ] **Step 5: Replace the missing-data scroll list with the responsive preview**

Make Employees With Missing Data a full-width card after the primary section. Put this link in its header:

```tsx
<DashboardNavLink
  href={`/${departmentId}/employees`}
  className="rounded-lg px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-emerald-300"
>
  View all {dashboardSummary.incompleteRecords.count}
</DashboardNavLink>
```

Render:

```tsx
{incompleteEmployeePreview.length ? (
  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
    {incompleteEmployeePreview.map((employee, index) => (
      <DashboardNavLink
        key={employee.id}
        href={employee.href}
        className={cn(
          "flex w-full flex-col gap-2 rounded-xl border border-white/30 bg-white/35 px-3 py-2.5 transition hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:flex-row sm:items-center sm:justify-between sm:gap-3 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.07]",
          index >= 4 && "hidden sm:flex",
        )}
      >
        {/* retain existing employee title, subtitle, and meta markup */}
      </DashboardNavLink>
    ))}
  </div>
) : (
  /* retain existing empty state */
)}
```

Import `cn` from `@/lib/utils`.

- [ ] **Step 6: Update the changelog**

Keep `**Last updated: 2026-07-21**` and insert as the newest Unreleased line:

```md
- 2026-07-21 — ui: compact the dashboard layout and mobile workforce composition
```

- [ ] **Step 7: Run focused layout and feature tests**

Run:

```powershell
npx tsx --test tests/dashboard-compact-layout.test.ts
npx tsx --test tests/dashboard-workforce-composition.test.ts tests/dashboard-compact-layout.test.ts tests/dashboard-plantilla-summary.test.ts tests/dashboard-plantilla-card.test.ts
npx tsc --noEmit --pretty false
```

Expected: 4 layout tests PASS, all 14 dashboard feature tests PASS, and TypeScript exits 0.

---

### Task 3: Full and Visual Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run the complete test suite**

```powershell
npm test
```

Expected: all tests PASS.

- [ ] **Step 2: Run lint**

```powershell
npm run lint
```

Expected: no new lint errors in changed files.

- [ ] **Step 3: Run TypeScript**

```powershell
npx tsc --noEmit --pretty false
```

Expected: exit code 0.

- [ ] **Step 4: Visually verify desktop**

At desktop width, confirm:

- Workforce Composition is left;
- Needs Attention and Incomplete Records are stacked right;
- there is no large empty right-card area;
- six employee previews use three columns;
- Analytics remains full width.

- [ ] **Step 5: Visually verify mobile**

At approximately 390px width, confirm:

- metrics use two columns without clipping;
- composition defaults to Appointment and tabs switch chart content;
- detailed breakdown starts collapsed and expands accessibly;
- four employee previews appear without nested scrolling;
- existing top navbar/mobile sidebar remains usable;
- no horizontal overflow appears.
