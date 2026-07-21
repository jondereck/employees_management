import assert from "node:assert/strict";
import test from "node:test";

import {
  OFFICE_WORKFORCE_EXPORT_HEADERS,
  AUTHORIZED_POSITION_EXPORT_HEADERS,
  VACANT_POSITION_EXPORT_HEADERS,
  buildOfficeWorkforceExportRows,
  buildOfficeWorkforceTotalRow,
  buildAuthorizedPositionExportRows,
  buildVacantPositionExportRows,
  officeWorkforceExportFilename,
} from "../lib/office-workforce-export";

const row = {
  officeId: "office-1",
  officeName: "Office of the Mayor",
  activeAssignedEmployees: 25,
  archivedAssignedEmployees: 2,
  totalPlantillaSlots: 60,
  activePlantillaSlots: 59,
  filledPlantillaSlots: 58,
  vacantPlantillaSlots: 1,
  vacancyRate: 100 / 59,
  assignedHereButPlantillaElsewhere: 8,
  plantillaHereButAssignedElsewhere: 12,
};

test("workforce Excel builds the combined report rows", () => {
  assert.deepEqual(OFFICE_WORKFORCE_EXPORT_HEADERS, [
    "Office",
    "Active Plantilla",
    "Filled",
    "Vacant",
    "Assigned Here / Plantilla Elsewhere",
    "Plantilla Here / Assigned Elsewhere",
    "Vacancy Rate",
  ]);
  assert.deepEqual(buildOfficeWorkforceExportRows([row]), [
    ["Office of the Mayor", 59, 58, 1, 8, 12, (100 / 59) / 100],
  ]);
});

test("workforce Excel adds an aggregate total row at the bottom", () => {
  assert.deepEqual(buildOfficeWorkforceTotalRow([row]), [
    "TOTAL",
    59,
    58,
    1,
    8,
    12,
    1 / 59,
  ]);
});

test("workforce Excel lists the exact vacant plantilla items on another sheet", () => {
  assert.deepEqual(VACANT_POSITION_EXPORT_HEADERS, [
    "Office",
    "Item Number",
    "Position",
    "Salary Grade",
    "Division",
    "Employee Type",
  ]);
  assert.deepEqual(
    buildVacantPositionExportRows([
      {
        officeName: "Office of the Mayor",
        itemNumber: "MAYOR-01",
        title: "Administrative Aide IV",
        salaryGrade: 4,
        divisionName: "Administrative Division",
        employeeTypeName: "Career",
      },
      {
        officeName: "Rural Health Unit",
        itemNumber: null,
        title: "Medical Officer",
        salaryGrade: null,
        divisionName: null,
        employeeTypeName: null,
      },
    ]),
    [
      [
        "Office of the Mayor",
        "MAYOR-01",
        "Administrative Aide IV",
        4,
        "Administrative Division",
        "Career",
      ],
      ["Rural Health Unit", "", "Medical Officer", "", "", ""],
    ]
  );
});

test("workforce Excel formats the authorized position summary sheet", () => {
  assert.deepEqual(AUTHORIZED_POSITION_EXPORT_HEADERS, [
    "Office",
    "Authorized Position",
    "Employment Status",
    "Total Authorized",
    "Filled",
    "Vacant",
  ]);
  assert.deepEqual(
    buildAuthorizedPositionExportRows([
      {
        officeId: "mayor",
        officeName: "Municipal Mayor's Office",
        positionTitle: "Administrative Aide IV",
        employeeTypeName: "Permanent",
        totalAuthorized: 5,
        filled: 4,
        vacant: 1,
      },
    ]),
    [
      [
        "Municipal Mayor's Office",
        "Administrative Aide IV",
        "Permanent",
        5,
        4,
        1,
      ],
    ]
  );
});

test("workforce Excel filename uses the report date", () => {
  assert.equal(
    officeWorkforceExportFilename(new Date("2026-07-21T05:00:00.000Z")),
    "Office_Workforce_2026-07-21.xlsx"
  );
});

