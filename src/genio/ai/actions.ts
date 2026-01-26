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
  "unknown",
] as const;
