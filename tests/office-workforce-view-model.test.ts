import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOfficeWorkforceChartRows,
  enrichOfficeRowsWithWorkforce,
  filterOfficeWorkforceComparisonRows,
  getCombinedCrossOfficeCount,
  getWorkforceViewLabel,
  shouldRenderChartSegmentLabel,
} from "../lib/office-workforce-view-model";

const metrics = {
  totalPlantillaSlots: 8,
  activePlantillaSlots: 7,
  filledPlantillaSlots: 5,
  vacantPlantillaSlots: 2,
  vacancyRate: 28.57,
  assignedHereButPlantillaElsewhere: 3,
  plantillaHereButAssignedElsewhere: 4,
};

test("buildOfficeWorkforceChartRows sorts names deterministically and maps chart values", () => {
  const rows = buildOfficeWorkforceChartRows([
    {
      officeId: "empty",
      officeName: "No Plantilla",
      ...metrics,
      totalPlantillaSlots: 0,
      activePlantillaSlots: 0,
      filledPlantillaSlots: 0,
      vacantPlantillaSlots: 0,
    },
    { officeId: "z", officeName: "  Beta ", ...metrics },
    {
      officeId: "b",
      officeName: "alpha",
      ...metrics,
      filledPlantillaSlots: 2,
      vacantPlantillaSlots: 5,
    },
    { officeId: "a", officeName: "Alpha", ...metrics },
  ]);

  assert.deepEqual(
    rows.map(({ officeId, officeName, filled, vacant }) => ({
      officeId,
      officeName,
      filled,
      vacant,
    })),
    [
      { officeId: "a", officeName: "Alpha", filled: 5, vacant: 2 },
      { officeId: "b", officeName: "alpha", filled: 2, vacant: 5 },
      { officeId: "z", officeName: "Beta", filled: 5, vacant: 2 },
    ]
  );
});

test("filterOfficeWorkforceComparisonRows omits offices without active plantilla", () => {
  const rows = filterOfficeWorkforceComparisonRows([
    { officeId: "active", officeName: "Active", ...metrics },
    {
      officeId: "empty",
      officeName: "Empty",
      ...metrics,
      totalPlantillaSlots: 0,
      activePlantillaSlots: 0,
      filledPlantillaSlots: 0,
      vacantPlantillaSlots: 0,
    },
  ]);

  assert.deepEqual(rows.map((row) => row.officeId), ["active"]);
});

test("getCombinedCrossOfficeCount includes both cross-office directions", () => {
  assert.equal(getCombinedCrossOfficeCount(metrics), 7);
});

test("enrichOfficeRowsWithWorkforce preserves offices and fills missing metrics with zero", () => {
  const rows = enrichOfficeRowsWithWorkforce(
    [
      { id: "one", name: "One" },
      { id: "two", name: "Two" },
    ],
    [{ officeId: "two", officeName: "Two", ...metrics }]
  );

  assert.equal(rows[0].activePlantillaSlots, 0);
  assert.equal(rows[0].plantillaCount, 0);
  assert.equal(rows[0].crossOfficeCount, 0);
  assert.equal(rows[1].plantillaCount, 8);
  assert.equal(rows[1].filledPlantillaSlots, 5);
  assert.equal(rows[1].crossOfficeCount, 7);
});

test("shouldRenderChartSegmentLabel hides values that do not fit the segment", () => {
  assert.equal(shouldRenderChartSegmentLabel(23, 1), false);
  assert.equal(shouldRenderChartSegmentLabel(24, 1), true);
  assert.equal(shouldRenderChartSegmentLabel(35, 100), false);
  assert.equal(shouldRenderChartSegmentLabel(36, 100), true);
  assert.equal(shouldRenderChartSegmentLabel(100, 0), false);
});

test("getWorkforceViewLabel uses direct, non-color-dependent labels", () => {
  assert.equal(getWorkforceViewLabel("vacant"), "Vacant plantilla");
  assert.equal(
    getWorkforceViewLabel("assigned-here-plantilla-elsewhere"),
    "Assigned here, plantilla elsewhere"
  );
  assert.equal(
    getWorkforceViewLabel("plantilla-here-assigned-elsewhere"),
    "Plantilla here, assigned elsewhere"
  );
});
