# Dashboard Metric Card Borders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add semantic colored borders to all dashboard KPI cards and link Total Employees to the Employees page.

**Architecture:** Extend the existing local `MetricCard` API with one border class prop, preserving the specialized Plantilla component. Verify the card calls and link using a focused source-contract test.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, Node test runner.

## Constraints

- Total Employees: blue border and `/{departmentId}/employees` link.
- Active This Month: emerald border, no link.
- Plantilla: existing violet border and Offices link unchanged.
- Offices: cyan border and existing Offices link.
- Preserve equal heights, responsive grid, glass styling, dark mode, content, hover, and focus behavior.
- Add `- 2026-07-21 — ui: add matching borders and employee navigation to dashboard metric cards` as newest Unreleased entry.
- Preserve unrelated changes and do not commit.

### Task 1: Metric Borders and Employee Link

**Files:**
- Create: `tests/dashboard-metric-card-borders.test.ts`
- Modify: `app/(dashboard)/[departmentId]/(routes)/page.tsx`
- Modify: `CHANGELOG.md`

- [ ] Write a failing source-contract test confirming:
  - `MetricCardProps` includes `borderTone: string`;
  - the Card includes `${borderTone}`;
  - Total Employees has the Employees href and blue border;
  - Active This Month has emerald border;
  - Offices has cyan border;
  - Plantilla retains violet border.

- [ ] Run:

```powershell
npx tsx --test tests/dashboard-metric-card-borders.test.ts
```

Expected: FAIL because `borderTone` and Total Employees link are absent.

- [ ] Add `borderTone: string` to `MetricCardProps`, destructure it, and append it to the generic Card class.

- [ ] Pass:

```tsx
borderTone="border-blue-400/80 dark:border-blue-500/50"
href={`/${departmentId}/employees`}
```

to Total Employees.

- [ ] Pass:

```tsx
borderTone="border-emerald-400/80 dark:border-emerald-500/50"
```

to Active This Month.

- [ ] Pass:

```tsx
borderTone="border-cyan-400/80 dark:border-cyan-500/50"
```

to Offices.

- [ ] Add the exact changelog line, preserving all existing content.

- [ ] Run:

```powershell
npx tsx --test tests/dashboard-metric-card-borders.test.ts tests/dashboard-workforce-composition.test.ts tests/dashboard-compact-layout.test.ts tests/dashboard-plantilla-summary.test.ts tests/dashboard-plantilla-card.test.ts
npx tsc --noEmit --pretty false
npm run lint
```

Expected: all focused dashboard tests pass, TypeScript exits 0, and changed files have no lint errors.
