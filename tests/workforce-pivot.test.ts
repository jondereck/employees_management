import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWorkforcePivot,
  resolvePivotAxes,
  type PivotEmployeeInput,
} from "../lib/workforce-pivot";

function emp(partial: Partial<PivotEmployeeInput> & Pick<PivotEmployeeInput, "id">): PivotEmployeeInput {
  return {
    gender: "Male",
    salaryGrade: 5,
    officeId: "off-a",
    officeName: "HRMO",
    employeeTypeId: "type-perm",
    employeeTypeName: "Permanent",
    eligibilityId: "elig-1",
    eligibilityName: "CS Professional",
    ...partial,
  };
}

test("resolvePivotAxes accepts rowFields and colField", () => {
  const result = resolvePivotAxes({
    rowFields: ["office", "employeeType"],
    colField: "gender",
  });
  assert.deepEqual(result, {
    rowFields: ["office", "employeeType"],
    colField: "gender",
  });
});

test("resolvePivotAxes accepts legacy rowField", () => {
  const result = resolvePivotAxes({
    rowField: "employeeType",
    colField: "gender",
  });
  assert.deepEqual(result, {
    rowFields: ["employeeType"],
    colField: "gender",
  });
});

test("resolvePivotAxes rejects overlapping colField", () => {
  const result = resolvePivotAxes({
    rowFields: ["office", "employeeType"],
    colField: "office",
  });
  assert.ok("error" in result);
  assert.match(result.error, /must not appear|must differ|overlap/i);
});

test("resolvePivotAxes rejects more than two rowFields", () => {
  const result = resolvePivotAxes({
    rowFields: ["office", "employeeType", "eligibility"],
    colField: "gender",
  });
  assert.ok("error" in result);
});

test("buildWorkforcePivot nests office + employeeType × gender", () => {
  const employees: PivotEmployeeInput[] = [
    emp({ id: "1", officeId: "off-a", officeName: "HRMO", employeeTypeId: "type-perm", employeeTypeName: "Permanent", gender: "Male" }),
    emp({ id: "2", officeId: "off-a", officeName: "HRMO", employeeTypeId: "type-perm", employeeTypeName: "Permanent", gender: "Female" }),
    emp({ id: "3", officeId: "off-a", officeName: "HRMO", employeeTypeId: "type-perm", employeeTypeName: "Permanent", gender: "Female" }),
    emp({ id: "4", officeId: "off-a", officeName: "HRMO", employeeTypeId: "type-jo", employeeTypeName: "JO", gender: "Male" }),
    emp({ id: "5", officeId: "off-a", officeName: "HRMO", employeeTypeId: "type-jo", employeeTypeName: "JO", gender: "Female" }),
    emp({ id: "6", officeId: "off-a", officeName: "HRMO", employeeTypeId: "type-jo", employeeTypeName: "JO", gender: "Female" }),
    emp({ id: "7", officeId: "off-b", officeName: "Accounting", employeeTypeId: "type-perm", employeeTypeName: "Permanent", gender: "Male" }),
    emp({ id: "8", officeId: "off-b", officeName: "Accounting", employeeTypeId: "type-perm", employeeTypeName: "Permanent", gender: "Male" }),
    emp({ id: "9", officeId: "off-b", officeName: "Accounting", employeeTypeId: "type-perm", employeeTypeName: "Permanent", gender: "Female" }),
    emp({ id: "10", officeId: "off-b", officeName: "Accounting", employeeTypeId: "type-perm", employeeTypeName: "Permanent", gender: "Female" }),
    emp({ id: "11", officeId: "off-b", officeName: "Accounting", employeeTypeId: "type-perm", employeeTypeName: "Permanent", gender: "Female" }),
    emp({ id: "12", officeId: "off-b", officeName: "Accounting", employeeTypeId: "type-perm", employeeTypeName: "Permanent", gender: "Female" }),
    emp({ id: "13", officeId: "off-b", officeName: "Accounting", employeeTypeId: "type-cas", employeeTypeName: "Casual", gender: "Female" }),
  ];

  const result = buildWorkforcePivot({
    employees,
    rowFields: ["office", "employeeType"],
    colField: "gender",
  });

  assert.deepEqual(result.rowFields, ["office", "employeeType"]);
  assert.equal(result.colField, "gender");
  assert.equal(result.cols.map((c) => c.name).join(","), "Male,Female");
  assert.equal(result.grandTotal, 13);

  // Accounting before HRMO (alpha); within Accounting: Casual then Permanent
  assert.equal(result.rows.length, 4);
  assert.equal(result.rows[0].groupLabel, "Accounting");
  assert.equal(result.rows[0].leafLabel, "Casual");
  assert.deepEqual(result.matrix[0], [0, 1]);
  assert.equal(result.rows[1].groupLabel, "Accounting");
  assert.equal(result.rows[1].leafLabel, "Permanent");
  assert.deepEqual(result.matrix[1], [2, 4]);
  assert.equal(result.rows[2].groupLabel, "HRMO");
  assert.equal(result.rows[2].leafLabel, "JO");
  assert.deepEqual(result.matrix[2], [1, 2]);
  assert.equal(result.rows[3].groupLabel, "HRMO");
  assert.equal(result.rows[3].leafLabel, "Permanent");
  assert.deepEqual(result.matrix[3], [1, 2]);
});

test("buildWorkforcePivot single office × gender has no group fields", () => {
  const employees: PivotEmployeeInput[] = [
    emp({ id: "1", officeId: "off-a", officeName: "HRMO", gender: "Male" }),
    emp({ id: "2", officeId: "off-a", officeName: "HRMO", gender: "Female" }),
    emp({ id: "3", officeId: "off-b", officeName: "Accounting", gender: "Female" }),
  ];

  const result = buildWorkforcePivot({
    employees,
    rowFields: ["office"],
    colField: "gender",
  });

  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].name, "Accounting");
  assert.equal(result.rows[0].groupKey, undefined);
  assert.equal(result.rows[0].groupLabel, undefined);
  assert.deepEqual(result.matrix[0], [0, 1]);
  assert.equal(result.rows[1].name, "HRMO");
  assert.deepEqual(result.matrix[1], [1, 1]);
  assert.equal(result.grandTotal, 3);
});
