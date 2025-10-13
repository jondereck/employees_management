import * as XLSX from "xlsx";
import { aggregateEmployee } from "./compute";
import { EmployeeLite, EmployeeMatch, OfficeLite, Schedule } from "./types";
import { sanitizeSheetName, uniqueSheetName } from "@/utils/download-excel";

const buildNameMap = (employees: EmployeeLite[]) => new Map(employees.map((e) => [e.id, e]));

const buildOfficeMap = (offices: OfficeLite[]) => new Map(offices.map((o) => [o.id, o.name]));

type ExportGranularity = "summary" | "detail";
type ExportFormat = "xlsx" | "csv";

type SummaryRow = {
  No: number;
  Employee: string;
  Office: string;
  "Days Present": number;
  "Tardy (count)": number;
  "Tardy (mins)": number;
  "Undertime (count)": number;
  "Undertime (mins)": number;
  Exceptions: number;
};

type DetailRow = {
  No: number;
  Date: string;
  Employee: string;
  Office: string;
  "First IN"?: string;
  "Last OUT"?: string;
  "Tardy (mins)": number;
  "Undertime (mins)": number;
  Exception?: string;
};

const composeName = (name: string) => name.trim() || "Unnamed";

const formatEmployeeName = (employee: EmployeeLite | undefined) => {
  if (!employee) return "Unknown";
  return composeName(employee.name);
};

const groupSummaryRows = (
  matches: EmployeeMatch[],
  schedule: Schedule,
  employees: Map<string, EmployeeLite>,
  officeNames: Map<string, string>
) => {
  const groups = new Map<string, SummaryRow[]>();

  matches.forEach((match) => {
    const employee = employees.get(match.employeeId);
    const officeName = officeNames.get(match.officeId) ?? "Unassigned";
    const { summary } = aggregateEmployee(match, schedule);

    const row: SummaryRow = {
      No: 0,
      Employee: formatEmployeeName(employee),
      Office: officeName,
      "Days Present": summary.present,
      "Tardy (count)": summary.tardyCount,
      "Tardy (mins)": summary.tardyMin,
      "Undertime (count)": summary.underCount,
      "Undertime (mins)": summary.underMin,
      Exceptions: summary.exceptions,
    };

    const collection = groups.get(match.officeId) ?? [];
    collection.push(row);
    groups.set(match.officeId, collection);
  });

  groups.forEach((rows) => {
    rows.sort((a, b) => a.Employee.localeCompare(b.Employee));
    rows.forEach((row, index) => {
      row.No = index + 1;
    });
  });

  return groups;
};

const groupDetailRows = (
  matches: EmployeeMatch[],
  schedule: Schedule,
  employees: Map<string, EmployeeLite>,
  officeNames: Map<string, string>
) => {
  const groups = new Map<string, DetailRow[]>();

  matches.forEach((match) => {
    const employee = employees.get(match.employeeId);
    const officeName = officeNames.get(match.officeId) ?? "Unassigned";
    const { detail } = aggregateEmployee(match, schedule);

    detail.forEach((day) => {
      const row: DetailRow = {
        No: 0,
        Date: day.date,
        Employee: formatEmployeeName(employee),
        Office: officeName,
        "First IN": day.firstIn,
        "Last OUT": day.lastOut,
        "Tardy (mins)": day.tardyMin,
        "Undertime (mins)": day.underMin,
        Exception: day.exception,
      };

      const collection = groups.get(match.officeId) ?? [];
      collection.push(row);
      groups.set(match.officeId, collection);
    });
  });

  groups.forEach((rows) => {
    rows.sort((a, b) => a.Date.localeCompare(b.Date) || a.Employee.localeCompare(b.Employee));
    rows.forEach((row, index) => {
      row.No = index + 1;
    });
  });

  return groups;
};

function buildXlsxFromGroups(
  groups: Map<string, SummaryRow[] | DetailRow[]>,
  officeNames: Map<string, string>,
  granularity: ExportGranularity
) {
  const workbook = XLSX.utils.book_new();
  const taken = new Set<string>();

  groups.forEach((rows, officeId) => {
    const officeName = officeNames.get(officeId) ?? "Unassigned";
    const sheetName = uniqueSheetName(sanitizeSheetName(officeName || "Office"), taken);
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const titleRow = [[granularity === "summary" ? `Summary - ${officeName}` : `Detail - ${officeName}`]];
    const header = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 });
    const body = header.slice(1);
    const finalSheet = XLSX.utils.aoa_to_sheet([...titleRow, [], header[0], ...body]);
    XLSX.utils.book_append_sheet(workbook, finalSheet, sheetName);
  });

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return buffer;
}

function buildCsvFromGroups(
  groups: Map<string, SummaryRow[] | DetailRow[]>,
  officeNames: Map<string, string>,
  granularity: ExportGranularity
) {
  const lines: string[] = [];
  groups.forEach((rows, officeId) => {
    const officeName = officeNames.get(officeId) ?? "Unassigned";
    lines.push(`${granularity === "summary" ? "Summary" : "Detail"} - ${officeName}`);
    lines.push("");
    if (!rows.length) {
      lines.push("No data");
      lines.push("");
      return;
    }
    const header = Object.keys(rows[0]);
    lines.push(header.join(","));
    rows.forEach((row) => {
      const values = header.map((key) => {
        const value = (row as Record<string, unknown>)[key];
        if (value == null) return "";
        const str = String(value);
        if (str.includes(",") || str.includes("\n") || str.includes("\"")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      lines.push(values.join(","));
    });
    lines.push("");
  });

  return Buffer.from(lines.join("\n"), "utf-8");
}

export function buildExportFile(options: {
  matches: EmployeeMatch[];
  schedule: Schedule;
  employees: EmployeeLite[];
  offices: OfficeLite[];
  granularity: ExportGranularity;
  format: ExportFormat;
}) {
  const { matches, schedule, employees, offices, granularity, format } = options;

  const employeeMap = buildNameMap(employees);
  const officeMap = buildOfficeMap(offices);

  const grouped =
    granularity === "summary"
      ? groupSummaryRows(matches, schedule, employeeMap, officeMap)
      : groupDetailRows(matches, schedule, employeeMap, officeMap);

  const buffer =
    format === "xlsx"
      ? buildXlsxFromGroups(grouped, officeMap, granularity)
      : buildCsvFromGroups(grouped, officeMap, granularity);

  const contentType = format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv";

  return { buffer, contentType };
}
