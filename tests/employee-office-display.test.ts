import assert from "node:assert/strict";
import test from "node:test";

import { getEmployeeOfficeDisplay } from "../lib/employee-office-display";
import { employeeOfficeDisplayInclude } from "../lib/employee-office-query";

test("employee list queries include the division used by Office Designation", () => {
  assert.deepEqual(employeeOfficeDisplayInclude, {
    officeDivision: {
      select: { id: true, name: true },
    },
  });
});

test("employee office display includes a trimmed division when available", () => {
  assert.deepEqual(
    getEmployeeOfficeDisplay({
      officeName: " Office of the Mayor ",
      divisionName: " Administrative Division ",
    }),
    {
      officeName: "Office of the Mayor",
      divisionName: "Administrative Division",
    }
  );
});

test("employee office display omits blank divisions", () => {
  assert.deepEqual(
    getEmployeeOfficeDisplay({
      officeName: "Office of the Mayor",
      divisionName: " ",
    }),
    {
      officeName: "Office of the Mayor",
      divisionName: null,
    }
  );
});
