import assert from "node:assert/strict";
import test from "node:test";

import { parseGenioIntent } from "@/src/genio/parse-intent";
import { classifyLocalGenioRoute } from "@/src/genio/router";
import { runGenio, runGenioV1 } from "@/src/genio/service";

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

test("runGenio answers front-desk prompts even when v1 flag is disabled", async () => {
  const taglishHelp = await runGenio({
    departmentId: "department-1",
    message: "ano kaya mo?",
    context: {},
  });

  assert.equal(taglishHelp.kind, "text");
  assert.match(taglishHelp.reply, /Kaya kong sumagot/i);

  const greeting = await runGenio({
    departmentId: "department-1",
    message: "hi",
    context: {},
  });

  assert.equal(greeting.kind, "text");
  assert.match(greeting.reply, /Genio/i);
});

test("classifyLocalGenioRoute maps deterministic HR prompts to current tool names", () => {
  assert.equal(classifyLocalGenioRoute("list all offices").selectedTool, "list_offices");
  assert.equal(classifyLocalGenioRoute("list office heads").selectedTool, "list_office_heads");
  assert.equal(classifyLocalGenioRoute("sino head ng accounting?").selectedTool, "who_is_office_head");
  assert.equal(classifyLocalGenioRoute("ilan active employees?").selectedTool, "count_employees");
  assert.equal(classifyLocalGenioRoute("ilan babae?").selectedTool, "gender_distribution");
});

test("classifyLocalGenioRoute keeps combined filters on count prompts", () => {
  const route = classifyLocalGenioRoute("How many casual male employee between 22-50 age on HRMO?");

  assert.equal(route.selectedTool, "count_employees");
  assert.deepEqual(route.args, {
    gender: "Male",
    employeeType: "casual",
    age: { min: 22, max: 50 },
  });
});

test("classifyLocalGenioRoute maps formula-style employee analytics", () => {
  const oldest = classifyLocalGenioRoute("who is the oldest employee?");
  assert.equal(oldest.selectedTool, "formula_query");
  assert.deepEqual(oldest.args, {
    operation: "oldest",
    metric: "age",
    filters: undefined,
    groupBy: undefined,
  });

  const youngest = classifyLocalGenioRoute("who is the youngest employee");
  assert.equal(youngest.selectedTool, "formula_query");
  assert.deepEqual(youngest.args, {
    operation: "youngest",
    metric: "age",
    filters: undefined,
    groupBy: undefined,
  });

  const youngestInHr = classifyLocalGenioRoute("who is the youngest employee in hr");
  assert.equal(youngestInHr.selectedTool, "formula_query");
  assert.deepEqual(youngestInHr.args, {
    operation: "youngest",
    metric: "age",
    filters: { office: "who is the youngest employee in hr" },
    groupBy: undefined,
  });

  const highestSalary = classifyLocalGenioRoute("highest salary employee");
  assert.equal(highestSalary.selectedTool, "formula_query");
  assert.deepEqual(highestSalary.args, {
    operation: "highest",
    metric: "salary",
    filters: undefined,
    groupBy: undefined,
  });

  const averageSalaryByOffice = classifyLocalGenioRoute("average salary by office");
  assert.equal(averageSalaryByOffice.selectedTool, "formula_query");
  assert.deepEqual(averageSalaryByOffice.args, {
    operation: "average",
    metric: "salary",
    filters: undefined,
    groupBy: "office",
  });

  const lowestSalaryGrade = classifyLocalGenioRoute("employees with lowest salary grade");
  assert.equal(lowestSalaryGrade.selectedTool, "formula_query");
  assert.deepEqual(lowestSalaryGrade.args, {
    operation: "lowest",
    metric: "salary_grade",
    filters: undefined,
    groupBy: undefined,
  });
});

test("classifyLocalGenioRoute treats short HRIS count prompts as employee counts", () => {
  const route = classifyLocalGenioRoute("how many male casual");
  assert.equal(route.selectedTool, "count_employees");
  assert.deepEqual(route.args, {
    gender: "Male",
    employeeType: "casual",
    age: undefined,
  });
});

test("classifyLocalGenioRoute resolves signed-context style follow-up prompts", () => {
  const context = { lastResult: { type: "employee_filter" as const, employeeIds: ["employee-a"] } };

  const listRoute = classifyLocalGenioRoute("list them", context);
  assert.equal(listRoute.intent, "context_followup");
  assert.equal(listRoute.selectedTool, "list_last_result");

  const singularRoute = classifyLocalGenioRoute("who is it", context);
  assert.equal(singularRoute.intent, "context_followup");
  assert.equal(singularRoute.selectedTool, "list_last_result");

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

test("classifyLocalGenioRoute maps high-value schema-backed prompts", () => {
  assert.equal(classifyLocalGenioRoute("Ilan ang Civil Service Professional?").selectedTool, "eligibility_query");
  assert.equal(classifyLocalGenioRoute("List COS employees").selectedTool, "employee_type_query");
  assert.equal(classifyLocalGenioRoute("Salary grade distribution").selectedTool, "salary_grade_query");
  assert.equal(classifyLocalGenioRoute("Employees age 60 and above").selectedTool, "retirement_query");
  assert.equal(classifyLocalGenioRoute("Employees missing latest appointment").selectedTool, "data_quality_query");
  assert.equal(classifyLocalGenioRoute("Employees with public profile disabled").selectedTool, "public_profile_query");
  assert.equal(classifyLocalGenioRoute("Offices with no employees").selectedTool, "office_staffing_query");
  assert.equal(classifyLocalGenioRoute("Employees assigned to office X but designated to office Y").selectedTool, "designation_query");
  assert.equal(classifyLocalGenioRoute("Most awarded employees").selectedTool, "award_query");
  assert.equal(classifyLocalGenioRoute("Who was promoted in 2025?").selectedTool, "employment_event_query");
});
