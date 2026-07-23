# Org Chart Fullscreen Edit Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Taller normal Org Chart canvas plus a CSS fullscreen edit overlay with essential tools and a floating inspector.

**Architecture:** Keep all UI in `OrgChartTool.tsx`. Add `isFullscreenEdit` state that switches the root wrapper to `fixed inset-0 z-50` and hides sidebars. Compact the org-chart page ToolsLayout chrome. Reuse existing selected-node controls in a floating panel when fullscreen + selection.

**Tech Stack:** Next.js React, existing shadcn Button/Card, React Flow, Tailwind.

## Global Constraints

- CSS overlay only (no browser Fullscreen API).
- Preserve chart state on enter/exit.
- Esc exits fullscreen.
- Update CHANGELOG Unreleased.

---

### Task 1: Compact page + taller height

**Files:**
- Modify: `app/(dashboard)/[departmentId]/(routes)/tools/org-chart/page.tsx`
- Modify: `components/layouts/tools-layout.tsx` (optional compact prop)
- Modify: `components/tools/org-chart/OrgChartTool.tsx` (height calc)

- [ ] Add compact mode to ToolsLayout OR page-specific className to reduce padding/title footprint for org-chart.
- [ ] Change tool root height from `100dvh - 170px` to near `100dvh - navbar` (~72px), accounting for DEFAULT_TOOL_UI_SCALE.
- [ ] Verify normal 3-column layout still works.

### Task 2: Fullscreen toggle + compact toolbar

**Files:**
- Modify: `components/tools/org-chart/OrgChartTool.tsx`

- [ ] Add `isFullscreenEdit` state; button “Fullscreen edit”; Esc listener to exit.
- [ ] When true: root `fixed inset-0 z-50`, hide left/right asides and redundant page header chrome inside the tool if duplicated.
- [ ] Compact top bar with Exit, Version, Sync, Save, Select/Hand/Text, Add actions, Undo/Redo, Zoom/Fit.

### Task 3: Floating inspector

**Files:**
- Modify: `components/tools/org-chart/OrgChartTool.tsx`

- [ ] When fullscreen and a node is selected, show floating inspector reusing Selected Node fields/actions.
- [ ] Hide when deselected or exiting fullscreen.

### Task 4: Changelog + smoke check

- [ ] Add Unreleased changelog line.
- [ ] Manual smoke: taller normal, enter/exit fullscreen, Esc, edit selected node, sync/save still available.
