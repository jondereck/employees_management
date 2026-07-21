import assert from "node:assert/strict";
import test from "node:test";

import { buildDashboardPlantillaSummary } from "../lib/dashboard-plantilla";

test("counts active slots and non-archived occupants only", () => {
  assert.deepEqual(
    buildDashboardPlantillaSummary({
      offices: [],
      plantillaPositions: [
        { id: "slot-1", officeId: "office-1", isActive: true },
        { id: "slot-2", officeId: "office-1", isActive: true },
        { id: "slot-3", officeId: "office-1", isActive: false },
      ],
      employees: [
        {
          id: "employee-1",
          officeId: "office-1",
          plantillaPositionId: "slot-1",
          isArchived: false,
        },
        {
          id: "employee-2",
          officeId: "office-1",
          plantillaPositionId: "slot-2",
          isArchived: true,
        },
      ],
    }),
    { total: 2, filled: 1, vacant: 1, occupancyRate: 50 },
  );
});

test("returns zeros when there are no positions or employees", () => {
  assert.deepEqual(
    buildDashboardPlantillaSummary({
      offices: [],
      plantillaPositions: [],
      employees: [],
    }),
    { total: 0, filled: 0, vacant: 0, occupancyRate: 0 },
  );
});

test("rounds occupancy rate to one decimal place", () => {
  assert.deepEqual(
    buildDashboardPlantillaSummary({
      offices: [],
      plantillaPositions: [
        { id: "slot-1", officeId: "office-1", isActive: true },
        { id: "slot-2", officeId: "office-1", isActive: true },
        { id: "slot-3", officeId: "office-1", isActive: true },
      ],
      employees: [
        {
          id: "employee-1",
          officeId: "office-1",
          plantillaPositionId: "slot-1",
          isArchived: false,
        },
      ],
    }),
    { total: 3, filled: 1, vacant: 2, occupancyRate: 33.3 },
  );
});
