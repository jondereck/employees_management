# Org Chart Spacing + Alignment Guides Design

## Goal

While dragging org-chart nodes, show **visible spacing (gap) guides** in addition to the existing center/edge alignment guides, so users can see and equalize the space between cards (Figma-style).

## Context

`OrgChartTool` already has:

- Blue dashed **alignment** guides (center / edges) with snap (`computeAlignmentGuides`, `AlignmentGuides`, threshold 8px)
- Canvas `snapToGrid` / `snapGrid={[10, 10]}`

Missing: **gap measurement** and **equal-spacing** snap/labels between neighboring cards. Users asked for option **C**: equal-spacing snap + visible gap labels.

## Approved decisions

- Approach: extend existing `computeAlignmentGuides` + `AlignmentGuides` (not a separate spacing engine).
- Keep blue align guides; add magenta/pink spacing brackets + px labels.
- Snap priority in one drag frame:
  1. Equal spacing (left≈right or top≈bottom within 8px) → snap X and/or Y
  2. Else existing center/edge align (8px)
  3. Else free move; still show nearest-gap label if gap ≤ 48px (measure only, no snap)
- Targets: skip annotations, hidden nodes, junctions, and line endpoints (same family as align).
- No settings toggle in v1.
- Hide spacing overlays on export (same class path as align guides).
- Scope: `components/tools/org-chart/OrgChartTool.tsx` only.

## Behavior

### While dragging a node

1. Compute bounds of the dragged node vs visible peers.
2. **Alignment** (unchanged logic): nearest vertical/horizontal center or edge match within 8px → blue dashed full-span lines + snap.
3. **Spacing**:
   - Find nearest neighbor on each side (left / right / top / bottom) by edge-to-edge gap (positive gaps only; overlapping ignored for equal-spacing).
   - **Equal horizontal:** if both left and right neighbors exist and `|gapLeft - gapRight| ≤ 8`, snap X so gaps match; show both gap brackets with the equalized px value.
   - **Equal vertical:** same for top/bottom → snap Y.
   - **Nearest measure:** if not equalizing on an axis, and nearest gap on that axis is `> 0` and `≤ 48`, show one bracket + label (no snap from spacing alone).
4. On drag stop: clear all helper lines and spacing markers.

### Snap conflict

If equal-spacing and align both want to adjust the same axis in one frame, **equal-spacing wins** on that axis. The other axis may still use align.

## Visuals

| Element | Style |
|---|---|
| Align guides | Existing: `#3b82f6`, dashed, full viewport span |
| Spacing brackets | `#ec4899`, short lines between the two facing edges (not full canvas) |
| Gap label | Centered on bracket; white fill, pink border, ~12px text, value like `24` |
| Lifetime | Drag only; cleared on stop; hidden when `.orgchart-exporting` |

Bracket geometry (flow coords → screen via viewport transform, same as align):

- Horizontal gap (between left/right neighbors): vertical tick marks on both card edges + horizontal connector through the mid-gap; label at midpoint.
- Vertical gap (between top/bottom neighbors): horizontal ticks + vertical connector; label at midpoint.

## Data shape (helper state)

Extend helper state beyond `{ vertical, horizontal }`, e.g.:

```ts
type SpacingGuide = {
  axis: "x" | "y";
  from: number; // flow coord along axis (edge)
  to: number;
  cross: number; // perpendicular mid position for bracket
  gap: number; // px, integer for label
};

type HelperGuides = {
  vertical: number | null;
  horizontal: number | null;
  spacings: SpacingGuide[];
};
```

`computeAlignmentGuides` (or a sibling `computeDragGuides`) returns snap X/Y plus the visual fields above.

## Out of scope

- Persistent rulers or always-on grid overlay beyond current dotted background
- Multi-select equal distribution tools
- Spacing relative to viewport / page margins
- User-configurable thresholds or colors
- Separate settings UI

## Success criteria

- Dragging near another person/unit/office shows a visible pink gap bracket + px label when gap ≤ 48px.
- Placing a card between two peers with nearly equal gaps snaps to equal spacing and shows matching labels on both sides.
- Existing blue center/edge align + snap still works when equal-spacing does not apply.
- Office switching and Sync do not show these guides.
- Export PDFs do not include guide overlays.
