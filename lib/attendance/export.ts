import * as XLSX from "xlsx";
import { aggregateEmployee } from "./compute";
import {
  AttendanceEmployeeInfo,
  EmployeeMatch,
  Schedule,
} from "./types";
import { sanitizeSheetName, uniqueSheetName } from "@/utils/download-excel";
import { UNASSIGNED_OFFICE_KEY } from "./types";

type OfficeDirectory = Map<string | null, { id: string | null; name: string }>;

type SummaryRow = {
  officeId: string | null;
  employeeId: string;
  employee: string;
  office: string;
  daysPresent: number;
  tardyCount: number;
  tardyMinutes: number;
  underCount: number;
  underMinutes: number;
  exceptions: number;
};

type DetailRow = {
  officeId: string | null;
  employeeId: string;
  employee: string;
  office: string;
  date: string;
  firstIn: string;
  lastOut: string;
  tardyMinutes: number;
  underMinutes: number;
  exception: string;
};

function buildDirectories(
  employees: AttendanceEmployeeInfo[],
  offices: { id: string; name: string }[]
) {
  const officeDir: OfficeDirectory = new Map();
  officeDir.set(null, { id: null, name: "Unassigned" });
  for (const office of offices) {
    officeDir.set(office.id, { id: office.id, name: office.name });
  }

  const employeeDir = new Map(
    employees.map((employee) => [employee.id, employee])
  );

  return { officeDir, employeeDir };
}

export function buildSummaryAndDetail({
  matches,
  schedule,
  employees,
  offices,
  officeFilter,
}: {
  matches: EmployeeMatch[];
  schedule: Schedule;
  employees: AttendanceEmployeeInfo[];
  offices: { id: string; name: string }[];
  officeFilter?: string[];
}) {
  const { officeDir, employeeDir } = buildDirectories(employees, offices);
  const allowedOffices = officeFilter?.length ? new Set(officeFilter) : null;

  const summary: SummaryRow[] = [];
  const detail: DetailRow[] = [];

  for (const match of matches) {
    const employee = employeeDir.get(match.employeeId);
    if (!employee) continue;
    const officeMeta = officeDir.get(employee.officeId ?? match.officeId ?? null);
    const officeName = officeMeta?.name ?? "Unassigned";
    const officeId = officeMeta?.id ?? null;

    if (allowedOffices) {
      const key = officeId ?? UNASSIGNED_OFFICE_KEY;
      if (!allowedOffices.has(key)) {
        continue;
      }
    }

    const { summary: employeeSummary, detail: employeeDetail } = aggregateEmployee(
      match,
      schedule
    );

    summary.push({
      officeId,
      employeeId: match.employeeId,
      employee: employee.name,
      office: officeName,
      daysPresent: employeeSummary.present,
      tardyCount: employeeSummary.tardyCount,
      tardyMinutes: employeeSummary.tardyMin,
      underCount: employeeSummary.underCount,
      underMinutes: employeeSummary.underMin,
      exceptions: employeeSummary.exceptions,
    });

    for (const day of employeeDetail) {
      detail.push({
        officeId,
        employeeId: match.employeeId,
        employee: employee.name,
        office: officeName,
        date: day.date,
        firstIn: day.firstIn ?? "",
        lastOut: day.lastOut ?? "",
        tardyMinutes: day.tardyMin,
        underMinutes: day.underMin,
        exception: day.exception ?? "",
      });
    }
  }

  summary.sort((a, b) => a.office.localeCompare(b.office) || a.employee.localeCompare(b.employee));
  detail.sort((a, b) => a.date.localeCompare(b.date) || a.employee.localeCompare(b.employee));

  return { summary, detail, officeDir };
}

function sheetTitle(name: string, granularity: "summary" | "detail") {
  return granularity === "summary"
    ? `${name} — Summary`
    : `${name} — Detail`;
}

export function buildWorkbook({
  summary,
  detail,
  officeDir,
  granularity,
}: {
  summary: SummaryRow[];
  detail: DetailRow[];
  officeDir: OfficeDirectory;
  granularity: "summary" | "detail";
}) {
  const workbook = XLSX.utils.book_new();
  const data = granularity === "summary" ? summary : detail;
  const grouped = new Map<string | null, (SummaryRow | DetailRow)[]>();
  for (const row of data) {
    const key = row.officeId ?? null;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(row);
  }

  const takenNames = new Set<string>();

  for (const [officeId, rows] of grouped.entries()) {
    const officeName = officeDir.get(officeId)?.name ?? "Unassigned";
    const title = sheetTitle(officeName, granularity);
    const sheetRows: (string | number)[][] = [];
    sheetRows.push([title]);
    sheetRows.push([]);

    if (granularity === "summary") {
      sheetRows.push([
        "No.",
        "Employee",
        "Office",
        "Days Present",
        "Tardy (count)",
        "Tardy (mins)",
        "Undertime (count)",
        "Undertime (mins)",
        "Exceptions",
      ]);
      rows.forEach((row, index) => {
        const summaryRow = row as SummaryRow;
        sheetRows.push([
          index + 1,
          summaryRow.employee,
          summaryRow.office,
          summaryRow.daysPresent,
          summaryRow.tardyCount,
          summaryRow.tardyMinutes,
          summaryRow.underCount,
          summaryRow.underMinutes,
          summaryRow.exceptions,
        ]);
      });
    } else {
      sheetRows.push([
        "No.",
        "Date",
        "Employee",
        "Office",
        "First IN",
        "Last OUT",
        "Tardy (mins)",
        "Undertime (mins)",
        "Exception",
      ]);
      rows.forEach((row, index) => {
        const detailRow = row as DetailRow;
        sheetRows.push([
          index + 1,
          detailRow.date,
          detailRow.employee,
          detailRow.office,
          detailRow.firstIn,
          detailRow.lastOut,
          detailRow.tardyMinutes,
          detailRow.underMinutes,
          detailRow.exception,
        ]);
      });
    }

    const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
    const safeName = uniqueSheetName(
      sanitizeSheetName(officeName.slice(0, 31) || "Sheet"),
      takenNames
    );
    XLSX.utils.book_append_sheet(workbook, worksheet, safeName);
  }

  return workbook;
}

const escapeCsv = (value: string | number) => {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes("\n") || str.includes("\"")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export function buildCsv({
  summary,
  detail,
  officeDir,
  granularity,
}: {
  summary: SummaryRow[];
  detail: DetailRow[];
  officeDir: OfficeDirectory;
  granularity: "summary" | "detail";
}) {
  const rows: (string | number)[][] = [];
  if (granularity === "summary") {
    rows.push([
      "Office",
      "No.",
      "Employee",
      "Days Present",
      "Tardy (count)",
      "Tardy (mins)",
      "Undertime (count)",
      "Undertime (mins)",
      "Exceptions",
    ]);
    const grouped = new Map<string | null, SummaryRow[]>();
    for (const row of summary) {
      const key = row.officeId ?? null;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    }
    for (const [officeId, officeRows] of grouped.entries()) {
      const officeName = officeDir.get(officeId)?.name ?? "Unassigned";
      officeRows.forEach((row, index) => {
        rows.push([
          officeName,
          index + 1,
          row.employee,
          row.daysPresent,
          row.tardyCount,
          row.tardyMinutes,
          row.underCount,
          row.underMinutes,
          row.exceptions,
        ]);
      });
    }
  } else {
    rows.push([
      "Office",
      "No.",
      "Date",
      "Employee",
      "First IN",
      "Last OUT",
      "Tardy (mins)",
      "Undertime (mins)",
      "Exception",
    ]);
    const grouped = new Map<string | null, DetailRow[]>();
    for (const row of detail) {
      const key = row.officeId ?? null;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    }
    for (const [officeId, officeRows] of grouped.entries()) {
      const officeName = officeDir.get(officeId)?.name ?? "Unassigned";
      officeRows.forEach((row, index) => {
        rows.push([
          officeName,
          index + 1,
          row.date,
          row.employee,
          row.firstIn,
          row.lastOut,
          row.tardyMinutes,
          row.underMinutes,
          row.exception,
        ]);
      });
    }
  }

  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}
