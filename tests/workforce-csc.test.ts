import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWorkforceCscSummary,
  classifyQ38Row,
  classifyQ39Row,
  type WorkforceCscEmployee,
} from "@/lib/workforce-csc";

function makeEmployee(overrides: Partial<WorkforceCscEmployee> = {}): WorkforceCscEmployee {
  return {
    id: overrides.id ?? "emp-1",
    firstName: overrides.firstName ?? "Juan",
    lastName: overrides.lastName ?? "Dela Cruz",
    middleName: overrides.middleName ?? "",
    suffix: overrides.suffix ?? "",
    gender: overrides.gender ?? "Male",
    position: overrides.position ?? "Administrative Aide I",
    salaryGrade: overrides.salaryGrade ?? 5,
    dateHired: overrides.dateHired ?? "2020-01-01",
    latestAppointment: overrides.latestAppointment ?? "2020-01-01",
    terminateDate: overrides.terminateDate ?? "",
    isArchived: overrides.isArchived ?? false,
    office: overrides.office ?? { name: "HR Office" },
    employeeType: overrides.employeeType ?? { name: "Permanent" },
    eligibility: overrides.eligibility ?? { name: "Career Service Professional" },
    employmentEvents:
      overrides.employmentEvents ?? [{ type: "HIRED", occurredAt: "2020-01-01" }],
  };
}

test("maps clerical and trade positions to first-level rows", () => {
  assert.equal(
    classifyQ39Row(
      makeEmployee({
        position: "Administrative Aide I",
        salaryGrade: 5,
      })
    ),
    "career_first_non_supervisory"
  );

  assert.equal(
    classifyQ39Row(
      makeEmployee({
        position: "Driver II",
        salaryGrade: 12,
      })
    ),
    "career_first_supervisory"
  );
});

test("maps sg 25 and above to third-level career service", () => {
  assert.equal(
    classifyQ39Row(
      makeEmployee({
        position: "Department Head I",
        salaryGrade: 25,
      })
    ),
    "career_third"
  );
});

test("keeps sg 24 and below inside second-level supervisory when not first-level", () => {
  assert.equal(
    classifyQ39Row(
      makeEmployee({
        position: "Administrative Officer V",
        salaryGrade: 24,
      })
    ),
    "career_second_supervisory"
  );
});

test("maps elective and contractual special cases to non-career specialized row", () => {
  assert.equal(
    classifyQ39Row(
      makeEmployee({
        position: "Board Member",
        employeeType: { name: "Permanent" },
      })
    ),
    "noncareer_elective_confidential_contractual_specialized"
  );

  assert.equal(
    classifyQ39Row(
      makeEmployee({
        position: "Protocol Officer",
        employeeType: { name: "Contract of Service" },
      })
    ),
    "noncareer_elective_confidential_contractual_specialized"
  );
});

test("maps emergency and seasonal employee types to non-career emergency row", () => {
  assert.equal(
    classifyQ39Row(
      makeEmployee({
        employeeType: { name: "Seasonal" },
      })
    ),
    "noncareer_emergency_seasonal"
  );
});

test("lands missing classification data in others", () => {
  assert.equal(
    classifyQ39Row(
      makeEmployee({
        position: "",
        employeeType: { name: "" },
        office: { name: "" },
      })
    ),
    "others"
  );
});

test("normalizes q3.8 employee type labels", () => {
  assert.equal(classifyQ38Row(makeEmployee({ employeeType: { name: "Temporary" } })), "temporary");
  assert.equal(classifyQ38Row(makeEmployee({ employeeType: { name: "Substitute" } })), "substitute");
  assert.equal(classifyQ38Row(makeEmployee({ employeeType: { name: "Co-terminous" } })), "coterminous");
  assert.equal(classifyQ38Row(makeEmployee({ employeeType: { name: "Fixed-Term" } })), "fixed_term");
  assert.equal(classifyQ38Row(makeEmployee({ employeeType: { name: "Contract of Service" } })), "contractual");
  assert.equal(classifyQ38Row(makeEmployee({ employeeType: { name: "Casual" } })), "casual");
  assert.equal(classifyQ38Row(makeEmployee({ employeeType: { name: "Provisional" } })), "provisional");
});

test("computes q3.8 averages from employee service months and returns zero for empty rows", () => {
  const summary = buildWorkforceCscSummary(
    [
      makeEmployee({
        id: "temp-1",
        firstName: "Mario",
        gender: "Male",
        employeeType: { name: "Temporary" },
        dateHired: "2020-01-01",
        latestAppointment: "2020-01-01",
      }),
      makeEmployee({
        id: "temp-2",
        firstName: "Maria",
        gender: "Female",
        employeeType: { name: "Temporary" },
        dateHired: "2024-01-01",
        latestAppointment: "2024-01-01",
        employmentEvents: [{ type: "HIRED", occurredAt: "2024-01-01" }],
      }),
    ],
    new Date("2025-01-01T00:00:00.000Z")
  );

  const temporaryRow = summary.q38.rows.find((row) => row.rowKey === "temporary");
  const casualRow = summary.q38.rows.find((row) => row.rowKey === "casual");

  assert.ok(temporaryRow);
  assert.ok(casualRow);
  assert.ok(temporaryRow.male > temporaryRow.female);
  assert.ok(temporaryRow.total > 0);
  assert.ok(temporaryRow.total < temporaryRow.male);
  assert.ok(temporaryRow.total > temporaryRow.female);
  assert.equal(casualRow.total, 0);
});
