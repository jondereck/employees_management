import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPlantillaItemNumbers,
  matchEmployeeTypeId,
  normalizeCreateQuantity,
  normalizeDivisionInput,
  normalizeOptionalId,
  normalizePlantillaInput,
  normalizeStatusKey,
  parsePlantillaPaste,
  resolveDivisionLabel,
  resolvePlantillaLabel,
  resolvePositionLabel,
  validateDivisionBelongsToOffice,
  validatePlantillaAssignment,
  buildPlantillaSelectOptions,
  formatPlantillaSelectOptionLabel,
  composeEmployeeBio,
  splitEmployeeBio,
  sortPlantillaByAssignmentOffice,
} from "../lib/plantilla";

test("normalizeDivisionInput requires a non-empty name", () => {
  assert.equal(normalizeDivisionInput({ name: "  " }).error, "Division name is required");
  const ok = normalizeDivisionInput({ name: " BAC ", sortOrder: 2 });
  assert.equal(ok.error, undefined);
  assert.deepEqual(ok.value, { name: "BAC", sortOrder: 2 });
});

test("normalizePlantillaInput allows empty item number and validates salary bounds", () => {
  const emptyItem = normalizePlantillaInput({ itemNumber: "", title: "Aide" });
  assert.equal(emptyItem.error, undefined);
  assert.equal(emptyItem.value?.itemNumber, null);
  assert.equal(emptyItem.value?.title, "Aide");

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

test("buildPlantillaItemNumbers supports multi-create suffixes and empty bases", () => {
  assert.deepEqual(buildPlantillaItemNumbers("12", 1), ["12"]);
  assert.deepEqual(buildPlantillaItemNumbers("12", 3), ["12-1", "12-2", "12-3"]);
  assert.deepEqual(buildPlantillaItemNumbers(null, 3), [null, null, null]);
});

test("normalizeCreateQuantity caps multi-create to 1–10", () => {
  assert.equal(normalizeCreateQuantity(undefined).quantity, 1);
  assert.equal(normalizeCreateQuantity(3).quantity, 3);
  assert.match(normalizeCreateQuantity(11).error ?? "", /Quantity/);
  assert.match(normalizeCreateQuantity(0).error ?? "", /Quantity/);
});

test("parsePlantillaPaste detects Title/SG/Status rows and keeps plain titles plain", () => {
  assert.equal(parsePlantillaPaste("Administrative Aide III").mode, "plain");

  const sample = [
    "Municipal Mayor\t27\tElected",
    "Sr. Admin. Assistant III (Private Sec. II)\t15\tCo-Terminus",
    "Administrative Aide IV (Clerk II)\t4\tCo-Terminus",
  ].join("\n");
  const bulk = parsePlantillaPaste(sample);
  assert.equal(bulk.mode, "bulk");
  assert.equal(bulk.rows.length, 3);
  assert.deepEqual(bulk.rows[0], {
    itemNumber: null,
    title: "Municipal Mayor",
    salaryGrade: 27,
    statusLabel: "Elected",
  });
  assert.equal(bulk.rows[1].salaryGrade, 15);
  assert.equal(bulk.rows[2].statusLabel, "Co-Terminus");
  assert.equal(bulk.rows[2].itemNumber, null);

  const spaced = parsePlantillaPaste("Aide IV  4  Casual");
  assert.equal(spaced.mode, "bulk");
  assert.equal(spaced.rows[0]?.title, "Aide IV");
  assert.equal(spaced.rows[0]?.salaryGrade, 4);
  assert.equal(spaced.rows[0]?.itemNumber, null);
});

test("parsePlantillaPaste supports optional ItemNo column including hyphenated numbers", () => {
  const fourCol = parsePlantillaPaste(
    "12-1\tMunicipal Mayor\t27\tElected\n12-2\tAdministrative Aide IV (Clerk II)\t4\tCo-Terminus"
  );
  assert.equal(fourCol.mode, "bulk");
  assert.equal(fourCol.rows.length, 2);
  assert.equal(fourCol.rows[0]?.itemNumber, "12-1");
  assert.equal(fourCol.rows[0]?.title, "Municipal Mayor");
  assert.equal(fourCol.rows[0]?.salaryGrade, 27);
  assert.equal(fourCol.rows[0]?.statusLabel, "Elected");
  assert.equal(fourCol.rows[1]?.itemNumber, "12-2");
  assert.equal(fourCol.rows[1]?.salaryGrade, 4);

  const threeColWithItem = parsePlantillaPaste("12-1\tAdministrative Aide IV\t4");
  assert.equal(threeColWithItem.mode, "bulk");
  assert.equal(threeColWithItem.rows[0]?.itemNumber, "12-1");
  assert.equal(threeColWithItem.rows[0]?.title, "Administrative Aide IV");
  assert.equal(threeColWithItem.rows[0]?.salaryGrade, 4);
  assert.equal(threeColWithItem.rows[0]?.statusLabel, null);

  const plainItem = parsePlantillaPaste("12\tMayor\t27\tElected");
  assert.equal(plainItem.rows[0]?.itemNumber, "12");
});

test("matchEmployeeTypeId uses normalized name/value matching", () => {
  assert.equal(normalizeStatusKey("Co-Terminus"), "coterminus");
  const types = [
    { id: "1", name: "Elected", value: "elected" },
    { id: "2", name: "Co Terminus", value: "co_terminus" },
  ];
  assert.equal(matchEmployeeTypeId("Elected", types), "1");
  assert.equal(matchEmployeeTypeId("Co-Terminus", types), "2");
  assert.equal(matchEmployeeTypeId("Unknown Status", types), null);
});

test("normalizeOptionalId treats blank and none as null", () => {
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

test("sortPlantillaByAssignmentOffice prioritizes assignment office without reordering within groups", () => {
  const items = [
    { id: "a", officeId: "other", title: "B" },
    { id: "b", officeId: "hrmo", title: "A" },
    { id: "c", officeId: "other", title: "A" },
    { id: "d", officeId: "hrmo", title: "B" },
  ];

  assert.deepEqual(
    sortPlantillaByAssignmentOffice(items, "hrmo").map((i) => i.id),
    ["b", "d", "a", "c"]
  );
  assert.deepEqual(sortPlantillaByAssignmentOffice(items, null), items);
  assert.deepEqual(sortPlantillaByAssignmentOffice(items, ""), items);
});

test("plantilla select labels disambiguate duplicate vacant slots", () => {
  const items = [
    {
      id: "aaa-111",
      officeName: "HRMO",
      officeDivisionName: null,
      itemNumber: null,
      title: "Administrative Aide IV",
      salaryGrade: 4,
    },
    {
      id: "bbb-222",
      officeName: "HRMO",
      officeDivisionName: null,
      itemNumber: null,
      title: "Administrative Aide IV",
      salaryGrade: 4,
    },
    {
      id: "ccc-333",
      officeName: "HRMO",
      officeDivisionName: null,
      itemNumber: null,
      title: "Administrative Aide IV",
      salaryGrade: 4,
    },
  ];

  const options = buildPlantillaSelectOptions(items);
  assert.equal(options.length, 3);
  assert.equal(
    options.find((o) => o.value === "aaa-111")?.label,
    "HRMO — Administrative Aide IV · SG 4 (vacant slot 1)"
  );
  assert.equal(
    options.find((o) => o.value === "bbb-222")?.label,
    "HRMO — Administrative Aide IV · SG 4 (vacant slot 2)"
  );
  assert.equal(
    options.find((o) => o.value === "ccc-333")?.label,
    "HRMO — Administrative Aide IV · SG 4 (vacant slot 3)"
  );

  assert.equal(
    formatPlantillaSelectOptionLabel({
      id: "x",
      officeName: "HRMO",
      itemNumber: "12-1",
      title: "Admin Aide III",
    }),
    "HRMO — 12-1 — Admin Aide III"
  );
});

test("composeEmployeeBio keeps prefix and updates item-number suffix", () => {
  assert.deepEqual(splitEmployeeBio("8540005, Z-39"), {
    prefix: "8540005",
    suffix: "Z-39",
  });
  assert.deepEqual(splitEmployeeBio("8540005"), {
    prefix: "8540005",
    suffix: "",
  });

  assert.equal(
    composeEmployeeBio({
      currentEmployeeNo: "8540005, E-1",
      itemNumber: "Z-39",
    }),
    "8540005, Z-39"
  );

  assert.equal(
    composeEmployeeBio({
      currentEmployeeNo: "8540005",
      itemNumber: "Z-39",
    }),
    "8540005, Z-39"
  );

  assert.equal(
    composeEmployeeBio({
      currentEmployeeNo: "",
      officeBioIndexCode: "8540005",
      itemNumber: "Z-39",
    }),
    "8540005, Z-39"
  );

  assert.equal(
    composeEmployeeBio({
      currentEmployeeNo: "",
      officeBioIndexCode: "8540005,8540006",
      itemNumber: "12-1",
    }),
    "8540005, 12-1"
  );

  assert.equal(
    composeEmployeeBio({
      currentEmployeeNo: "8540005, Z-39",
      itemNumber: null,
    }),
    "8540005"
  );

  assert.equal(
    composeEmployeeBio({
      currentEmployeeNo: "8540005, Z-39",
      itemNumber: "  ",
    }),
    "8540005"
  );

  assert.equal(
    composeEmployeeBio({
      currentEmployeeNo: "",
      officeBioIndexCode: null,
      itemNumber: "Z-39",
    }),
    null
  );
});
