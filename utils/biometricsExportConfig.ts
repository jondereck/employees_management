import { UNASSIGNED_OFFICE_LABEL, UNKNOWN_OFFICE_LABEL, UNMATCHED_LABEL } from "./biometricsShared";

export const SUMMARY_COLUMN_GROUPS = [
  { id: "identity", label: "Identity" },
  { id: "attendance", label: "Attendance (summary)" },
  { id: "audit", label: "Audit" },
] as const;

export type SummaryColumnGroupId = (typeof SUMMARY_COLUMN_GROUPS)[number]["id"];

export type SummaryColumnKey =
  | "employeeId"
  | "employeeName"
  | "office"
  | "schedule"
  | "matchStatus"
  | "source"
  | "days"
  | "lateDays"
  | "undertimeDays"
  | "latePercent"
  | "undertimePercent"
  | "lateMinutes"
  | "undertimeMinutes"
  | "resolvedEmployeeId"
  | "resolvedAt"
  | "sourceFilesCount";

export type SummaryColumnType = "text" | "number" | "percent" | "minutes" | "date";
export type SummaryColumnWidth = "id" | "name" | "office" | "schedule" | "numeric";

export type SummaryColumnDefinition = {
  key: SummaryColumnKey;
  label: string;
  groupId: SummaryColumnGroupId;
  description?: string;
  type: SummaryColumnType;
  width: SummaryColumnWidth;
  defaultSelected: boolean;
};

export const SUMMARY_COLUMN_DEFINITIONS: SummaryColumnDefinition[] = [
  {
    key: "employeeId",
    label: "Employee ID",
    groupId: "identity",
    description: "Official employee identifier or token when missing.",
    type: "text",
    width: "id",
    defaultSelected: true,
  },
  {
    key: "employeeName",
    label: "Name",
    groupId: "identity",
    description: "Recorded employee name (unmatched tokens marked).",
    type: "text",
    width: "name",
    defaultSelected: true,
  },
  {
    key: "office",
    label: "Office",
    groupId: "identity",
    description: "Office or unit on record; unmatched rows appear as (Unknown).",
    type: "text",
    width: "office",
    defaultSelected: true,
  },
  {
    key: "schedule",
    label: "Schedule",
    groupId: "identity",
    description: "Schedule tags detected across the period.",
    type: "text",
    width: "schedule",
    defaultSelected: true,
  },
  {
    key: "matchStatus",
    label: "Match Status",
    groupId: "identity",
    description: "Matched, unmatched, or solved via resolver.",
    type: "text",
    width: "id",
    defaultSelected: true,
  },
  {
    key: "source",
    label: "Source",
    groupId: "identity",
    description: "Primary schedule source (default, exception, etc.).",
    type: "text",
    width: "schedule",
    defaultSelected: true,
  },
  {
    key: "days",
    label: "Days",
    groupId: "attendance",
    description: "Evaluated days with any punch.",
    type: "number",
    width: "numeric",
    defaultSelected: true,
  },
  {
    key: "lateDays",
    label: "Late (days)",
    groupId: "attendance",
    description: "Count of days flagged late.",
    type: "number",
    width: "numeric",
    defaultSelected: true,
  },
  {
    key: "undertimeDays",
    label: "UT (days)",
    groupId: "attendance",
    description: "Count of days flagged undertime.",
    type: "number",
    width: "numeric",
    defaultSelected: true,
  },
  {
    key: "latePercent",
    label: "Late %",
    groupId: "attendance",
    description: "Share of late days vs evaluated days.",
    type: "percent",
    width: "numeric",
    defaultSelected: true,
  },
  {
    key: "undertimePercent",
    label: "UT %",
    groupId: "attendance",
    description: "Share of undertime days vs evaluated days.",
    type: "percent",
    width: "numeric",
    defaultSelected: true,
  },
  {
    key: "lateMinutes",
    label: "Late (min)",
    groupId: "attendance",
    description: "Total late minutes summed across the period.",
    type: "minutes",
    width: "numeric",
    defaultSelected: true,
  },
  {
    key: "undertimeMinutes",
    label: "UT (min)",
    groupId: "attendance",
    description: "Total undertime minutes summed across the period.",
    type: "minutes",
    width: "numeric",
    defaultSelected: true,
  },
  {
    key: "resolvedEmployeeId",
    label: "Resolved Employee ID",
    groupId: "audit",
    description: "Resolver-mapped employee ID, if any.",
    type: "text",
    width: "id",
    defaultSelected: true,
  },
  {
    key: "resolvedAt",
    label: "Resolved At",
    groupId: "audit",
    description: "Resolver timestamp, when available.",
    type: "date",
    width: "numeric",
    defaultSelected: false,
  },
  {
    key: "sourceFilesCount",
    label: "Source Files Count",
    groupId: "audit",
    description: "Unique biometrics files contributing to the employee's rows.",
    type: "number",
    width: "numeric",
    defaultSelected: true,
  },
];

export const SUMMARY_COLUMN_DEFINITION_MAP: Record<SummaryColumnKey, SummaryColumnDefinition> =
  SUMMARY_COLUMN_DEFINITIONS.reduce((acc, def) => {
    acc[def.key] = def;
    return acc;
  }, {} as Record<SummaryColumnKey, SummaryColumnDefinition>);

export const ALL_SUMMARY_COLUMN_KEYS = SUMMARY_COLUMN_DEFINITIONS.map((definition) => definition.key);

export const DEFAULT_SUMMARY_COLUMN_ORDER = [...ALL_SUMMARY_COLUMN_KEYS];

export const DEFAULT_SUMMARY_SELECTED_COLUMNS = SUMMARY_COLUMN_DEFINITIONS.filter(
  (definition) => definition.defaultSelected
).map((definition) => definition.key);

export const SUMMARY_COLUMN_GROUP_LABEL: Record<SummaryColumnGroupId, string> = SUMMARY_COLUMN_GROUPS.reduce(
  (acc, group) => {
    acc[group.id] = group.label;
    return acc;
  },
  {} as Record<SummaryColumnGroupId, string>
);

export const DEFAULT_OFFICE_LABELS = {
  unknown: UNKNOWN_OFFICE_LABEL,
  unassigned: UNASSIGNED_OFFICE_LABEL,
  unmatched: UNMATCHED_LABEL,
};
