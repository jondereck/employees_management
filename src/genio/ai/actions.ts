import { GenioAction } from "../type";


export const GENIO_ACTIONS: readonly GenioAction[] = [
  "count",
  "list",
  "describe_employee",
  "distribution",
  "compare_offices",
  "compare_employee_types",
  "top_offices",
  "smallest_office",
  "export",
  "insight",
  "ai_answer",
  "show_profile",
  "list_offices",
  "list_from_last_count",
  "who_is_head",
  "is_head",
  "list_heads",
  "offices_no_head",
  "age_analysis",
  "tenure_analysis",
  "unknown",
] as const;
