# Overview Attention Loader + Gender Breakdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Overview Needs Attention / Incomplete Records clicks to the universal loader, and add a Break down by control to Male/Female Counts with expandable nested rows.

**Architecture:** Client nav helper mirrors MainNav overlay; nested gender counts are built in `getDashboardSummary` from `activeEmployees` and consumed by `DashboardGenderCounts`.

**Tech Stack:** Next.js App Router, React client components, Prisma summary action, shadcn Select.

## Global Constraints

- Match MainNav loader overlay (`Loading` from `app/loading`, frost backdrop, clear on pathname change).
- Break down by defaults to None; never nest a dimension into itself.
- Footer totals stay department-wide primary totals.
- Update `CHANGELOG.md` Unreleased when done.

---

### Task 1: Dashboard nav link with universal loader

**Files:**
- Create: `components/dashboard/dashboard-nav-link.tsx`
- Modify: `app/(dashboard)/[departmentId]/(routes)/page.tsx`

- [ ] Create client `DashboardNavLink` (and optional list wrapper) using MainNav pattern: loading state, `router.push`, overlay, clear on pathname.
- [ ] Replace Needs Attention `<Link>`s and Incomplete Records Review `<Link>` with this component.
- [ ] Verify overlay shows on click and clears after navigation.

### Task 2: Nested gender count data in summary

**Files:**
- Modify: `actions/get-dashboard-summary.ts`

- [ ] Extend `DashboardGenderCountRow` with optional `children`.
- [ ] Add `genderCountsNested` (or equivalent) built from `activeEmployees` for all primary × nest pairs.
- [ ] Keep existing flat `genderCountsBy*` arrays for Break down = None.
- [ ] Return nested payload from `getDashboardSummary`.

### Task 3: Break down by UI

**Files:**
- Modify: `components/dashboard/dashboard-gender-counts.tsx`
- Modify: `app/(dashboard)/[departmentId]/(routes)/page.tsx` (pass nested props)

- [ ] Add second Select “Break down by” with None + other dimensions.
- [ ] Expandable rows when breakdown is set; flat table when None.
- [ ] Footer totals from primary rows only.

### Task 4: Changelog

**Files:**
- Modify: `CHANGELOG.md`

- [ ] Add Unreleased entries for loader + gender breakdown.
