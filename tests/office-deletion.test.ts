import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOfficeDeletionEmployeePatch,
  classifyOfficeDeletionEmployees,
  formatOfficeDeleteBlockedMessage,
  hasOfficeDeleteBlockers,
  hasStaleOfficeDeletionPreview,
  validateOfficeReassignments,
} from "../lib/office-deletion";

test("office deletion reports every employee relationship that blocks deletion", () => {
  const blockers = {
    assignedEmployees: 2,
    designatedEmployees: 1,
    plantillaOccupants: 3,
  };

  assert.equal(hasOfficeDeleteBlockers(blockers), true);
  assert.equal(
    formatOfficeDeleteBlockedMessage(blockers),
    "Cannot delete this office. Reassign 2 assigned employees, 1 designated employee, and 3 plantilla occupants first."
  );
});

test("office deletion has no blocker message when all employee counts are zero", () => {
  const blockers = {
    assignedEmployees: 0,
    designatedEmployees: 0,
    plantillaOccupants: 0,
  };

  assert.equal(hasOfficeDeleteBlockers(blockers), false);
  assert.equal(formatOfficeDeleteBlockedMessage(blockers), null);
});

test("office deletion deduplicates employees and classifies every affected relation", () => {
  const affected = classifyOfficeDeletionEmployees(
    [
      {
        id: "employee-1",
        officeId: "office-delete",
        designationId: "office-delete",
        officeDivision: { officeId: "office-delete" },
        plantillaPosition: { officeId: "office-keep" },
      },
      {
        id: "employee-1",
        officeId: "office-delete",
        designationId: "office-delete",
        officeDivision: null,
        plantillaPosition: { officeId: "office-delete" },
      },
      {
        id: "employee-2",
        officeId: "office-keep",
        designationId: null,
        officeDivision: { officeId: "office-delete" },
        plantillaPosition: null,
      },
      {
        id: "employee-unaffected",
        officeId: "office-keep",
        designationId: null,
        officeDivision: null,
        plantillaPosition: null,
      },
    ],
    "office-delete"
  );

  assert.deepEqual(affected, [
    {
      employeeId: "employee-1",
      reasons: ["assigned", "designated", "plantilla", "division"],
    },
    { employeeId: "employee-2", reasons: ["division"] },
  ]);
});

test("office deletion requires exact reassignment coverage", () => {
  const invalidCoverage = [
    [{ employeeId: "employee-1", officeId: "office-a" }],
    [
      { employeeId: "employee-1", officeId: "office-a" },
      { employeeId: "employee-2", officeId: "office-b" },
      { employeeId: "employee-3", officeId: "office-a" },
    ],
    [
      { employeeId: "employee-1", officeId: "office-a" },
      { employeeId: "employee-1", officeId: "office-b" },
    ],
  ];

  for (const reassignments of invalidCoverage) {
    assert.deepEqual(
      validateOfficeReassignments({
        affectedEmployeeIds: ["employee-1", "employee-2"],
        reassignments,
        validDestinationOfficeIds: ["office-a", "office-b"],
        deletingOfficeId: "office-delete",
      }),
      {
        ok: false,
        code: "STALE_OFFICE_DELETION_PREVIEW",
        error:
          "Employee assignments changed since this preview. Review the refreshed list and try again.",
      }
    );
  }
});

test("office deletion accepts one valid destination per affected employee", () => {
  assert.deepEqual(
    validateOfficeReassignments({
      affectedEmployeeIds: ["employee-1", "employee-2"],
      reassignments: [
        { employeeId: "employee-1", officeId: "office-a" },
        { employeeId: "employee-2", officeId: "office-b" },
      ],
      validDestinationOfficeIds: ["office-a", "office-b"],
      deletingOfficeId: "office-delete",
    }),
    { ok: true }
  );
});

test("office deletion validates destination offices", () => {
  assert.deepEqual(
    validateOfficeReassignments({
      affectedEmployeeIds: ["employee-1"],
      reassignments: [
        { employeeId: "employee-1", officeId: "office-delete" },
      ],
      validDestinationOfficeIds: ["office-a"],
      deletingOfficeId: "office-delete",
    }),
    {
      ok: false,
      code: "INVALID_DESTINATION_OFFICE",
      error:
        "Every destination must be another office in the same department.",
    }
  );
});

test("office deletion accepts an explicit office-level destination", () => {
  assert.deepEqual(
    validateOfficeReassignments({
      affectedEmployeeIds: ["employee-1"],
      assignedEmployeeIds: ["employee-1"],
      reassignments: [
        {
          employeeId: "employee-1",
          officeId: "office-a",
          officeDivisionId: null,
        },
      ],
      validDestinationOfficeIds: ["office-a"],
      validDestinationDivisions: [],
      deletingOfficeId: "office-delete",
    }),
    { ok: true }
  );
});

test("office deletion accepts a division belonging to the selected destination", () => {
  assert.deepEqual(
    validateOfficeReassignments({
      affectedEmployeeIds: ["employee-1"],
      assignedEmployeeIds: ["employee-1"],
      reassignments: [
        {
          employeeId: "employee-1",
          officeId: "office-a",
          officeDivisionId: "division-a",
        },
      ],
      validDestinationOfficeIds: ["office-a"],
      validDestinationDivisions: [
        { id: "division-a", officeId: "office-a" },
      ],
      deletingOfficeId: "office-delete",
    }),
    { ok: true }
  );
});

test("office deletion rejects mismatched and unknown destination divisions", () => {
  const invalidDivision = {
    ok: false,
    code: "INVALID_DESTINATION_DIVISION",
    error:
      "Destination divisions must belong to the selected office in this department.",
  };

  for (const officeDivisionId of ["division-other-office", "division-unknown"]) {
    assert.deepEqual(
      validateOfficeReassignments({
        affectedEmployeeIds: ["employee-1"],
        assignedEmployeeIds: ["employee-1"],
        reassignments: [
          {
            employeeId: "employee-1",
            officeId: "office-a",
            officeDivisionId,
          },
        ],
        validDestinationOfficeIds: ["office-a", "office-b"],
        validDestinationDivisions: [
          { id: "division-other-office", officeId: "office-b" },
        ],
        deletingOfficeId: "office-delete",
      }),
      invalidDivision
    );
  }
});

test("office deletion rejects a division for a non-assigned employee", () => {
  assert.deepEqual(
    validateOfficeReassignments({
      affectedEmployeeIds: ["employee-1"],
      assignedEmployeeIds: [],
      reassignments: [
        {
          employeeId: "employee-1",
          officeId: "office-a",
          officeDivisionId: "division-a",
        },
      ],
      validDestinationOfficeIds: ["office-a"],
      validDestinationDivisions: [
        { id: "division-a", officeId: "office-a" },
      ],
      deletingOfficeId: "office-delete",
    }),
    {
      ok: false,
      code: "INVALID_DESTINATION_DIVISION",
      error:
        "Destination divisions must belong to the selected office in this department.",
    }
  );
});

test("office deletion assigns the selected destination division", () => {
  assert.deepEqual(
    buildOfficeDeletionEmployeePatch(
      {
        officeId: "office-delete",
        designationId: null,
        officeDivision: { officeId: "office-delete" },
        plantillaPosition: null,
      },
      "office-delete",
      "office-destination",
      "division-destination"
    ),
    {
      officeId: "office-destination",
      officeDivisionId: "division-destination",
    }
  );
});

test("office deletion clears the division for an office-level destination", () => {
  assert.deepEqual(
    buildOfficeDeletionEmployeePatch(
      {
        officeId: "office-delete",
        designationId: null,
        officeDivision: { officeId: "office-delete" },
        plantillaPosition: null,
      },
      "office-delete",
      "office-destination",
      null
    ),
    {
      officeId: "office-destination",
      officeDivisionId: null,
    }
  );
});

test("office deletion leaves a designated-only employee division untouched", () => {
  assert.deepEqual(
    buildOfficeDeletionEmployeePatch(
      {
        officeId: "office-keep",
        designationId: "office-delete",
        officeDivision: { officeId: "office-keep" },
        plantillaPosition: null,
      },
      "office-delete",
      "office-destination",
      "malicious-division"
    ),
    { designationId: "office-destination" }
  );
});

test("office deletion creates only relation update fields for the deleting office", () => {
  const patch = buildOfficeDeletionEmployeePatch(
    {
      officeId: "office-delete",
      designationId: "office-delete",
      officeDivision: { officeId: "office-delete" },
      plantillaPosition: { officeId: "office-delete" },
    },
    "office-delete",
    "office-destination"
  );

  assert.deepEqual(patch, {
    officeId: "office-destination",
    designationId: "office-destination",
    officeDivisionId: null,
    plantillaPositionId: null,
  });
  assert.equal("position" in patch, false);
  assert.equal("salaryGrade" in patch, false);
  assert.equal("employeeTypeId" in patch, false);
  assert.equal("employeeNo" in patch, false);
  assert.equal("bioIndexCode" in patch, false);
});

test("office deletion leaves unrelated employee relations out of the update patch", () => {
  assert.deepEqual(
    buildOfficeDeletionEmployeePatch(
      {
        officeId: "office-keep",
        designationId: "office-keep",
        officeDivision: { officeId: "office-keep" },
        plantillaPosition: { officeId: "office-delete" },
      },
      "office-delete",
      "office-destination"
    ),
    { plantillaPositionId: null }
  );
});

test("office deletion detects employees added or removed after preview", () => {
  assert.equal(
    hasStaleOfficeDeletionPreview(
      ["employee-1", "employee-2"],
      ["employee-2", "employee-3"]
    ),
    true
  );
  assert.equal(
    hasStaleOfficeDeletionPreview(
      ["employee-2", "employee-1"],
      ["employee-1", "employee-2"]
    ),
    false
  );
});
