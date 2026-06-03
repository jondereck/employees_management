import assert from "node:assert/strict";
import test from "node:test";

import { GENIO_CAPABILITIES } from "@/src/genio/capabilities";
import { GENIO_FIELD_ALLOWLIST, GENIO_SENSITIVE_FIELDS } from "@/src/genio/privacy";
import { runGenio } from "@/src/genio/service";
import { GENIO_OPENAI_TOOLS, isGenioToolName } from "@/src/genio/toolRegistry";
import { validateGenioToolArgs } from "@/src/genio/validators";

test("Genio exposes the MVP semantic tools", () => {
  const toolNames = GENIO_OPENAI_TOOLS.map((tool) => tool.function.name);

  assert.ok(toolNames.includes("not_answerable"));
  assert.ok(toolNames.includes("formula_query"));
  assert.ok(toolNames.includes("history_snapshot"));
  assert.ok(toolNames.includes("award_analytics"));
  assert.ok(toolNames.includes("employment_event_lookup"));
  assert.ok(toolNames.includes("schedule_metadata"));
  assert.ok(toolNames.includes("eligibility_query"));
  assert.ok(toolNames.includes("employee_type_query"));
  assert.ok(toolNames.includes("salary_grade_query"));
  assert.ok(toolNames.includes("retirement_query"));
  assert.ok(toolNames.includes("data_quality_query"));
  assert.ok(toolNames.includes("public_profile_query"));
  assert.ok(toolNames.includes("office_staffing_query"));
  assert.ok(toolNames.includes("designation_query"));
  assert.ok(toolNames.includes("award_query"));
  assert.ok(toolNames.includes("employment_event_query"));
});

test("Genio rejects write actions before any DB-backed handler runs", async () => {
  const result = await runGenio({
    departmentId: "department-1",
    message: "delete employee 123",
    context: {},
  });

  assert.equal(result.kind, "text");
  assert.match(result.reply, /Read-only/i);
  assert.equal(result.meta?.metadata?.tool, "not_answerable");
  assert.equal(result.meta?.metadata?.exact, false);
  assert.equal(result.meta?.metadata?.scopedByDepartment, true);
});

test("Genio rejects attendance analytics when only schedule metadata exists", async () => {
  const result = await runGenio({
    departmentId: "department-1",
    message: "sino laging late this month?",
    context: {},
  });

  assert.equal(result.kind, "text");
  assert.match(result.reply, /attendance log fields/i);
  assert.equal(result.meta?.metadata?.tool, "not_answerable");
});

test("sensitive fields are not part of the normal employee allowlist", () => {
  const employeeFields = new Set<string>(GENIO_FIELD_ALLOWLIST.employee);

  for (const field of GENIO_SENSITIVE_FIELDS) {
    assert.equal(employeeFields.has(field), false);
  }
});

test("tool registry recognizes only allowlisted tools", () => {
  assert.equal(isGenioToolName("count_employees"), true);
  assert.equal(isGenioToolName("salary_grade_query"), true);
  assert.equal(isGenioToolName("formula_query"), true);
  assert.equal(isGenioToolName("not_answerable"), true);
  assert.equal(isGenioToolName("delete_employee"), false);
  assert.equal(isGenioToolName("raw_sql"), false);
});

test("tool validators reject invalid unsafe arguments", () => {
  assert.throws(() => validateGenioToolArgs("age_analysis", { age: { min: -1 } }));
  assert.throws(() => validateGenioToolArgs("schedule_metadata", { limit: 5000 }));
  assert.throws(() => validateGenioToolArgs("formula_query", { operation: "average", metric: "tinNo" }));
  assert.throws(() => validateGenioToolArgs("formula_query", { operation: "raw_sql", metric: "salary" }));
  assert.throws(() => validateGenioToolArgs("formula_query", { operation: "average", metric: "salary", rawSql: "select * from employee" }));
  assert.throws(() => validateGenioToolArgs("formula_query", { operation: "average", metric: "salary", filters: { contactNumber: "09" } }));
  assert.throws(() => validateGenioToolArgs("formula_query", { operation: "average", metric: "salary", filters: { emergencyContactNumber: "09" } }));
  assert.throws(() => validateGenioToolArgs("formula_query", { operation: "average", metric: "salary", filters: { address: "x" } }));
  assert.doesNotThrow(() => validateGenioToolArgs("count_employees", { gender: "Female" }));
  assert.doesNotThrow(() => validateGenioToolArgs("formula_query", { operation: "average", metric: "salary", groupBy: "office" }));
});

test("capability map marks attendance analytics as unavailable", () => {
  assert.equal(GENIO_CAPABILITIES.attendanceAnalytics.answerable, false);
  assert.match(GENIO_CAPABILITIES.attendanceAnalytics.reason, /No attendance log/i);
});
