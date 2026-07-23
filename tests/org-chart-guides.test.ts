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
  // Available span 200; equal gaps => x=150, gap=50 each
  // Place slightly off (gapL=46, gapR=54) within 8px of equal
  const dragged = box("D", 146, 0);
  const result = computeDragGuides(dragged, [left, right]);
  assert.equal(result.snapX, 150);
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
  const dragged = box("D", 148, 0);
  const result = computeDragGuides(dragged, [left, right]);
  assert.equal(result.snapX, 150);
});

test("equal vertical gaps snap Y", () => {
  const top = box("T", 0, 0);
  const bottom = box("B", 0, 200);
  // Equal gaps = 50; at y=104: gapT=54, gapB=46 (diff 8 ≤ 8)
  const draggedNear = box("D3", 0, 104);
  const result = computeDragGuides(draggedNear, [top, bottom]);
  assert.equal(result.snapY, 100);
  assert.ok(result.spacings.some((s) => s.axis === "y" && s.gap === 50));
});
