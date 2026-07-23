# Org Chart Fullscreen Edit Design

## Goal

Give the Org Chart Builder more usable canvas space: taller normal layout (no dead space at the bottom) and a focus-mode fullscreen edit overlay with essential tools only.

## Approved decisions

- Approach: CSS focus overlay (`fixed inset-0`), not browser Fullscreen API.
- Normal view: keep 3-column layout (Offices | Canvas | Selected Node) but fill near-full viewport height.
- Fullscreen: hide app nav, ToolsLayout chrome, left sidebar, and right sidebar.
- Compact top bar: Exit, Version, Sync from DB, Save version, Select/Hand/Text, Add office/unit/person, Undo/Redo, Zoom/Fit.
- Floating inspector when a node is selected (slim right-edge panel; same fields as today’s Selected Node).
- Esc or Exit restores normal view without reload; chart state preserved.
- Mockup approved: normal taller + fullscreen with floating inspector.

## Layout / height

- Org chart page: compact `ToolsLayout` usage (reduce padding / avoid double page title waste where practical).
- Tool root height: near `100dvh` minus app navbar (~64–72px), replacing loose `100dvh - 170px` that leaves bottom dead space.
- Preserve existing UI scale transform behavior if still required.

## Fullscreen behavior

- Toggle via **Fullscreen edit** button in the normal toolbar/header.
- Enter: root (or a dedicated portal wrapper) becomes `fixed inset-0 z-50 bg-background` covering the app.
- Hide: left Offices aside, right Selected Node aside, page/app chrome (covered by overlay).
- Show: compact top bar + full-height canvas + conditional floating inspector.
- Exit: button or Escape; return to previous non-fullscreen layout.

## Floating inspector (fullscreen only)

- Appears when a single node is selected.
- Reuses existing selected-node edit controls (name, title, type, head toggle, notes, duplicate, remove) in a compact floating card.
- Hidden when nothing selected or when exiting fullscreen.

## Out of scope

- Browser Fullscreen API / F11
- Always-immersive page with no toggle
- Office dropdown in fullscreen top bar (v1 skip)
- Changing reconcile / Sync from DB behavior

## Files likely touched

- `app/(dashboard)/[departmentId]/(routes)/tools/org-chart/page.tsx`
- `components/tools/org-chart/OrgChartTool.tsx`
- Possibly `components/layouts/tools-layout.tsx` only if a compact prop is needed

## Verification

- Normal view: canvas reaches near bottom of viewport; sidebars still work.
- Fullscreen: overlay covers app chrome; only compact tools + canvas (+ inspector when selected).
- Esc / Exit returns to normal with nodes/edges/version unchanged.
- Sync / Save / zoom / add dialogs still work in fullscreen.
- Update Unreleased changelog.
