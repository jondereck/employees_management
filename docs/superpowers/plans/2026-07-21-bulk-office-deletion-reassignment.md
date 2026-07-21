# Bulk Office Deletion Reassignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply one destination office and optional division to every employee affected by office deletion.

**Architecture:** Add a pure payload-expansion helper to the existing office-deletion domain module. Replace per-employee form state and controls with one bulk selection while preserving the current DELETE API contract and server validation.

**Tech Stack:** TypeScript, React, Next.js 14, Radix Select, Node test runner

## Global Constraints

- Division applies only to employees with an `assigned` deletion reason.
- Changing office clears division.
- Existing employee cards and backend validation remain intact.
- Update `CHANGELOG.md` under Unreleased.

---

### Task 1: Bulk reassignment payload

**Files:**
- Modify: `tests/office-deletion.test.ts`
- Modify: `lib/office-deletion.ts`

**Interfaces:**
- Produces: `buildBulkOfficeReassignments(employees, officeId, officeDivisionId): OfficeReassignment[]`

- [ ] Add a failing test proving all employees receive the office and only assigned employees receive the division.
- [ ] Run `npx tsx --test tests/office-deletion.test.ts` and confirm the missing export failure.
- [ ] Implement the minimal mapping helper.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Single bulk controls

**Files:**
- Modify: `app/(dashboard)/[departmentId]/(routes)/offices/components/office-deletion-modal.tsx`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `buildBulkOfficeReassignments`

- [ ] Replace employee-keyed destination state with one office and one division state.
- [ ] Render the bulk controls above read-only employee cards.
- [ ] Build the existing DELETE payload through the tested helper.
- [ ] Update the changelog.
- [ ] Run focused tests, TypeScript, and lint.
