# Workforce Pivot Nested Rows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Matrix Pivot with Office as a dimension, optional nested secondary row field, and optional Office filter so users can build Office × Employee Type × Gender reports.

**Architecture:** Extract pure pivot aggregation into `lib/workforce-pivot.ts` (tag employees + build matrix). The API route loads employees (including office) and calls the builder. The Matrix UI gains secondary row + Office filter controls and a two-column nested table layout.

**Tech Stack:** Next.js App Router, Prisma, React client component, node:test via `npm test`.

## Global Constraints

- Pivot fields: `office` | `employeeType` | `eligibility` | `supervisory` | `gender`
- `rowFields` length 1–2; `colField` must not overlap; legacy `rowField` still accepted
- Optional `officeIds` filter; default All offices
- CSC mode unchanged; no Matrix drilldown
- Update `CHANGELOG.md` Unreleased when done
- Work on a feature branch (not commit-only on main)

---

### Task 1: Pure pivot builder + unit tests

**Files:**
- Create: `lib/workforce-pivot.ts`
- Create: `tests/workforce-pivot.test.ts`

**Interfaces:**
- Produces:
  - `PivotField = "office" | "employeeType" | "eligibility" | "supervisory" | "gender"`
  - `PivotEmployeeInput` — raw employee fields needed for tagging
  - `resolvePivotAxes(body): { rowFields: PivotField[]; colField: PivotField } | { error: string }`
  - `buildWorkforcePivot({ employees, rowFields, colField }): PivotResult`

- [ ] **Step 1: Write failing tests** in `tests/workforce-pivot.test.ts` covering:
  - nested `office` + `employeeType` × `gender` counts and group/leaf labels
  - single `office` × `gender`
  - legacy-compatible single-row shape (no group fields)
  - `resolvePivotAxes` rejects overlap / invalid length; accepts `rowField` legacy
- [ ] **Step 2: Run** `npx tsx --test tests/workforce-pivot.test.ts` — expect FAIL
- [ ] **Step 3: Implement** `lib/workforce-pivot.ts` with tagging, ordering, nested keys (`groupKey::leafKey`), matrix totals
- [ ] **Step 4: Run tests** — expect PASS
- [ ] **Step 5: Commit** `feat: add workforce pivot nested aggregation builder`

---

### Task 2: Wire API route

**Files:**
- Modify: `app/api/[departmentId]/analytics/workforce-pivot/route.ts`
- Modify: `tests/workforce-pivot.test.ts` (optional source checks for office select / officeIds)

- [ ] **Step 1: Update route** to select `officeId` + `offices.name`, apply `officeIds` filter, resolve axes via `resolvePivotAxes`, call `buildWorkforcePivot`, return `rowFields` (not only `rowField`)
- [ ] **Step 2: Keep auth/dept checks**; return 400 with resolve error message
- [ ] **Step 3: Run** `npx tsx --test tests/workforce-pivot.test.ts` — PASS
- [ ] **Step 4: Commit** `feat: wire workforce pivot API for office and nested rows`

---

### Task 3: Matrix UI — controls + nested table

**Files:**
- Modify: `app/(dashboard)/[departmentId]/(routes)/tools/workforce-pivot/WorkforcePivotTool.tsx`

- [ ] **Step 1: Add** `office` to `FIELD_LABELS` / `PivotField`; state for `secondaryRowField` (`"none"` | PivotField) and `officeIds`
- [ ] **Step 2: Load** offices from `/api/${departmentId}/offices`; multi-select filter like employee types
- [ ] **Step 3: Send** `rowFields` (+ optional secondary), `officeIds`; update Reset / auto-run deps
- [ ] **Step 4: Render** two header/label columns when nested; rowspan or blank-repeat primary label; title `Office + Employee Type × Gender`
- [ ] **Step 5: Commit** `feat: add nested rows and office filter to workforce pivot UI`

---

### Task 4: Changelog

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add Unreleased line** for nested Office × Employee Type × Gender pivot support; set Last updated to today
- [ ] **Step 2: Commit** `docs: changelog for workforce pivot nested rows`
