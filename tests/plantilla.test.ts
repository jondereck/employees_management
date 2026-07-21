import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEmployeePlantillaLinkUpdate,
  buildPlantillaCandidateDepartmentScope,
  buildPlantillaItemNumbers,
  buildPlantillaSelectOptions,
  canonicalizeStatusKey,
  comparePlantillaItemNumbers,
  composeEmployeeBio,
  findBioSuffixMatchForItemNumber,
  findEmployeeNameMatch,
  formatPlantillaSelectOptionLabel,
  hasPlantillaUpdates,
  matchEmployeeTypeId,
  normalizeCreateQuantity,
  normalizeDivisionInput,
  normalizeOptionalId,
  normalizePersonNameKey,
  normalizePlantillaInput,
  normalizeStatusKey,
  parseOccupantName,
  parsePlantillaPaste,
  previewBioSuffixLinks,
  previewPlantillaAutoLinks,
  resolveDivisionLabel,
  resolvePlantillaLabel,
  resolvePlantillaDesignationLabel,
  resolvePositionLabel,
  sortPlantillaByAssignmentOffice,
  sortPlantillaPositions,
  splitEmployeeBio,
  validateDivisionBelongsToOffice,
  validatePlantillaAssignment,
} from "../lib/plantilla";
import {
  buildArchivePlantillaUnlinkUpdate,
  buildBulkArchiveEmployeeUpdate,
} from "../lib/plantilla-assignment";

test("sortPlantillaPositions defaults to natural Item No. order", () => {
  assert.ok(comparePlantillaItemNumbers("A-1", "A-10") < 0);
  assert.ok(comparePlantillaItemNumbers("A-2", "A-10") < 0);
  assert.ok(comparePlantillaItemNumbers(null, "A-1") > 0);

  const sorted = sortPlantillaPositions(
    [
      { itemNumber: "A-10", title: "Later" },
      { itemNumber: null, title: "No number" },
      { itemNumber: "A-2", title: "Second" },
      { itemNumber: "A-1", title: "First" },
    ],
    "itemNumber",
    "asc"
  );
  assert.deepEqual(
    sorted.map((r) => r.itemNumber ?? "EMPTY"),
    ["A-1", "A-2", "A-10", "EMPTY"]
  );
});

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

test("plantilla updates reject an empty normalized PATCH payload", () => {
  const empty = normalizePlantillaInput({}, { partial: true });
  assert.deepEqual(empty.value, {});
  assert.equal(hasPlantillaUpdates(empty.value), false);

  const update = normalizePlantillaInput({ isActive: false }, { partial: true });
  assert.equal(hasPlantillaUpdates(update.value), true);
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
    occupantName: null,
  });
  assert.equal(bulk.rows[1].salaryGrade, 15);
  assert.equal(bulk.rows[2].statusLabel, "Co-Terminus");
  assert.equal(bulk.rows[2].itemNumber, null);
  assert.equal(bulk.rows[2].occupantName, null);

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
  assert.equal(canonicalizeStatusKey("Coterminous"), "coterminus");
  const types = [
    { id: "1", name: "Elected", value: "elected" },
    { id: "2", name: "Coterminus", value: "coterminus" },
  ];
  assert.equal(matchEmployeeTypeId("Elected", types), "1");
  assert.equal(matchEmployeeTypeId("Co-Terminus", types), "2");
  assert.equal(matchEmployeeTypeId("Co Terminus", types), "2");
  assert.equal(matchEmployeeTypeId("Coterminous", types), "2");
  assert.equal(matchEmployeeTypeId("Elected Josefina V. Castañeda", types), "1");
  assert.equal(matchEmployeeTypeId("Unknown Status", types), null);
});

test("normalizeOptionalId treats blank and none as null", () => {
  assert.equal(normalizeOptionalId(""), null);
  assert.equal(normalizeOptionalId("none"), null);
  assert.equal(normalizeOptionalId(" abc "), "abc");
});

test("plantilla candidate scope excludes archived employees in the department", () => {
  assert.deepEqual(buildPlantillaCandidateDepartmentScope("department-1"), {
    departmentId: "department-1",
    isArchived: false,
  });
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

  assert.equal(
    resolvePlantillaDesignationLabel({
      plantillaOfficeName: "Office of the Mayor",
      designationName: "Old Designation",
    }),
    "Office of the Mayor"
  );
  assert.equal(
    resolvePlantillaDesignationLabel({
      designationName: "Old Designation",
    }),
    "Old Designation"
  );
  assert.equal(resolvePlantillaDesignationLabel({}), "");

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

test("findBioSuffixMatchForItemNumber matches Emp No suffix uniquely", () => {
  const employees = [
    { id: "e1", employeeNo: "1200040, A-1" },
    { id: "e2", employeeNo: "1200041, B-2" },
    { id: "e3", employeeNo: "1200042" },
  ];

  assert.deepEqual(findBioSuffixMatchForItemNumber(employees, "A-1"), {
    kind: "unique",
    matchId: "e1",
  });
  assert.deepEqual(findBioSuffixMatchForItemNumber(employees, "a-1"), {
    kind: "unique",
    matchId: "e1",
  });
  assert.deepEqual(findBioSuffixMatchForItemNumber(employees, "Z-9"), {
    kind: "none",
  });
  assert.deepEqual(findBioSuffixMatchForItemNumber(employees, ""), {
    kind: "none",
  });
  assert.deepEqual(findBioSuffixMatchForItemNumber(employees, null), {
    kind: "none",
  });

  assert.deepEqual(
    findBioSuffixMatchForItemNumber(
      [
        { id: "a", employeeNo: "1, A-1" },
        { id: "b", employeeNo: "2, A-1" },
      ],
      "A-1"
    ),
    { kind: "ambiguous" }
  );
});

test("previewBioSuffixLinks shows will-link and claims one employee", () => {
  const employees = [
    {
      id: "e1",
      employeeNo: "1200040, A-1",
      firstName: "JOSEFINA",
      lastName: "CASTAÑEDA",
    },
  ];
  const rows = previewBioSuffixLinks(["A-1", "B-2"], employees);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].kind, "unique");
  assert.equal(rows[0].employee?.id, "e1");
  assert.equal(rows[1].kind, "none");
});

test("parseOccupantName extracts first + last from First M. Last or Last, First", () => {
  assert.deepEqual(parseOccupantName("Randy A. Wapson"), {
    firstName: "Randy",
    lastName: "Wapson",
  });
  assert.deepEqual(parseOccupantName("Wapson, Randy A."), {
    firstName: "Randy",
    lastName: "Wapson",
  });
  assert.equal(parseOccupantName("Randy"), null);
  assert.equal(normalizePersonNameKey("CASTAÑEDA"), normalizePersonNameKey("Castaneda"));
});

test("parsePlantillaPaste supports optional occupant name column", () => {
  const named = parsePlantillaPaste(
    "Administrative Aide IV\t4\tCasual\tRandy A. Wapson"
  );
  assert.equal(named.mode, "bulk");
  assert.equal(named.rows[0]?.title, "Administrative Aide IV");
  assert.equal(named.rows[0]?.salaryGrade, 4);
  assert.equal(named.rows[0]?.statusLabel, "Casual");
  assert.equal(named.rows[0]?.occupantName, "Randy A. Wapson");

  const withItem = parsePlantillaPaste(
    "12-1\tAdministrative Aide IV\t4\tCasual\tRandy A. Wapson"
  );
  assert.equal(withItem.rows[0]?.itemNumber, "12-1");
  assert.equal(withItem.rows[0]?.occupantName, "Randy A. Wapson");
  assert.equal(withItem.rows[0]?.statusLabel, "Casual");
});

test("findEmployeeNameMatch and previewPlantillaAutoLinks link by name", () => {
  const employees = [
    {
      id: "e1",
      employeeNo: "1200040",
      firstName: "Randy",
      lastName: "Wapson",
    },
    {
      id: "e2",
      employeeNo: "1200041, A-1",
      firstName: "Ana",
      lastName: "Cruz",
    },
  ];

  assert.deepEqual(findEmployeeNameMatch(employees, "Randy", "Wapson"), {
    kind: "unique",
    matchId: "e1",
  });
  assert.deepEqual(findEmployeeNameMatch(employees, "Unknown", "Person"), {
    kind: "none",
  });

  const preview = previewPlantillaAutoLinks(
    [
      { itemNumber: null, occupantName: "Randy A. Wapson" },
      { itemNumber: "A-1", occupantName: null },
      { itemNumber: null, occupantName: "Nobody Here" },
    ],
    employees
  );
  assert.equal(preview[0].kind, "unique");
  assert.equal(preview[0].linkBy, "name");
  assert.equal(preview[0].employee?.id, "e1");
  assert.equal(preview[1].kind, "unique");
  assert.equal(preview[1].linkBy, "bio");
  assert.equal(preview[1].employee?.id, "e2");
  assert.equal(preview[2].kind, "none");
});

test("buildEmployeePlantillaLinkUpdate syncs plantilla fields without changing office", () => {
  const plantilla = {
    id: "p1",
    officeId: "office-a",
    itemNumber: "A-1",
    title: "Administrative Aide IV",
    salaryGrade: 4,
    employeeTypeId: "type-1",
    officeDivisionId: "div-1",
  };

  const sameOffice = buildEmployeePlantillaLinkUpdate(plantilla, {
    id: "e1",
    officeId: "office-a",
    employeeNo: "1200040, X-9",
  });
  assert.equal(sameOffice.plantillaPositionId, "p1");
  assert.equal(sameOffice.position, "Administrative Aide IV");
  assert.equal(sameOffice.designationId, "office-a");
  assert.equal(sameOffice.salaryGrade, 4);
  assert.equal(sameOffice.employeeTypeId, "type-1");
  assert.equal(sameOffice.officeDivisionId, "div-1");
  assert.equal(sameOffice.employeeNo, "1200040, A-1");

  const crossOffice = buildEmployeePlantillaLinkUpdate(plantilla, {
    id: "e2",
    officeId: "office-b",
    employeeNo: "1200040, A-1",
  });
  assert.equal(crossOffice.designationId, "office-a");
  assert.equal(crossOffice.officeDivisionId, undefined);
  assert.equal(crossOffice.employeeNo, "1200040, A-1");
});

test("archive unlink update clears only plantillaPositionId when archiving", () => {
  assert.deepEqual(buildArchivePlantillaUnlinkUpdate(true), {
    plantillaPositionId: null,
  });
});

test("archive unlink update does nothing when employee remains active", () => {
  assert.deepEqual(buildArchivePlantillaUnlinkUpdate(false), {});
});

test("bulk archive update unlinks plantilla while preserving unrelated fields", () => {
  assert.deepEqual(
    buildBulkArchiveEmployeeUpdate({
      archived: true,
      terminateDate: "07/21/2026",
      note: "Retired",
    }),
    {
      isArchived: true,
      terminateDate: "07/21/2026",
      note: "Retired",
      plantillaPositionId: null,
    }
  );
});

test("bulk restore update does not relink plantilla", () => {
  assert.deepEqual(
    buildBulkArchiveEmployeeUpdate({
      archived: false,
      terminateDate: "",
    }),
    {
      isArchived: false,
      terminateDate: "",
    }
  );
});
