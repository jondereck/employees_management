import assert from "node:assert/strict";
import test from "node:test";

import type { PivotResult } from "../lib/workforce-pivot";
import {
  buildWorkforcePivotExportRows,
  workforcePivotExportFilename,
} from "../lib/workforce-pivot-export";

const nestedResult: PivotResult = {
  rowFields: ["office", "employeeType"],
  colField: "gender",
  rows: [
    {
      key: "off-b::type-cas",
      name: "Casual",
      groupKey: "off-b",
      groupLabel: "Accounting",
      leafKey: "type-cas",
      leafLabel: "Casual",
    },
    {
      key: "off-b::type-perm",
      name: "Permanent",
      groupKey: "off-b",
      groupLabel: "Accounting",
      leafKey: "type-perm",
      leafLabel: "Permanent",
    },
    {
      key: "off-a::type-jo",
      name: "JO",
      groupKey: "off-a",
      groupLabel: "HRMO",
      leafKey: "type-jo",
      leafLabel: "JO",
    },
  ],
  cols: [
    { key: "male", name: "Male" },
    { key: "female", name: "Female" },
  ],
  matrix: [
    [0, 1],
    [2, 4],
    [1, 2],
  ],
  rowTotals: [1, 6, 3],
  colTotals: [3, 7],
  grandTotal: 10,
};

const singleResult: PivotResult = {
  rowFields: ["employeeType"],
  colField: "gender",
  rows: [
    { key: "type-perm", name: "Permanent" },
    { key: "type-cas", name: "Casual" },
  ],
  cols: [
    { key: "male", name: "Male" },
    { key: "female", name: "Female" },
  ],
  matrix: [
    [20, 28],
    [3, 5],
  ],
  rowTotals: [48, 8],
  colTotals: [23, 33],
  grandTotal: 56,
};

const FIELD_LABELS = {
  office: "Office",
  employeeType: "Employee Type",
  eligibility: "Eligibility Type",
  supervisory: "Supervisory Level",
  gender: "Gender",
} as const;

test("buildWorkforcePivotExportRows mirrors nested on-screen table", () => {
  const { title, rows } = buildWorkforcePivotExportRows({
    result: nestedResult,
    fieldLabels: FIELD_LABELS,
    generatedAt: new Date("2026-07-23T02:00:00.000Z"),
  });

  assert.equal(title, "Office + Employee Type × Gender");
  assert.deepEqual(rows[0], ["Office + Employee Type × Gender"]);
  assert.match(String(rows[1][0]), /Generated:/);
  assert.match(String(rows[1][0]), /10 employees matched/);
  assert.deepEqual(rows[2], ["Office", "Employee Type", "Male", "Female", "Total"]);
  assert.deepEqual(rows[3], ["Accounting", "Casual", 0, 1, 1]);
  assert.deepEqual(rows[4], ["", "Permanent", 2, 4, 6]);
  assert.deepEqual(rows[5], ["HRMO", "JO", 1, 2, 3]);
  assert.deepEqual(rows[6], ["Total", "", 3, 7, 10]);
});

test("buildWorkforcePivotExportRows mirrors single-row table", () => {
  const { title, rows } = buildWorkforcePivotExportRows({
    result: singleResult,
    fieldLabels: FIELD_LABELS,
    generatedAt: new Date("2026-07-23T02:00:00.000Z"),
  });

  assert.equal(title, "Employee Type × Gender");
  assert.deepEqual(rows[2], ["Employee Type", "Male", "Female", "Total"]);
  assert.deepEqual(rows[3], ["Permanent", 20, 28, 48]);
  assert.deepEqual(rows[4], ["Casual", 3, 5, 8]);
  assert.deepEqual(rows[5], ["Total", 23, 33, 56]);
});

test("workforcePivotExportFilename sanitizes nested axes and date", () => {
  const name = workforcePivotExportFilename({
    result: nestedResult,
    fieldLabels: FIELD_LABELS,
    generatedAt: new Date("2026-07-23T02:00:00.000Z"),
  });
  assert.equal(
    name,
    "Workforce_Pivot_Office+Employee_Type_x_Gender_2026-07-23.xlsx"
  );
});
