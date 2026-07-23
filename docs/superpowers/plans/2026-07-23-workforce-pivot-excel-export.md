# Workforce Pivot Excel Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Matrix-only Download Excel button that exports a formatted `.xlsx` matching the on-screen pivot table.

**Architecture:** Pure sheet builder in `lib/workforce-pivot-export.ts` (AOA + styles + filename); UI calls it with current Matrix `result` and downloads via `xlsx-js-style` `writeFile`.

**Tech Stack:** `xlsx-js-style`, React client component, node:test.

## Global Constraints

- Matrix mode only; client-side from current `result`
- Nested blank-repeat primary labels; include Total footer
- Update `CHANGELOG.md` Unreleased

---

### Task 1: Export builder + tests

**Files:**
- Create: `lib/workforce-pivot-export.ts`
- Create: `tests/workforce-pivot-export.test.ts`

- [ ] Build AOA for nested and single-row pivots; filename helper
- [ ] Unit tests for sheet rows + filename
- [ ] Commit

### Task 2: UI button + changelog

**Files:**
- Modify: `WorkforcePivotTool.tsx`
- Modify: `CHANGELOG.md`

- [ ] Download Excel button on Matrix card; disabled when empty/loading
- [ ] Changelog line; commit
