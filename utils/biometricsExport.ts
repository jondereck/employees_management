import * as XLSX from "xlsx-js-style";
import { formatISO } from "date-fns";

import {
  resolveLateMinutes,
  resolveMatchStatus,
  resolveUndertimeMinutes,
  sortPerDayRows,
  type PerDayRow,
  type PerEmployeeRow,
} from "./parseBioAttendance";

type CellKind = "text" | "number" | "percent" | "minutes" | "date" | "time";

type CellValue = {
  value: string | number | null;
  display: string;
};

type SummaryContext = {
  sourceFileCounts: Map<string, number>;
};

export type SummaryColumnGroup = "identity" | "attendance" | "audit";

export type SummaryColumnKey =
  | "employeeId"
  | "employeeName"
  | "office"
  | "schedule"
  | "matchStatus"
  | "scheduleSource"
  | "daysWithLogs"
  | "lateDays"
  | "undertimeDays"
  | "latePercent"
  | "undertimePercent"
  | "lateMinutes"
  | "undertimeMinutes"
  | "resolvedEmployeeId"
  | "resolvedAt"
  | "sourceFilesCount";

type SummaryColumnDefinition = {
  key: SummaryColumnKey;
  label: string;
  description?: string;
  group: SummaryColumnGroup;
  kind: CellKind;
  width: { min: number; max: number };
  wrap?: boolean;
  getValue: (row: PerEmployeeRow, context: SummaryContext) => CellValue;
};

type PerDayColumnKey =
  | "employeeId"
  | "employeeName"
  | "office"
  | "date"
  | "day"
  | "earliest"
  | "latest"
  | "worked"
  | "workedMinutes"
  | "schedule"
  | "status"
  | "isLate"
  | "isUndertime"
  | "lateMinutes"
  | "undertimeMinutes"
  | "requiredMinutes"
  | "sources"
  | "punches"
  | "scheduleSource"
  | "identityStatus"
  | "matchStatus"
  | "resolvedEmployeeId";

type PerDayColumnDefinition = {
  key: PerDayColumnKey;
  label: string;
  kind: CellKind;
  width: { min: number; max: number };
  wrap?: boolean;
  getValue: (row: PerDayRow) => CellValue;
};

const HEADER_STYLE: XLSX.CellStyle = {
  font: { bold: true, sz: 12 },
  alignment: { horizontal: "left", vertical: "center" },
  fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } },
  border: {
    top: { style: "thin", color: { rgb: "D1D5DB" } },
    bottom: { style: "thin", color: { rgb: "D1D5DB" } },
  },
};

const ZEBRA_FILL = { patternType: "solid", fgColor: { rgb: "FAFAFA" } } as const;

const OFFICE_UNKNOWN_LABEL = "(Unknown)";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const excelDateSerial = (year: number, month: number, day: number): number => {
  const epoch = Date.UTC(1899, 11, 30);
  const date = Date.UTC(year, month - 1, day);
  return (date - epoch) / 86400000;
};

const timeFractionFromHHMM = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return (hours * 60 + minutes) / 1440;
};

const textCell = (value: string | null | undefined, fallback = ""): CellValue => {
  const normalized = value?.trim() ?? "";
  const result = normalized.length ? normalized : fallback;
  return { value: result, display: result };
};

const numberCell = (value: number | null | undefined): CellValue => {
  if (value == null || Number.isNaN(value)) return { value: null, display: "" };
  const rounded = Math.round(value * 1000) / 1000;
  return { value: rounded, display: String(rounded) };
};

const percentCell = (value: number | null | undefined): CellValue => {
  if (value == null || Number.isNaN(value)) return { value: null, display: "" };
  const rounded = Math.round(value * 10) / 10;
  return { value: rounded / 100, display: `${rounded.toFixed(1)}%` };
};

const minutesCell = (value: number | null | undefined): CellValue => {
  if (value == null || Number.isNaN(value)) return { value: null, display: "" };
  const minutes = Math.max(0, Math.round(value));
  return { value: minutes, display: `${minutes} min` };
};

const dateCell = (iso: string | null | undefined): CellValue => {
  if (!iso) return { value: null, display: "" };
  const parts = iso.split("-");
  if (parts.length !== 3) return { value: null, display: "" };
  const [year, month, day] = parts.map((part) => Number(part));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return { value: null, display: "" };
  }
  const serial = excelDateSerial(year, month, day);
  return { value: serial, display: dateFormatter.format(new Date(Date.UTC(year, month - 1, day))) };
};

const timeCell = (value: string | null | undefined): CellValue => {
  if (!value) return { value: null, display: "" };
  const fraction = timeFractionFromHHMM(value);
  if (fraction == null) return { value: null, display: value };
  return { value: fraction, display: value };
};

const deriveWorkedMinutes = (row: PerDayRow): number | null => {
  if (typeof row.workedMinutes === "number") return row.workedMinutes;
  const fraction = timeFractionFromHHMM(row.workedHHMM ?? null);
  if (fraction == null) return null;
  return Math.round(fraction * 1440);
};

const getEmployeeKey = (row: {
  employeeToken?: string | null;
  employeeId?: string | null;
  employeeName?: string | null;
}): string => (row.employeeToken || row.employeeId || row.employeeName || "").trim();

const formatScheduleSource = (value?: string | null) => {
  switch (value) {
    case "WORKSCHEDULE":
      return "Work schedule";
    case "EXCEPTION":
      return "Exception";
    case "DEFAULT":
      return "Default";
    case "NOMAPPING":
      return "No mapping";
    case "":
    case null:
    case undefined:
      return null;
    default:
      return value.charAt(0) + value.slice(1).toLowerCase();
  }
};

const SUMMARY_COLUMNS: SummaryColumnDefinition[] = [
  {
    key: "employeeId",
    label: "Employee ID",
    group: "identity",
    kind: "text",
    width: { min: 14, max: 22 },
    getValue: (row) => textCell(row.employeeId?.trim() || row.employeeToken || ""),
  },
  {
    key: "employeeName",
    label: "Name",
    group: "identity",
    kind: "text",
    width: { min: 26, max: 40 },
    getValue: (row) => textCell(row.employeeName ?? ""),
  },
  {
    key: "office",
    label: "Office",
    group: "identity",
    kind: "text",
    width: { min: 14, max: 22 },
    getValue: (row) => textCell(row.officeName ?? OFFICE_UNKNOWN_LABEL, OFFICE_UNKNOWN_LABEL),
  },
  {
    key: "schedule",
    label: "Schedule",
    group: "identity",
    description: "Schedule types merged across the selected period.",
    kind: "text",
    width: { min: 14, max: 22 },
    getValue: (row) => textCell(row.scheduleTypes?.length ? row.scheduleTypes.join(", ") : null, "—"),
  },
  {
    key: "matchStatus",
    label: "Match Status",
    description: "Matched, unmatched, or solved via manual mapping.",
    group: "identity",
    kind: "text",
    width: { min: 14, max: 22 },
    getValue: (row) => textCell(resolveMatchStatus(row.identityStatus, row.resolvedEmployeeId)),
  },
  {
    key: "scheduleSource",
    label: "Source",
    description: "Primary schedule source that drove the evaluation.",
    group: "identity",
    kind: "text",
    width: { min: 14, max: 22 },
    getValue: (row) => textCell(formatScheduleSource(row.scheduleSource) ?? ""),
  },
  {
    key: "daysWithLogs",
    label: "Days",
    group: "attendance",
    kind: "number",
    width: { min: 10, max: 12 },
    getValue: (row) => numberCell(row.daysWithLogs ?? 0),
  },
  {
    key: "lateDays",
    label: "Late (days)",
    group: "attendance",
    kind: "number",
    width: { min: 10, max: 12 },
    getValue: (row) => numberCell(row.lateDays ?? 0),
  },
  {
    key: "undertimeDays",
    label: "UT (days)",
    group: "attendance",
    kind: "number",
    width: { min: 10, max: 12 },
    getValue: (row) => numberCell(row.undertimeDays ?? 0),
  },
  {
    key: "latePercent",
    label: "Late %",
    group: "attendance",
    kind: "percent",
    width: { min: 10, max: 12 },
    getValue: (row) => percentCell(row.lateRate ?? null),
  },
  {
    key: "undertimePercent",
    label: "UT %",
    group: "attendance",
    kind: "percent",
    width: { min: 10, max: 12 },
    getValue: (row) => percentCell(row.undertimeRate ?? null),
  },
  {
    key: "lateMinutes",
    label: "Late (min)",
    description: "Sum of daily late minutes within the export period.",
    group: "attendance",
    kind: "minutes",
    width: { min: 10, max: 12 },
    getValue: (row) => minutesCell(row.totalLateMinutes ?? null),
  },
  {
    key: "undertimeMinutes",
    label: "UT (min)",
    description: "Sum of daily undertime minutes within the export period.",
    group: "attendance",
    kind: "minutes",
    width: { min: 10, max: 12 },
    getValue: (row) => minutesCell(row.totalUndertimeMinutes ?? null),
  },
  {
    key: "resolvedEmployeeId",
    label: "Resolved Employee ID",
    group: "audit",
    kind: "text",
    width: { min: 14, max: 22 },
    getValue: (row) => textCell(row.resolvedEmployeeId ?? ""),
  },
  {
    key: "resolvedAt",
    label: "Resolved At",
    group: "audit",
    kind: "text",
    width: { min: 14, max: 22 },
    getValue: () => textCell(""),
  },
  {
    key: "sourceFilesCount",
    label: "Source Files Count",
    description: "Unique source files contributing to the employee's rows.",
    group: "audit",
    kind: "number",
    width: { min: 10, max: 12 },
    getValue: (row, context) => numberCell(context.sourceFileCounts.get(getEmployeeKey(row)) ?? 0),
  },
];

const PER_DAY_COLUMNS: PerDayColumnDefinition[] = [
  {
    key: "employeeId",
    label: "Employee ID",
    kind: "text",
    width: { min: 14, max: 22 },
    getValue: (row) => textCell(row.employeeId ?? ""),
  },
  {
    key: "employeeName",
    label: "Name",
    kind: "text",
    width: { min: 26, max: 40 },
    getValue: (row) => textCell(row.employeeName ?? ""),
  },
  {
    key: "office",
    label: "Office",
    kind: "text",
    width: { min: 14, max: 22 },
    getValue: (row) => textCell(row.officeName ?? OFFICE_UNKNOWN_LABEL, OFFICE_UNKNOWN_LABEL),
  },
  {
    key: "date",
    label: "Date",
    kind: "date",
    width: { min: 14, max: 14 },
    getValue: (row) => dateCell(row.dateISO),
  },
  {
    key: "day",
    label: "Day",
    kind: "number",
    width: { min: 10, max: 12 },
    getValue: (row) => numberCell(row.day ?? null),
  },
  {
    key: "earliest",
    label: "Earliest",
    kind: "time",
    width: { min: 22, max: 36 },
    getValue: (row) => timeCell(row.earliest ?? null),
  },
  {
    key: "latest",
    label: "Latest",
    kind: "time",
    width: { min: 22, max: 36 },
    getValue: (row) => timeCell(row.latest ?? null),
  },
  {
    key: "worked",
    label: "Worked",
    kind: "time",
    width: { min: 22, max: 36 },
    getValue: (row) => timeCell(row.workedHHMM ?? null),
  },
  {
    key: "workedMinutes",
    label: "Worked (min)",
    kind: "minutes",
    width: { min: 10, max: 12 },
    getValue: (row) => minutesCell(deriveWorkedMinutes(row)),
  },
  {
    key: "schedule",
    label: "Schedule",
    kind: "text",
    width: { min: 14, max: 22 },
    getValue: (row) => textCell(row.scheduleType ?? ""),
  },
  {
    key: "status",
    label: "Status",
    kind: "text",
    width: { min: 14, max: 22 },
    getValue: (row) => textCell(row.status ?? ""),
  },
  {
    key: "isLate",
    label: "Late?",
    kind: "text",
    width: { min: 10, max: 12 },
    getValue: (row) => textCell(row.isLate ? "Yes" : "No"),
  },
  {
    key: "isUndertime",
    label: "UT?",
    kind: "text",
    width: { min: 10, max: 12 },
    getValue: (row) => textCell(row.isUndertime ? "Yes" : "No"),
  },
  {
    key: "lateMinutes",
    label: "Late (min)",
    kind: "minutes",
    width: { min: 10, max: 12 },
    getValue: (row) => minutesCell(resolveLateMinutes(row)),
  },
  {
    key: "undertimeMinutes",
    label: "UT (min)",
    kind: "minutes",
    width: { min: 10, max: 12 },
    getValue: (row) => minutesCell(resolveUndertimeMinutes(row)),
  },
  {
    key: "requiredMinutes",
    label: "Required (min)",
    kind: "minutes",
    width: { min: 10, max: 12 },
    getValue: (row) => minutesCell(row.requiredMinutes ?? null),
  },
  {
    key: "sources",
    label: "Sources",
    kind: "text",
    width: { min: 22, max: 36 },
    wrap: true,
    getValue: (row) => textCell(row.sourceFiles.join(", ")),
  },
  {
    key: "punches",
    label: "Punches",
    kind: "text",
    width: { min: 22, max: 36 },
    wrap: true,
    getValue: (row) => textCell(row.allTimes.join(", ")),
  },
  {
    key: "scheduleSource",
    label: "Source",
    kind: "text",
    width: { min: 14, max: 22 },
    getValue: (row) => textCell(formatScheduleSource(row.scheduleSource) ?? ""),
  },
  {
    key: "identityStatus",
    label: "Identity Status",
    kind: "text",
    width: { min: 14, max: 22 },
    getValue: (row) => textCell(row.identityStatus ?? ""),
  },
  {
    key: "matchStatus",
    label: "Match Status",
    kind: "text",
    width: { min: 14, max: 22 },
    getValue: (row) => textCell(resolveMatchStatus(row.identityStatus, row.resolvedEmployeeId)),
  },
  {
    key: "resolvedEmployeeId",
    label: "Resolved Employee ID",
    kind: "text",
    width: { min: 14, max: 22 },
    getValue: (row) => textCell(row.resolvedEmployeeId ?? ""),
  },
];

const ensureCell = (sheet: XLSX.WorkSheet, r: number, c: number) => {
  const address = XLSX.utils.encode_cell({ r, c });
  if (!sheet[address]) {
    sheet[address] = { t: "z" } as XLSX.CellObject;
  }
  return sheet[address] as XLSX.CellObject;
};

const setColumnWidths = (
  sheet: XLSX.WorkSheet,
  definitions: Array<{ width: { min: number; max: number } }>,
  displayMatrix: string[][]
) => {
  const cols: XLSX.ColInfo[] = [];
  for (let c = 0; c < definitions.length; c++) {
    let maxLength = 0;
    for (const row of displayMatrix) {
      const length = row[c]?.length ?? 0;
      if (length > maxLength) maxLength = length;
    }
    const range = definitions[c].width;
    cols[c] = { wch: clamp(maxLength + 2, range.min, range.max) };
  }
  (sheet as any)["!cols"] = cols;
};

const styleSheet = (sheet: XLSX.WorkSheet, definitions: Array<{ kind: CellKind; wrap?: boolean }>) => {
  sheet["!freeze"] = {
    xSplit: 0,
    ySplit: 1,
    topLeftCell: "A2",
    activePane: "bottomLeft",
    state: "frozen",
  };

  const range = XLSX.utils.decode_range(sheet["!ref"] ?? `A1:${XLSX.utils.encode_cell({ r: 0, c: definitions.length - 1 })}`);
  const headerRow = range.s.r;

  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ensureCell(sheet, headerRow, c);
    cell.s = { ...HEADER_STYLE };
  }

  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const zebra = (r - headerRow) % 2 === 1;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const index = c - range.s.c;
      const def = definitions[index];
      const cell = ensureCell(sheet, r, c);
      const existing = (cell.s as XLSX.CellStyle) || {};
      const horizontal = def.kind === "text" ? "left" : "right";
      cell.s = {
        ...existing,
        alignment: {
          vertical: "center",
          horizontal,
          wrapText: def.wrap ?? false,
        },
        ...(zebra ? { fill: ZEBRA_FILL } : {}),
      } as XLSX.CellStyle;

      switch (def.kind) {
        case "percent":
          cell.z = "0.0%";
          break;
        case "minutes":
          cell.z = '0" min"';
          break;
        case "date":
          cell.z = "mmm d, yyyy";
          break;
        case "time":
          cell.z = "hh:mm";
          break;
        default:
          break;
      }
    }
  }
};

const buildSourceFileCountMap = (rows: PerDayRow[]): Map<string, number> => {
  const map = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = getEmployeeKey(row);
    if (!key) continue;
    let files = map.get(key);
    if (!files) {
      files = new Set<string>();
      map.set(key, files);
    }
    for (const file of row.sourceFiles) {
      files.add(file);
    }
  }
  const counts = new Map<string, number>();
  for (const [key, value] of map) {
    counts.set(key, value.size);
  }
  return counts;
};

export const SUMMARY_COLUMN_GROUPS: Record<SummaryColumnGroup, { label: string }> = {
  identity: { label: "Identity" },
  attendance: { label: "Attendance (summary)" },
  audit: { label: "Audit" },
};

export const SUMMARY_COLUMN_LIST = SUMMARY_COLUMNS.map(({ key, label, description, group }) => ({
  key,
  label,
  description,
  group,
}));

export const SUMMARY_COLUMN_DEFINITIONS = SUMMARY_COLUMNS.reduce(
  (acc, column) => {
    acc[column.key] = column;
    return acc;
  },
  {} as Record<SummaryColumnKey, SummaryColumnDefinition>
);

export const DEFAULT_SUMMARY_COLUMNS: SummaryColumnKey[] = [
  "employeeId",
  "employeeName",
  "office",
  "schedule",
  "daysWithLogs",
  "lateDays",
  "undertimeDays",
  "latePercent",
  "undertimePercent",
  "lateMinutes",
  "undertimeMinutes",
];

export type ExportFilters = {
  offices: string[];
  selectedOffices: string[];
  officeLabels: string[];
  selectedOfficeLabels: string[];
  applyOfficeFilter: boolean;
};

export type ExportMetadata = {
  period: string;
  exportTime?: string;
  appVersion?: string;
};

export type ExportWorkbookParams = {
  perEmployee: PerEmployeeRow[];
  perDay: PerDayRow[];
  filters: ExportFilters;
  columns: SummaryColumnKey[];
  metadata: ExportMetadata;
  fileName?: string;
};

export function exportResultsToXlsx({
  perEmployee,
  perDay,
  filters,
  columns,
  metadata,
  fileName = "biometrics_results.xlsx",
}: ExportWorkbookParams) {
  const selectedColumns = columns
    .map((key) => SUMMARY_COLUMN_DEFINITIONS[key])
    .filter((definition): definition is SummaryColumnDefinition => Boolean(definition));

  if (!selectedColumns.length) {
    throw new Error("No valid columns selected for export.");
  }

  const sourceFileCounts = buildSourceFileCountMap(perDay);
  const summaryContext: SummaryContext = { sourceFileCounts };

  const sortedEmployees = [...perEmployee].sort((a, b) => {
    const nameDiff = (a.employeeName || "").localeCompare(b.employeeName || "");
    if (nameDiff !== 0) return nameDiff;
    return (a.employeeId || "").localeCompare(b.employeeId || "");
  });

  const summaryCells = sortedEmployees.map((row) =>
    selectedColumns.map((column) => column.getValue(row, summaryContext))
  );

  const summaryHeader = selectedColumns.map((column) => column.label);
  const summaryValues = summaryCells.map((cells, rowIndex) =>
    cells.map((cell, columnIndex) => {
      const column = selectedColumns[columnIndex];
      if (cell.value == null || cell.value === "") {
        return column.kind === "text" ? "" : null;
      }
      return cell.value;
    })
  );

  const summarySheet = XLSX.utils.aoa_to_sheet([
    summaryHeader,
    ...summaryValues,
  ]);

  const summaryDisplays = [
    summaryHeader,
    ...summaryCells.map((cells) => cells.map((cell) => cell.display ?? "")),
  ];

  setColumnWidths(summarySheet, selectedColumns, summaryDisplays);
  styleSheet(summarySheet, selectedColumns);

  const sortedPerDay = sortPerDayRows([...perDay]);
  const perDayCells = sortedPerDay.map((row) => PER_DAY_COLUMNS.map((column) => column.getValue(row)));
  const perDayHeader = PER_DAY_COLUMNS.map((column) => column.label);
  const perDayValues = perDayCells.map((cells) =>
    cells.map((cell, columnIndex) => {
      const column = PER_DAY_COLUMNS[columnIndex];
      if (cell.value == null || cell.value === "") {
        return column.kind === "text" ? "" : null;
      }
      return cell.value;
    })
  );

  const perDaySheet = XLSX.utils.aoa_to_sheet([
    perDayHeader,
    ...perDayValues,
  ]);

  const perDayDisplays = [
    perDayHeader,
    ...perDayCells.map((cells) => cells.map((cell) => cell.display ?? "")),
  ];

  setColumnWidths(perDaySheet, PER_DAY_COLUMNS, perDayDisplays);
  styleSheet(perDaySheet, PER_DAY_COLUMNS);

  const exportTime = metadata.exportTime ?? formatISO(new Date());
  const period = metadata.period || "Not specified";
  const appliedOffices = filters.applyOfficeFilter
    ? filters.officeLabels.length
      ? filters.officeLabels.join(", ")
      : "All offices"
    : filters.selectedOfficeLabels.length
    ? `All offices (on-screen: ${filters.selectedOfficeLabels.join(", ")})`
    : "All offices";
  const columnSummary = selectedColumns.map((column) => column.label).join(", ");
  const appVersion = metadata.appVersion ?? "dev";

  const metadataSheet = XLSX.utils.aoa_to_sheet([
    ["Field", "Value"],
    ["Export time", exportTime],
    ["Period", period],
    ["Applied offices", appliedOffices],
    ["Column selection", columnSummary],
    ["App version/hash", appVersion],
    ["Filter keys", filters.offices.join(", ") || "All"],
  ]);

  const metadataRange = XLSX.utils.decode_range(metadataSheet["!ref"] ?? "A1:B1");
  for (let c = metadataRange.s.c; c <= metadataRange.e.c; c++) {
    const cell = ensureCell(metadataSheet, metadataRange.s.r, c);
    cell.s = { ...HEADER_STYLE };
  }
  (metadataSheet as any)["!cols"] = [{ wch: 24 }, { wch: 72 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");
  XLSX.utils.book_append_sheet(workbook, perDaySheet, "PerDay");
  XLSX.utils.book_append_sheet(workbook, metadataSheet, "Metadata");

  XLSX.writeFile(workbook, fileName, { compression: true });
}

