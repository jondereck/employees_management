import { GENIO_FIELD_ALLOWLIST } from "./privacy";
import { attachGenioMetadata, createGenioMetadata } from "./formatter";
import { GENIO_OPENAI_TOOLS } from "./toolDefinitions";
import { executeGenioTool, GenioToolResult, ToolEnvironment } from "./tools";
import { GenioToolName, validateGenioToolArgs } from "./validators";

export { GENIO_OPENAI_TOOLS };
export type { GenioToolName };
export type { GenioToolResult };

export function isGenioToolName(name: string): name is GenioToolName {
  return name in GENIO_TOOL_REGISTRY;
}

export const GENIO_TOOL_REGISTRY = Object.freeze({
  lookup_employees: { selectedFields: GENIO_FIELD_ALLOWLIST.employee },
  employee_extreme: { selectedFields: GENIO_FIELD_ALLOWLIST.employee },
  count_employees: { selectedFields: ["id"] },
  office_distribution: { selectedFields: ["officeId", "gender"] },
  list_offices: { selectedFields: GENIO_FIELD_ALLOWLIST.office },
  list_office_heads: { selectedFields: ["id", "firstName", "middleName", "lastName", "officeId", "isHead"] },
  who_is_office_head: { selectedFields: ["id", "firstName", "middleName", "lastName", "officeId", "isHead"] },
  check_office_head: { selectedFields: ["id", "firstName", "middleName", "lastName", "officeId", "isHead"] },
  offices_without_head: { selectedFields: GENIO_FIELD_ALLOWLIST.office },
  age_distribution: { selectedFields: ["birthday"] },
  gender_distribution: { selectedFields: ["gender", "officeId"] },
  office_insight: { selectedFields: ["officeId", "gender", "employeeTypeId"] },
  compare_offices: { selectedFields: ["officeId", "gender"] },
  compare_employee_types: { selectedFields: ["officeId", "employeeTypeId"] },
  top_offices: { selectedFields: ["officeId"] },
  smallest_office: { selectedFields: ["officeId"] },
  age_analysis: { selectedFields: ["birthday", "gender", "officeId"] },
  tenure_analysis: { selectedFields: ["dateHired", "gender", "officeId"] },
  current_employees_by_year: { selectedFields: ["dateHired", "terminateDate"] },
  list_last_result: { selectedFields: GENIO_FIELD_ALLOWLIST.employee },
  show_profile: { selectedFields: GENIO_FIELD_ALLOWLIST.employee },
  export_last_result: { selectedFields: GENIO_FIELD_ALLOWLIST.employee },
  history_snapshot: { selectedFields: GENIO_FIELD_ALLOWLIST.historySnapshot },
  award_analytics: { selectedFields: GENIO_FIELD_ALLOWLIST.award },
  employment_event_lookup: { selectedFields: GENIO_FIELD_ALLOWLIST.employmentEvent },
  schedule_metadata: { selectedFields: GENIO_FIELD_ALLOWLIST.schedule },
  not_answerable: { selectedFields: [] },
} satisfies Record<GenioToolName, { selectedFields: readonly string[] }>);

export async function executeRegisteredGenioTool(
  name: string,
  args: unknown,
  env: ToolEnvironment
): Promise<GenioToolResult | null> {
  if (!isGenioToolName(name)) return null;

  const safeArgs = validateGenioToolArgs(name, args);
  const result = await executeGenioTool(name, safeArgs, env);
  if (!result || result.kind !== "text") return result;

  const metadata = createGenioMetadata({
    tool: name,
    filters: safeArgs,
    selectedFields: [...GENIO_TOOL_REGISTRY[name].selectedFields],
    resultCount: inferResultCount(result.reply),
    exact: name !== "not_answerable",
    partial: false,
  });

  return attachGenioMetadata(result, metadata);
}

function inferResultCount(reply: string) {
  const numberedRows = reply.match(/^\d+\./gm);
  if (numberedRows?.length) return numberedRows.length;

  const countMatch = reply.match(/\b(\d+)\s+(?:employee|employees|office|offices|record|records|snapshot|snapshots|award|awards|event|events)\b/i);
  if (countMatch) return Number(countMatch[1]);

  return undefined;
}
