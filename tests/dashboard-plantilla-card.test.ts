import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboardSource = readFileSync(
  "app/(dashboard)/[departmentId]/(routes)/page.tsx",
  "utf8",
);

test("uses the dedicated Plantilla metric in the top dashboard row", () => {
  assert.match(dashboardSource, /function PlantillaMetricCard/);
  assert.match(dashboardSource, />\s*Plantilla\s*</);
  assert.match(dashboardSource, /dashboardSummary\.plantilla/);
  assert.match(dashboardSource, /href=\{`\/\$\{departmentId\}\/offices`\}/);
});

test("removes only the Pending Approvals top metric", () => {
  assert.doesNotMatch(dashboardSource, /title="Pending Approvals"/);
  assert.match(dashboardSource, /label: "Pending approvals"/);
});

test("exposes occupancy progress semantics", () => {
  assert.match(dashboardSource, /role="progressbar"/);
  assert.match(dashboardSource, /aria-valuenow=\{occupancyRate\}/);
  assert.match(dashboardSource, /Occupancy/);
});
