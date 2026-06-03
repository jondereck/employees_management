import { z } from "zod";

const boundedString = (max = 200) => z.string().trim().min(1).max(max);
const stringArraySchema = z.array(z.string().trim().min(1).max(200)).max(20);
const formulaFilterSchema = z.object({
  office: boundedString(200).optional(),
  gender: z.enum(["Male", "Female"]).optional(),
  employeeType: boundedString(120).optional(),
  age: z.object({
    min: z.number().int().min(0).max(120).optional(),
    max: z.number().int().min(0).max(120).optional(),
    exact: z.number().int().min(0).max(120).optional(),
  }).strict().optional(),
  tenure: z.object({
    min: z.number().int().min(0).max(100).optional(),
    max: z.number().int().min(0).max(100).optional(),
  }).strict().optional(),
  salaryGrade: z.number().int().min(1).max(40).optional(),
  salaryStep: z.number().int().min(1).max(20).optional(),
}).strict();

export const emptyToolArgsSchema = z.object({}).strip();

export const notAnswerableArgsSchema = z.object({
  reason: z.enum([
    "missing_database_field",
    "write_action_not_allowed",
    "outside_hrps_scope",
    "ambiguous_question",
    "sensitive_data_restricted",
  ]),
  missingData: z.string().trim().min(1).max(200).optional(),
  suggestedQuestions: z.array(z.string().trim().min(1).max(200)).max(5).optional(),
}).strip();

export const genioToolArgumentSchemas = {
  lookup_employees: z.object({
    query: z.string().trim().min(1).max(250).optional(),
    employeeNumbers: stringArraySchema.optional(),
    employeeNoPrefix: z.string().trim().min(1).max(30).optional(),
    noteKeywords: stringArraySchema.max(10).optional(),
  }).strip(),
  employee_extreme: z.object({
    metric: z.enum(["oldest", "youngest", "longest_tenure", "newest_hire"]),
  }).strip(),
  formula_query: z.object({
    operation: z.enum(["oldest", "youngest", "highest", "lowest", "newest_hire", "longest_tenure", "count", "average", "sum", "min", "max", "top"]),
    metric: z.enum(["age", "birthday", "date_hired", "tenure", "salary", "salary_grade", "salary_step", "count"]),
    filters: formulaFilterSchema.optional(),
    groupBy: z.enum(["office", "gender", "employee_type", "eligibility", "salary_grade"]).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }).strict(),
  count_employees: z.object({
    office: boundedString(200).optional(),
    gender: z.enum(["Male", "Female"]).optional(),
    employeeType: boundedString(120).optional(),
    age: z.object({
      min: z.number().int().min(0).max(120).optional(),
      max: z.number().int().min(0).max(120).optional(),
      exact: z.number().int().min(0).max(120).optional(),
    }).strip().optional(),
  }).strip(),
  office_distribution: z.object({
    gender: z.enum(["Male", "Female"]).optional(),
    employeeType: boundedString(120).optional(),
    age: z.object({
      min: z.number().int().min(0).max(120).optional(),
      max: z.number().int().min(0).max(120).optional(),
      exact: z.number().int().min(0).max(120).optional(),
    }).strip().optional(),
  }).strip(),
  list_offices: emptyToolArgsSchema,
  list_office_heads: emptyToolArgsSchema,
  who_is_office_head: z.object({ office: boundedString(200).optional() }).strip(),
  check_office_head: z.object({
    employeeName: boundedString(200),
    office: boundedString(200),
  }).strip(),
  offices_without_head: emptyToolArgsSchema,
  age_distribution: emptyToolArgsSchema,
  gender_distribution: z.object({ office: boundedString(200).optional() }).strip(),
  office_insight: z.object({ office: boundedString(200).optional() }).strip(),
  compare_offices: z.object({
    offices: stringArraySchema.min(2).max(4).optional(),
  }).strip(),
  compare_employee_types: z.object({
    offices: stringArraySchema.min(2).max(4).optional(),
  }).strip(),
  top_offices: emptyToolArgsSchema,
  smallest_office: emptyToolArgsSchema,
  age_analysis: z.object({
    age: z.object({
      min: z.number().int().min(0).max(120).optional(),
      max: z.number().int().min(0).max(120).optional(),
      exact: z.number().int().min(0).max(120).optional(),
    }).strip(),
    gender: z.enum(["Male", "Female"]).optional(),
    office: boundedString(200).optional(),
  }).strip(),
  tenure_analysis: z.object({
    tenure: z.object({
      min: z.number().int().min(0).max(100).optional(),
      max: z.number().int().min(0).max(100).optional(),
    }).strip(),
    gender: z.enum(["Male", "Female"]).optional(),
    office: boundedString(200).optional(),
  }).strip(),
  current_employees_by_year: z.object({
    year: z.number().int().min(1900).max(2200).optional(),
  }).strip(),
  list_last_result: emptyToolArgsSchema,
  show_profile: emptyToolArgsSchema,
  export_last_result: emptyToolArgsSchema,
  history_snapshot: z.object({
    year: z.number().int().min(1900).max(2200).optional(),
    office: boundedString(200).optional(),
    status: boundedString(80).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }).strip(),
  award_analytics: z.object({
    employeeName: boundedString(200).optional(),
    year: z.number().int().min(1900).max(2200).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }).strip(),
  employment_event_lookup: z.object({
    employeeName: boundedString(200).optional(),
    eventType: boundedString(80).optional(),
    year: z.number().int().min(1900).max(2200).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }).strip(),
  schedule_metadata: z.object({
    employeeName: boundedString(200).optional(),
    office: boundedString(200).optional(),
    date: boundedString(40).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }).strip(),
  eligibility_query: z.object({
    mode: z.enum(["count", "list", "missing", "distribution"]),
    eligibilityName: boundedString(160).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }).strip(),
  employee_type_query: z.object({
    mode: z.enum(["count", "list", "distribution", "compare"]),
    employeeType: boundedString(120).optional(),
    employeeTypes: stringArraySchema.min(2).max(5).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }).strip(),
  salary_grade_query: z.object({
    mode: z.enum(["count", "distribution", "highest", "missing"]),
    salaryGrade: z.number().int().min(1).max(40).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }).strip(),
  retirement_query: z.object({
    mode: z.enum(["near_retirement", "age_at_least", "retirement_this_year"]),
    age: z.number().int().min(1).max(120).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }).strip(),
  data_quality_query: z.object({
    field: z.enum(["birthday", "employee_number", "office", "latest_appointment"]),
    limit: z.number().int().min(1).max(100).optional(),
  }).strip(),
  public_profile_query: z.object({
    mode: z.enum(["enabled", "disabled", "count_enabled"]),
    limit: z.number().int().min(1).max(100).optional(),
  }).strip(),
  office_staffing_query: z.object({
    mode: z.enum(["empty_offices", "single_employee_offices"]),
    limit: z.number().int().min(1).max(100).optional(),
  }).strip(),
  designation_query: z.object({
    mode: z.enum(["with_designation", "designation_mismatch"]),
    office: boundedString(200).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }).strip(),
  award_query: z.object({
    mode: z.enum(["this_year", "most_awarded", "by_issuer", "without_awards"]),
    issuer: boundedString(160).optional(),
    year: z.number().int().min(1900).max(2200).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }).strip(),
  employment_event_query: z.object({
    mode: z.enum(["by_type", "recent_hires", "without_events"]),
    eventType: boundedString(80).optional(),
    year: z.number().int().min(1900).max(2200).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }).strip(),
  not_answerable: notAnswerableArgsSchema,
} as const;

export type GenioToolName = keyof typeof genioToolArgumentSchemas;

export function validateGenioToolArgs(name: GenioToolName, args: unknown) {
  return genioToolArgumentSchemas[name].parse(args && typeof args === "object" && !Array.isArray(args) ? args : {});
}
