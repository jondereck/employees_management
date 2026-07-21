import assert from "node:assert/strict";
import test from "node:test";

import { validateEmployeeDepartmentReferences } from "../lib/employee-department-references";

const validReferences = {
  office: { id: "office-1" },
  employeeType: { id: "type-1" },
  eligibility: { id: "eligibility-1" },
};

test("accepts employee references found in the owned department", () => {
  assert.equal(validateEmployeeDepartmentReferences(validReferences), null);
});

test("rejects an office outside the owned department", () => {
  assert.equal(
    validateEmployeeDepartmentReferences({
      ...validReferences,
      office: null,
    }),
    "Office not found in this department"
  );
});

test("rejects an employee type outside the owned department", () => {
  assert.equal(
    validateEmployeeDepartmentReferences({
      ...validReferences,
      employeeType: null,
    }),
    "Appointment not found in this department"
  );
});

test("rejects an eligibility outside the owned department", () => {
  assert.equal(
    validateEmployeeDepartmentReferences({
      ...validReferences,
      eligibility: null,
    }),
    "Eligibility not found in this department"
  );
});
