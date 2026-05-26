import assert from "node:assert/strict";
import test from "node:test";

import { parseGenioIntent } from "@/src/genio/parse-intent";
import { classifyLocalGenioRoute } from "@/src/genio/router";
import { runGenioV1 } from "@/src/genio/service";

test("parseGenioIntent handles Taglish follow-up phrases", () => {
  const parsed = parseGenioIntent("sino sila", { lastResult: { type: "employee_filter" } });
  assert.equal(parsed.intent.action, "list_from_last_count");
  assert.equal(parsed.intent.followUp, true);
  assert.ok(parsed.confidence > 0.8);
});

test("parseGenioIntent extracts current employees by year", () => {
  const parsed = parseGenioIntent("How many current employees as of 2024?");
  assert.equal(parsed.intent.action, "current_employees_by_year");
  assert.equal(parsed.intent.filters.year, 2024);
});

test("parseGenioIntent keeps gender on age range questions", () => {
  const parsed = parseGenioIntent("How many male employees age 30 to 40?");
  assert.equal(parsed.intent.action, "age_analysis");
  assert.equal(parsed.intent.filters.gender, "Male");
  assert.deepEqual(parsed.intent.filters.age, { min: 30, max: 40 });
});

test("runGenioV1 blocks write-actions with high confidence", async () => {
  const output = await runGenioV1({
    departmentId: "department-1",
    message: "delete employee 123",
    context: {},
  });
  assert.equal(output.decision.selectedTool, "not_answerable");
  assert.equal(output.decision.intent, "policy_blocked");
  assert.equal(output.decision.answerabilityClass, "blocked");
  assert.equal(output.decision.fallbackReason, "write_action_not_allowed");
  assert.ok(output.decision.confidence >= 0.99);
});

test("classifyLocalGenioRoute catches front-desk prompts before HR tools", () => {
  assert.equal(classifyLocalGenioRoute("hi").intent, "small_talk");

  const englishHelp = classifyLocalGenioRoute("what can you do?");
  assert.equal(englishHelp.intent, "capability_help");
  assert.equal(englishHelp.selectedTool, undefined);

  const taglishHelp = classifyLocalGenioRoute("ano kaya mo?");
  assert.equal(taglishHelp.intent, "capability_help");
  assert.equal(taglishHelp.selectedTool, undefined);
});

test("classifyLocalGenioRoute maps deterministic HR prompts to current tool names", () => {
  assert.equal(classifyLocalGenioRoute("list all offices").selectedTool, "list_offices");
  assert.equal(classifyLocalGenioRoute("list office heads").selectedTool, "list_office_heads");
  assert.equal(classifyLocalGenioRoute("sino head ng accounting?").selectedTool, "who_is_office_head");
  assert.equal(classifyLocalGenioRoute("ilan active employees?").selectedTool, "count_employees");
  assert.equal(classifyLocalGenioRoute("ilan babae?").selectedTool, "gender_distribution");
});

test("classifyLocalGenioRoute resolves signed-context style follow-up prompts", () => {
  const context = { lastResult: { type: "employee_filter" as const, employeeIds: ["employee-a"] } };

  const listRoute = classifyLocalGenioRoute("list them", context);
  assert.equal(listRoute.intent, "context_followup");
  assert.equal(listRoute.selectedTool, "list_last_result");

  const exportRoute = classifyLocalGenioRoute("export that", context);
  assert.equal(exportRoute.intent, "context_followup");
  assert.equal(exportRoute.selectedTool, "export_last_result");
});

test("classifyLocalGenioRoute blocks sensitive and unsupported prompts", () => {
  const sensitiveRoute = classifyLocalGenioRoute("show TIN");
  assert.equal(sensitiveRoute.intent, "policy_blocked");
  assert.equal(sensitiveRoute.blockedReason, "sensitive_data_restricted");

  const unsupportedRoute = classifyLocalGenioRoute("sino late ngayon?");
  assert.equal(unsupportedRoute.intent, "unsupported");
  assert.equal(unsupportedRoute.blockedReason, "missing_database_field");
});
