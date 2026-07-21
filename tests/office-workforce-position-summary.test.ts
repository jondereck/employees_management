import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateAuthorizedPositionSummary,
  summarizeAuthorizedPositions,
} from "../lib/office-workforce-position-summary";

test("authorized position summary groups active slots by office, title, and status", () => {
  const rows = aggregateAuthorizedPositionSummary({
    offices: [
      { id: "mayor", name: "Municipal Mayor's Office" },
      { id: "sb", name: "SB Legislative" },
    ],
    positions: [
      {
        id: "a-1",
        officeId: "mayor",
        title: "Administrative Aide IV",
        employeeTypeName: "Permanent",
        isActive: true,
      },
      {
        id: "a-2",
        officeId: "mayor",
        title: "Administrative Aide IV",
        employeeTypeName: "Permanent",
        isActive: true,
      },
      {
        id: "a-3",
        officeId: "mayor",
        title: "Administrative Aide IV",
        employeeTypeName: "Casual",
        isActive: true,
      },
      {
        id: "inactive",
        officeId: "mayor",
        title: "Administrative Aide IV",
        employeeTypeName: "Permanent",
        isActive: false,
      },
      {
        id: "sb-1",
        officeId: "sb",
        title: "Municipal Vice Mayor",
        employeeTypeName: "Elected",
        isActive: true,
      },
    ],
    employees: [
      {
        plantillaPositionId: "a-1",
        isArchived: false,
      },
      {
        plantillaPositionId: "a-2",
        isArchived: true,
      },
      {
        plantillaPositionId: "sb-1",
        isArchived: false,
      },
    ],
  });

  assert.deepEqual(rows, [
    {
      officeId: "mayor",
      officeName: "Municipal Mayor's Office",
      positionTitle: "Administrative Aide IV",
      employeeTypeName: "Casual",
      totalAuthorized: 1,
      filled: 0,
      vacant: 1,
    },
    {
      officeId: "mayor",
      officeName: "Municipal Mayor's Office",
      positionTitle: "Administrative Aide IV",
      employeeTypeName: "Permanent",
      totalAuthorized: 2,
      filled: 1,
      vacant: 1,
    },
    {
      officeId: "sb",
      officeName: "SB Legislative",
      positionTitle: "Municipal Vice Mayor",
      employeeTypeName: "Elected",
      totalAuthorized: 1,
      filled: 1,
      vacant: 0,
    },
  ]);
});

test("authorized position totals sum all grouped rows", () => {
  assert.deepEqual(
    summarizeAuthorizedPositions([
      {
        officeId: "mayor",
        officeName: "Mayor",
        positionTitle: "Position A",
        employeeTypeName: "Permanent",
        totalAuthorized: 3,
        filled: 2,
        vacant: 1,
      },
      {
        officeId: "mayor",
        officeName: "Mayor",
        positionTitle: "Position B",
        employeeTypeName: "Casual",
        totalAuthorized: 4,
        filled: 1,
        vacant: 3,
      },
    ]),
    { totalAuthorized: 7, filled: 3, vacant: 4 }
  );
});

test("authorized position totals are zero for an empty summary", () => {
  assert.deepEqual(summarizeAuthorizedPositions([]), {
    totalAuthorized: 0,
    filled: 0,
    vacant: 0,
  });
});
