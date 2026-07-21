# Position Summary Totals and Vacancy Highlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add visible totals and green vacancy highlighting to the Position Summary table and Authorized Positions Excel sheet.

**Architecture:** Add one pure summary helper to the existing position-summary module and reuse it in both the React table footer and Excel generator. Keep filtering in the dashboard so UI totals represent visible rows; calculate export totals from all exported rows.

**Tech Stack:** TypeScript, React, Tailwind CSS, Node test runner, xlsx-js-style

## Global Constraints

- Highlight rows only when `vacant > 0`.
- UI totals reflect currently filtered Position Summary rows.
- Excel totals reflect all rows in the Authorized Positions sheet.
- Do not change plantilla grouping or database behavior.

---

### Task 1: Position Summary Total Calculation

**Files:**
- Modify: `tests/office-workforce-position-summary.test.ts`
- Modify: `lib/office-workforce-position-summary.ts`

**Interfaces:**
- Consumes: `readonly AuthorizedPositionSummaryRow[]`
- Produces: `summarizeAuthorizedPositions(rows): { totalAuthorized: number; filled: number; vacant: number }`

- [ ] **Step 1: Write the failing tests**

Add assertions that totals are summed across rows and that an empty array returns
all zeroes.

- [ ] **Step 2: Run the tests to verify RED**

Run: `npx tsx --test tests/office-workforce-position-summary.test.ts`

Expected: FAIL because `summarizeAuthorizedPositions` is not exported.

- [ ] **Step 3: Implement the pure total helper**

Reduce all rows into a zero-initialized total object, adding
`totalAuthorized`, `filled`, and `vacant`.

- [ ] **Step 4: Run the tests to verify GREEN**

Run: `npx tsx --test tests/office-workforce-position-summary.test.ts`

Expected: PASS.

### Task 2: UI and Excel Presentation

**Files:**
- Modify: `app/(dashboard)/[departmentId]/(routes)/offices/components/office-workforce-dashboard-v2.tsx`
- Modify: `utils/export-office-workforce.ts`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `summarizeAuthorizedPositions`
- Produces: A filtered UI TOTAL row and an all-data Excel TOTAL row.

- [ ] **Step 1: Add UI totals and vacancy highlighting**

Calculate totals from `visiblePositionRows`. Apply a light-green background to
rows with vacancies and dark-green emphasis to their Vacant cell. Append a
bold TOTAL row to the table body.

- [ ] **Step 2: Add Excel totals and vacancy highlighting**

Append a `TOTAL` row after `authorizedRows`. Give data rows with a positive
Vacant value a light-green fill and style the final total row distinctly.
Extend the sheet autofilter range to include the total row.

- [ ] **Step 3: Update the changelog**

Add an Unreleased entry dated `2026-07-21` describing Position Summary totals
and vacancy highlighting.

- [ ] **Step 4: Verify the complete change**

Run:

`npx tsx --test tests/office-workforce-position-summary.test.ts tests/office-workforce-export.test.ts tests/office-workforce-view-model.test.ts tests/office-workforce.test.ts`

`npx tsc --noEmit`

`npx eslint "app/(dashboard)/[departmentId]/(routes)/offices/components/office-workforce-dashboard-v2.tsx" "lib/office-workforce-position-summary.ts" "utils/export-office-workforce.ts"`

Expected: all tests pass, TypeScript reports no errors, and ESLint reports no errors.
