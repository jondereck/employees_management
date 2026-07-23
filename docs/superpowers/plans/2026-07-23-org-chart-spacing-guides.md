# Org Chart Spacing Guides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While dragging org-chart cards, show pink gap brackets + px labels and equal-spacing snap, on top of existing blue align guides.

**Architecture:** Extract pure guide math into `lib/org-chart-guides.ts` (testable). Wire results into `OrgChartTool` drag handlers and extend `AlignmentGuides` SVG to render spacing brackets. Align snap stays; equal-spacing overrides snap on the same axis.

**Tech Stack:** TypeScript, node:test, React Flow overlay SVG in `OrgChartTool.tsx`.

## Global Constraints

- Equal-spacing threshold: 8px; nearest measure max: 48px; align threshold: 8px (unchanged).
- Skip targets: annotation, junction, lineEndpoint, hidden.
- Snap priority: equal spacing > center/edge align > free (measure-only labels still show ≤48px).
- Spacing color `#ec4899`; align stays `#3b82f6`.
- Hide under `.orgchart-exporting .orgchart-align-guides`.
- No settings toggle in v1.
- Update `CHANGELOG.md` Unreleased.

## File map

| File | Responsibility |
|---|---|
| `lib/org-chart-guides.ts` | Pure `computeDragGuides` + types |
| `tests/org-chart-guides.test.ts` | Unit tests for equal snap + measure labels |
| `components/tools/org-chart/OrgChartTool.tsx` | Call compute on drag; render spacings; clear on stop |
| `CHANGELOG.md` | One Unreleased line |

---

### Task 1: Pure guide computation + tests

**Files:**
- Create: `lib/org-chart-guides.ts`
- Create: `tests/org-chart-guides.test.ts`

**Interfaces:**
- Produces:
  - `GuideBounds` `{ id, left, right, top, bottom, centerX, centerY, width, height }`
  - `SpacingGuide` `{ axis: "x" \| "y"; from: number; to: number; cross: number; gap: number }`
  - `DragGuidesResult` `{ vertical, horizontal, snapX, snapY, spacings }`
  - `computeDragGuides(dragged, others, options?)`

- [ ] **Step 1: Write failing tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { computeDragGuides, type GuideBounds } from "../lib/org-chart-guides";

const box = (
  id: string,
  x: number,
  y: number,
  w = 100,
  h = 50
): GuideBounds => ({
  id,
  left: x,
  right: x + w,
  top: y,
  bottom: y + h,
  centerX: x + w / 2,
  centerY: y + h / 2,
  width: w,
  height: h,
});

test("equal horizontal gaps snap X and emit two spacing guides", () => {
  const left = box("L", 0, 0);
  const right = box("R", 300, 0);
  // Dragged width 100; span 300-100=200; equal gaps => x=100, gap=50 each
  // Place slightly off (gapL=40, gapR=60) within 8px of equal
  const dragged = box("D", 140, 0);
  const result = computeDragGuides(dragged, [left, right]);
  assert.equal(result.snapX, 100);
  assert.equal(result.spacings.length, 2);
  assert.ok(result.spacings.every((s) => s.axis === "x" && s.gap === 50));
});

test("nearest gap <= 48 shows measure label without snap", () => {
  const peer = box("P", 0, 0);
  const dragged = box("D", 130, 0); // gap = 30
  const result = computeDragGuides(dragged, [peer]);
  assert.equal(result.snapX, null);
  assert.equal(result.spacings.length, 1);
  assert.equal(result.spacings[0]?.gap, 30);
  assert.equal(result.spacings[0]?.axis, "x");
});

test("equal spacing overrides align snap on same axis", () => {
  const left = box("L", 0, 0);
  const right = box("R", 300, 0);
  // Center-aligned with left (both centerY=25) but X slightly off equal
  const dragged = box("D", 142, 0);
  const result = computeDragGuides(dragged, [left, right]);
  assert.equal(result.snapX, 100);
});
```

- [ ] **Step 2: Run tests — expect FAIL (module missing)**

Run: `node --import tsx --test tests/org-chart-guides.test.ts`  
(or project `npm test` filter if wired). Expected: cannot find module / FAIL.

- [ ] **Step 3: Implement `lib/org-chart-guides.ts`**

```ts
export type GuideBounds = {
  id: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
};

export type SpacingGuide = {
  axis: "x" | "y";
  from: number;
  to: number;
  cross: number;
  gap: number;
};

export type DragGuidesResult = {
  vertical: number | null;
  horizontal: number | null;
  snapX: number | null;
  snapY: number | null;
  spacings: SpacingGuide[];
};

type Options = {
  alignThreshold?: number;
  equalSpacingThreshold?: number;
  measureMaxGap?: number;
};

type SideHit = { gap: number; edge: number; peerEdge: number; cross: number };

export function computeDragGuides(
  dragged: GuideBounds,
  others: GuideBounds[],
  options: Options = {}
): DragGuidesResult {
  const alignThreshold = options.alignThreshold ?? 8;
  const equalSpacingThreshold = options.equalSpacingThreshold ?? 8;
  const measureMaxGap = options.measureMaxGap ?? 48;

  // 1) Align (same candidate set as current OrgChartTool computeAlignmentGuides)
  let vertical: number | null = null;
  let horizontal: number | null = null;
  let snapX: number | null = null;
  let snapY: number | null = null;
  let bestV = alignThreshold;
  let bestH = alignThreshold;

  for (const target of others) {
    const verticalCandidates = [
      { guide: target.centerX, distance: Math.abs(dragged.centerX - target.centerX), snap: target.centerX - dragged.width / 2 },
      { guide: target.left, distance: Math.abs(dragged.left - target.left), snap: target.left },
      { guide: target.right, distance: Math.abs(dragged.right - target.right), snap: target.right - dragged.width },
      { guide: target.left, distance: Math.abs(dragged.right - target.left), snap: target.left - dragged.width },
      { guide: target.right, distance: Math.abs(dragged.left - target.right), snap: target.right },
    ];
    for (const c of verticalCandidates) {
      if (c.distance <= bestV) {
        bestV = c.distance;
        vertical = c.guide;
        snapX = c.snap;
      }
    }
    const horizontalCandidates = [
      { guide: target.centerY, distance: Math.abs(dragged.centerY - target.centerY), snap: target.centerY - dragged.height / 2 },
      { guide: target.top, distance: Math.abs(dragged.top - target.top), snap: target.top },
      { guide: target.bottom, distance: Math.abs(dragged.bottom - target.bottom), snap: target.bottom - dragged.height },
      { guide: target.top, distance: Math.abs(dragged.bottom - target.top), snap: target.top - dragged.height },
      { guide: target.bottom, distance: Math.abs(dragged.top - target.bottom), snap: target.bottom },
    ];
    for (const c of horizontalCandidates) {
      if (c.distance <= bestH) {
        bestH = c.distance;
        horizontal = c.guide;
        snapY = c.snap;
      }
    }
  }

  // 2) Nearest neighbor per side (positive gap only)
  let leftHit: SideHit | null = null;
  let rightHit: SideHit | null = null;
  let topHit: SideHit | null = null;
  let bottomHit: SideHit | null = null;

  for (const peer of others) {
    const crossY = (Math.max(dragged.top, peer.top) + Math.min(dragged.bottom, peer.bottom)) / 2;
    const crossX = (Math.max(dragged.left, peer.left) + Math.min(dragged.right, peer.right)) / 2;
    const overlapY = Math.min(dragged.bottom, peer.bottom) - Math.max(dragged.top, peer.top);
    const overlapX = Math.min(dragged.right, peer.right) - Math.max(dragged.left, peer.left);

    if (overlapY > 0) {
      const gapL = dragged.left - peer.right;
      if (gapL > 0 && (!leftHit || gapL < leftHit.gap)) {
        leftHit = { gap: gapL, edge: dragged.left, peerEdge: peer.right, cross: crossY };
      }
      const gapR = peer.left - dragged.right;
      if (gapR > 0 && (!rightHit || gapR < rightHit.gap)) {
        rightHit = { gap: gapR, edge: dragged.right, peerEdge: peer.left, cross: crossY };
      }
    }
    if (overlapX > 0) {
      const gapT = dragged.top - peer.bottom;
      if (gapT > 0 && (!topHit || gapT < topHit.gap)) {
        topHit = { gap: gapT, edge: dragged.top, peerEdge: peer.bottom, cross: crossX };
      }
      const gapB = peer.top - dragged.bottom;
      if (gapB > 0 && (!bottomHit || gapB < bottomHit.gap)) {
        bottomHit = { gap: gapB, edge: dragged.bottom, peerEdge: peer.top, cross: crossX };
      }
    }
  }

  const spacings: SpacingGuide[] = [];

  // 3) Equal horizontal → override snapX
  if (leftHit && rightHit && Math.abs(leftHit.gap - rightHit.gap) <= equalSpacingThreshold) {
    const available = rightHit.peerEdge - leftHit.peerEdge;
    const equalGap = (available - dragged.width) / 2;
    snapX = leftHit.peerEdge + equalGap;
    const gap = Math.round(equalGap);
    spacings.push(
      { axis: "x", from: leftHit.peerEdge, to: leftHit.peerEdge + equalGap, cross: leftHit.cross, gap },
      { axis: "x", from: snapX + dragged.width, to: rightHit.peerEdge, cross: rightHit.cross, gap }
    );
  } else {
    const nearestX = [leftHit, rightHit]
      .filter((h): h is SideHit => Boolean(h))
      .sort((a, b) => a.gap - b.gap)[0];
    if (nearestX && nearestX.gap <= measureMaxGap) {
      spacings.push({
        axis: "x",
        from: Math.min(nearestX.edge, nearestX.peerEdge),
        to: Math.max(nearestX.edge, nearestX.peerEdge),
        cross: nearestX.cross,
        gap: Math.round(nearestX.gap),
      });
    }
  }

  // 4) Equal vertical → override snapY
  if (topHit && bottomHit && Math.abs(topHit.gap - bottomHit.gap) <= equalSpacingThreshold) {
    const available = bottomHit.peerEdge - topHit.peerEdge;
    const equalGap = (available - dragged.height) / 2;
    snapY = topHit.peerEdge + equalGap;
    const gap = Math.round(equalGap);
    spacings.push(
      { axis: "y", from: topHit.peerEdge, to: topHit.peerEdge + equalGap, cross: topHit.cross, gap },
      { axis: "y", from: snapY + dragged.height, to: bottomHit.peerEdge, cross: bottomHit.cross, gap }
    );
  } else {
    const nearestY = [topHit, bottomHit]
      .filter((h): h is SideHit => Boolean(h))
      .sort((a, b) => a.gap - b.gap)[0];
    if (nearestY && nearestY.gap <= measureMaxGap) {
      spacings.push({
        axis: "y",
        from: Math.min(nearestY.edge, nearestY.peerEdge),
        to: Math.max(nearestY.edge, nearestY.peerEdge),
        cross: nearestY.cross,
        gap: Math.round(nearestY.gap),
      });
    }
  }

  return { vertical, horizontal, snapX, snapY, spacings };
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `node --import tsx --test tests/org-chart-guides.test.ts`  
Expected: all tests pass.

- [ ] **Step 5: Commit** (only if user asked; skip otherwise)

---

### Task 2: Wire into OrgChartTool UI

**Files:**
- Modify: `components/tools/org-chart/OrgChartTool.tsx`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `computeDragGuides`, `SpacingGuide` from `@/lib/org-chart-guides`
- Produces: pink brackets in `AlignmentGuides`; `helperLines.spacings`

- [ ] **Step 1: Replace local `computeAlignmentGuides` with `computeDragGuides`**

In `handleNodeDrag`:
1. Build `GuideBounds` for dragged via `getFlowNodeBounds`.
2. Filter peers: not same id, not hidden, type not in `annotation|junction|lineEndpoint`.
3. Call `computeDragGuides`.
4. `setHelperLines({ vertical, horizontal, spacings })`.
5. Apply `snapX`/`snapY` as today.

On drag stop: `setHelperLines({ vertical: null, horizontal: null, spacings: [] })`.

Remove unused local `computeAlignmentGuides`.

- [ ] **Step 2: Extend `AlignmentGuides` to render spacings**

For each spacing:
- axis `x`: horizontal connector at `cross`, from `from`→`to`, vertical ticks at ends (tick ±6 screen px); label at midpoint.
- axis `y`: vertical connector at `cross`, horizontal ticks; label at midpoint.
- Stroke/fill `#ec4899`; label white rect + pink stroke + text `${gap}`.
- Transform with same `tx, ty, zoom` as align lines.

Props: add `spacings: SpacingGuide[]`.

- [ ] **Step 3: Changelog**

`- 2026-07-23 — feat: org chart drag spacing guides (gap labels + equal-spacing snap)`

- [ ] **Step 4: Manual check**

Drag person near another → pink gap + px. Place between two peers with nearly equal gaps → snap + two matching labels. Align center still works when not equalizing. Export still hides `.orgchart-align-guides`.

---

## Spec coverage self-review

| Spec item | Task |
|---|---|
| Equal gap snap + dual brackets | Task 1 + 2 |
| Nearest ≤48 measure label | Task 1 + 2 |
| Blue align kept; equal wins same axis | Task 1 |
| Skip annotation/junction/lineEndpoint/hidden | Task 2 filter |
| Pink `#ec4899`, export hide | Task 2 |
| No settings toggle | N/A (omitted) |
| CHANGELOG | Task 2 |
