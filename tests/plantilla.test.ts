import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeDivisionInput,
  normalizeOptionalId,
  normalizePlantillaInput,
  resolveDivisionLabel,
  resolvePlantillaLabel,
  resolvePositionLabel,
  validateDivisionBelongsToOffice,
  validatePlantillaAssignment,
} from "../lib/plantilla";

test("normalizeDivisionInput requires a non-empty name", () => {
  assert.equal(normalizeDivisionInput({ name: "  " }).error, "Division name is required");
  const ok = normalizeDivisionInput({ name: " BAC ", sortOrder: 2 });
  assert.equal(ok.error, undefined);
  assert.deepEqual(ok.value, { name: "BAC", sortOrder: 2 });
});

test("normalizePlantillaInput validates item number, title, and salary bounds", () => {
  assert.match(
    normalizePlantillaInput({ itemNumber: "", title: "Aide" }).error ?? "",
    /Item number/
  );
  assert.match(
    normalizePlantillaInput({ itemNumber: "1", title: "Aide", salaryGrade: 99 }).error ?? "",
    /Salary grade/
  );

  const ok = normalizePlantillaInput({
    itemNumber: " 12-1 ",
    title: " Administrative Aide III ",
    salaryGrade: 3,
    salaryStep: 1,
    officeDivisionId: "none",
  });
  assert.equal(ok.error, undefined);
  assert.equal(ok.value?.itemNumber, "12-1");
  assert.equal(ok.value?.title, "Administrative Aide III");
  assert.equal(ok.value?.officeDivisionId, null);
  assert.equal(ok.value?.isActive, true);
});

test("normalizeOptionalId treats empty and none as null", () => {
  assert.equal(normalizeOptionalId(""), null);
  assert.equal(normalizeOptionalId("none"), null);
  assert.equal(normalizeOptionalId(" abc "), "abc");
});

test("validateDivisionBelongsToOffice rejects cross-office divisions", () => {
  assert.equal(
    validateDivisionBelongsToOffice({
      division: { id: "d1", officeId: "o2" },
      officeId: "o1",
    }),
    "Division does not belong to the selected office"
  );
  assert.equal(
    validateDivisionBelongsToOffice({
      division: { id: "d1", officeId: "o1" },
      officeId: "o1",
    }),
    null
  );
});

test("validatePlantillaAssignment allows cross-office plantilla and blocks occupancy", () => {
  const base = {
    id: "p1",
    officeId: "plantilla-office",
    officeDivisionId: "div1",
    title: "Admin Aide III",
    isActive: true,
    employee: null as { id: string } | null,
  };

  // Assignment office may differ from plantilla office.
  assert.equal(
    validatePlantillaAssignment({
      plantilla: base,
      employeeOfficeId: "assignment-office",
      employeeDivisionId: null,
    }),
    null
  );

  assert.match(
    validatePlantillaAssignment({
      plantilla: { ...base, isActive: false },
      employeeOfficeId: "assignment-office",
      employeeDivisionId: null,
    }) ?? "",
    /inactive/
  );

  assert.match(
    validatePlantillaAssignment({
      plantilla: { ...base, employee: { id: "emp-other" } },
      employeeOfficeId: "assignment-office",
      employeeDivisionId: null,
      employeeId: "emp-self",
    }) ?? "",
    /already occupied/
  );

  assert.equal(
    validatePlantillaAssignment({
      plantilla: { ...base, employee: { id: "emp-self" } },
      employeeOfficeId: "assignment-office",
      employeeDivisionId: null,
      employeeId: "emp-self",
    }),
    null
  );
});

test("dual-read label helpers prefer structured plantilla then legacy fallbacks", () => {
  assert.equal(
    resolvePlantillaLabel({
      plantillaTitle: "Admin Aide III",
      plantillaItemNumber: "12-1",
      designationName: "Old Designation Office",
      officeName: "Mayor's Office",
    }),
    "12-1 — Admin Aide III"
  );

  assert.equal(
    resolvePlantillaLabel({
      designationName: "Old Designation Office",
      officeName: "Mayor's Office",
    }),
    "Old Designation Office"
  );

  assert.equal(
    resolvePlantillaLabel({
      officeName: "Mayor's Office",
    }),
    "Mayor's Office"
  );

  assert.equal(
    resolvePositionLabel({
      plantillaTitle: "Admin Aide III",
      legacyPosition: "Free text role",
    }),
    "Admin Aide III"
  );

  assert.equal(
    resolvePositionLabel({
      legacyPosition: "Free text role",
    }),
    "Free text role"
  );

  assert.equal(resolveDivisionLabel({ divisionName: " BAC " }), "BAC");
  assert.equal(resolveDivisionLabel({}), "");
});
