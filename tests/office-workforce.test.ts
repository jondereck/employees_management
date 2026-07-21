import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateOfficeWorkforce,
  buildWorkforceDetailsRelationScopes,
  classifyWorkforceDetailsView,
  mapEmployeeWorkforceDetail,
  mapWorkforceOffice,
  mapVacantWorkforceDetail,
  parseWorkforceDetailsView,
} from "../lib/office-workforce";

test("workforce detail view validation is strict and classifies query source", () => {
  assert.equal(parseWorkforceDetailsView("vacant"), "vacant");
  assert.equal(
    parseWorkforceDetailsView("assigned-here-plantilla-elsewhere"),
    "assigned-here-plantilla-elsewhere"
  );
  assert.equal(
    parseWorkforceDetailsView("plantilla-here-assigned-elsewhere"),
    "plantilla-here-assigned-elsewhere"
  );
  assert.equal(parseWorkforceDetailsView("Vacant"), null);
  assert.equal(parseWorkforceDetailsView(" vacant "), null);
  assert.equal(parseWorkforceDetailsView(null), null);
  assert.equal(classifyWorkforceDetailsView("vacant"), "plantilla");
  assert.equal(
    classifyWorkforceDetailsView("assigned-here-plantilla-elsewhere"),
    "employee-assignment"
  );
  assert.equal(
    classifyWorkforceDetailsView("plantilla-here-assigned-elsewhere"),
    "employee-plantilla"
  );
});

test("maps vacant plantilla rows to minimal drawer fields", () => {
  assert.deepEqual(
    mapVacantWorkforceDetail({
      id: "slot-1",
      title: "Administrative Aide IV",
      itemNumber: "A-1",
      salaryGrade: 4,
      officeDivision: { id: "division-1", name: "BAC" },
      employeeType: { id: "type-1", name: "Casual" },
    }),
    {
      kind: "vacant",
      plantillaPositionId: "slot-1",
      title: "Administrative Aide IV",
      itemNumber: "A-1",
      salaryGrade: 4,
      division: { id: "division-1", name: "BAC" },
      employeeType: { id: "type-1", name: "Casual" },
    }
  );
});

test("maps cross-office employees to minimal drawer fields", () => {
  assert.deepEqual(
    mapEmployeeWorkforceDetail({
      id: "employee-1",
      firstName: "Randy",
      middleName: "A",
      lastName: "Wapson",
      suffix: "Jr.",
      position: "Administrative Aide IV",
      offices: { id: "assigned", name: "Assigned Office" },
      plantillaPosition: {
        office: { id: "plantilla", name: "Plantilla Office" },
      },
    }),
    {
      kind: "employee",
      employeeId: "employee-1",
      name: "Wapson, Randy A. Jr.",
      position: "Administrative Aide IV",
      assignedOffice: { id: "assigned", name: "Assigned Office" },
      plantillaOffice: { id: "plantilla", name: "Plantilla Office" },
    }
  );
});

test("workforce detail relation scopes always include department ownership", () => {
  assert.deepEqual(
    buildWorkforceDetailsRelationScopes("vacant", "department-1", "office-1"),
    {
      archivedOccupant: {
        departmentId: "department-1",
        isArchived: true,
      },
    }
  );
  assert.deepEqual(
    buildWorkforceDetailsRelationScopes(
      "assigned-here-plantilla-elsewhere",
      "department-1",
      "office-1"
    ),
    {
      plantillaPosition: {
        departmentId: "department-1",
        isActive: true,
        officeId: { not: "office-1" },
      },
    }
  );
  assert.deepEqual(
    buildWorkforceDetailsRelationScopes(
      "plantilla-here-assigned-elsewhere",
      "department-1",
      "office-1"
    ),
    {
      plantillaPosition: {
        departmentId: "department-1",
        isActive: true,
        officeId: "office-1",
      },
    }
  );
});

test("workforce office response exposes only id and name", () => {
  assert.deepEqual(
    mapWorkforceOffice({
      id: "office-1",
      name: "HRMO",
      departmentId: "department-1",
    }),
    { id: "office-1", name: "HRMO" }
  );
});

test("includes empty offices and returns zero-safe vacancy math", () => {
  const result = aggregateOfficeWorkforce({
    offices: [{ id: "empty", name: "Empty Office" }],
    plantillaPositions: [],
    employees: [],
  });

  assert.deepEqual(result.totals, {
    activeAssignedEmployees: 0,
    archivedAssignedEmployees: 0,
    totalPlantillaSlots: 0,
    activePlantillaSlots: 0,
    filledPlantillaSlots: 0,
    vacantPlantillaSlots: 0,
    vacancyRate: 0,
    assignedHereButPlantillaElsewhere: 0,
    plantillaHereButAssignedElsewhere: 0,
  });
  assert.deepEqual(result.offices, [
    {
      officeId: "empty",
      officeName: "Empty Office",
      ...result.totals,
    },
  ]);
});

test("inactive slots count only toward total plantilla slots", () => {
  const result = aggregateOfficeWorkforce({
    offices: [{ id: "a", name: "Office A" }],
    plantillaPositions: [
      { id: "active", officeId: "a", isActive: true },
      { id: "inactive", officeId: "a", isActive: false },
    ],
    employees: [
      {
        id: "inactive-occupant",
        officeId: "a",
        plantillaPositionId: "inactive",
        isArchived: false,
      },
    ],
  });

  assert.equal(result.totals.totalPlantillaSlots, 2);
  assert.equal(result.totals.activePlantillaSlots, 1);
  assert.equal(result.totals.filledPlantillaSlots, 0);
  assert.equal(result.totals.vacantPlantillaSlots, 1);
  assert.equal(result.totals.vacancyRate, 100);
});

test("inactive slots do not contribute cross-office counts", () => {
  const result = aggregateOfficeWorkforce({
    offices: [
      { id: "a", name: "Office A" },
      { id: "b", name: "Office B" },
    ],
    plantillaPositions: [
      { id: "inactive-a", officeId: "a", isActive: false },
    ],
    employees: [
      {
        id: "active-employee-in-b",
        officeId: "b",
        plantillaPositionId: "inactive-a",
        isArchived: false,
      },
    ],
  });

  assert.equal(result.totals.assignedHereButPlantillaElsewhere, 0);
  assert.equal(result.totals.plantillaHereButAssignedElsewhere, 0);
  assert.equal(
    result.offices.find((office) => office.officeId === "a")
      ?.plantillaHereButAssignedElsewhere,
    0
  );
  assert.equal(
    result.offices.find((office) => office.officeId === "b")
      ?.assignedHereButPlantillaElsewhere,
    0
  );
});

test("counts active and archived employees by their assigned office", () => {
  const result = aggregateOfficeWorkforce({
    offices: [
      { id: "a", name: "Office A" },
      { id: "b", name: "Office B" },
    ],
    plantillaPositions: [{ id: "slot-a", officeId: "a", isActive: true }],
    employees: [
      {
        id: "active-with-plantilla",
        officeId: "a",
        plantillaPositionId: "slot-a",
        isArchived: false,
      },
      {
        id: "active-without-plantilla",
        officeId: "a",
        plantillaPositionId: null,
        isArchived: false,
      },
      {
        id: "archived",
        officeId: "a",
        plantillaPositionId: null,
        isArchived: true,
      },
      {
        id: "active-in-b",
        officeId: "b",
        plantillaPositionId: null,
        isArchived: false,
      },
    ],
  });

  const officeA = result.offices.find((office) => office.officeId === "a");
  const officeB = result.offices.find((office) => office.officeId === "b");
  assert.equal(officeA?.activeAssignedEmployees, 2);
  assert.equal(officeA?.archivedAssignedEmployees, 1);
  assert.equal(officeB?.activeAssignedEmployees, 1);
  assert.equal(officeB?.archivedAssignedEmployees, 0);
  assert.equal(result.totals.activeAssignedEmployees, 3);
  assert.equal(result.totals.archivedAssignedEmployees, 1);
});

test("archived employees do not occupy slots or contribute cross-office counts", () => {
  const result = aggregateOfficeWorkforce({
    offices: [
      { id: "a", name: "Office A" },
      { id: "b", name: "Office B" },
    ],
    plantillaPositions: [{ id: "slot-a", officeId: "a", isActive: true }],
    employees: [
      {
        id: "archived",
        officeId: "b",
        plantillaPositionId: "slot-a",
        isArchived: true,
      },
    ],
  });

  assert.equal(result.totals.filledPlantillaSlots, 0);
  assert.equal(result.totals.vacantPlantillaSlots, 1);
  assert.equal(result.totals.assignedHereButPlantillaElsewhere, 0);
  assert.equal(result.totals.plantillaHereButAssignedElsewhere, 0);
});

test("counts both directions of cross-office assignment", () => {
  const result = aggregateOfficeWorkforce({
    offices: [
      { id: "a", name: "Office A" },
      { id: "b", name: "Office B" },
    ],
    plantillaPositions: [
      { id: "slot-a", officeId: "a", isActive: true },
      { id: "slot-b", officeId: "b", isActive: true },
    ],
    employees: [
      {
        id: "employee-in-b",
        officeId: "b",
        plantillaPositionId: "slot-a",
        isArchived: false,
      },
    ],
  });

  const officeA = result.offices.find((office) => office.officeId === "a");
  const officeB = result.offices.find((office) => office.officeId === "b");
  assert.equal(officeA?.plantillaHereButAssignedElsewhere, 1);
  assert.equal(officeA?.assignedHereButPlantillaElsewhere, 0);
  assert.equal(officeB?.assignedHereButPlantillaElsewhere, 1);
  assert.equal(officeB?.plantillaHereButAssignedElsewhere, 0);
  assert.equal(result.totals.assignedHereButPlantillaElsewhere, 1);
  assert.equal(result.totals.plantillaHereButAssignedElsewhere, 1);
});

test("calculates filled, vacant, vacancy rate, and overall totals from active slots", () => {
  const result = aggregateOfficeWorkforce({
    offices: [
      { id: "a", name: "Office A" },
      { id: "b", name: "Office B" },
    ],
    plantillaPositions: [
      { id: "a-1", officeId: "a", isActive: true },
      { id: "a-2", officeId: "a", isActive: true },
      { id: "b-1", officeId: "b", isActive: true },
      { id: "b-2", officeId: "b", isActive: false },
    ],
    employees: [
      { id: "e1", officeId: "a", plantillaPositionId: "a-1", isArchived: false },
      { id: "e2", officeId: "b", plantillaPositionId: "b-1", isArchived: false },
    ],
  });

  assert.deepEqual(result.totals, {
    activeAssignedEmployees: 2,
    archivedAssignedEmployees: 0,
    totalPlantillaSlots: 4,
    activePlantillaSlots: 3,
    filledPlantillaSlots: 2,
    vacantPlantillaSlots: 1,
    vacancyRate: 100 / 3,
    assignedHereButPlantillaElsewhere: 0,
    plantillaHereButAssignedElsewhere: 0,
  });
  assert.equal(
    result.offices.find((office) => office.officeId === "a")?.vacancyRate,
    50
  );
});

test("sorts offices by name while preserving input order for equal names", () => {
  const result = aggregateOfficeWorkforce({
    offices: [
      { id: "z", name: "Zulu" },
      { id: "same-first", name: "alpha" },
      { id: "same-second", name: "Alpha" },
    ],
    plantillaPositions: [],
    employees: [],
  });

  assert.deepEqual(
    result.offices.map((office) => office.officeId),
    ["same-first", "same-second", "z"]
  );
});
