# Office Employee Count Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a live `Active | Archived` assigned-employee count to each Offices table row.

**Architecture:** Extend existing office workforce metrics and aggregation rather than creating another endpoint. The summary route will supply every department employee; the aggregator will count all assignments while retaining existing active plantilla occupancy behavior.

**Tech Stack:** TypeScript, Next.js 14, Prisma, SWR, TanStack Table, Node test runner

## Global Constraints

- Count employees by assigned office.
- Render active in green and archived in red.
- Do not rely on color alone for accessibility.
- Preserve existing plantilla and cross-office calculations.
- Update `CHANGELOG.md`.

---

### Task 1: Workforce count metrics

**Files:**
- Modify: `tests/office-workforce.test.ts`
- Modify: `lib/office-workforce.ts`
- Modify: `app/api/[departmentId]/offices/workforce-summary/route.ts`
- Modify: `lib/office-workforce-view-model.ts`

- [ ] Add a failing aggregation test for active, archived, and unlinked employees.
- [ ] Run the focused test and confirm failure from missing metrics.
- [ ] Add active/archived assigned counts and query all department employees.
- [ ] Run focused workforce tests.

### Task 2: Offices table column

**Files:**
- Modify: `app/(dashboard)/[departmentId]/(routes)/offices/components/columns.tsx`
- Modify: `app/(dashboard)/[departmentId]/(routes)/offices/page.tsx`
- Modify: `CHANGELOG.md`

- [ ] Add the sortable Employees column with green/red values and accessible text.
- [ ] Add initial zero values while live workforce data loads.
- [ ] Update the changelog.
- [ ] Run relevant tests, TypeScript, and lint.
