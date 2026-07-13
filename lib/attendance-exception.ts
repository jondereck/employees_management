/** Annex 8-C Attendance Exception Registry — shared types and PerDay → T/U parsing. */

export const ATTENDANCE_EXCEPTION_TYPES = ["T", "U", "MD", "FD", "UA", "AWOL"] as const;
export type AttendanceExceptionTypeCode = (typeof ATTENDANCE_EXCEPTION_TYPES)[number];

export const ATTENDANCE_EXCEPTION_TYPE_LABELS: Record<AttendanceExceptionTypeCode, string> = {
  T: "Tardiness",
  U: "Undertime",
  MD: "Missing DTR / Missing Log-In or Log-Out",
  FD: "Failure to Submit DTR",
  UA: "Unauthorized Absence",
  AWOL: "Absence Without Official Leave",
};

export const ATTENDANCE_EXCEPTION_STATUSES = [
  "Open",
  "CounselingConducted",
  "MemorandumIssued",
  "Resolved",
  "ForAdministrativeAction",
] as const;
export type AttendanceExceptionStatusCode = (typeof ATTENDANCE_EXCEPTION_STATUSES)[number];

export const ATTENDANCE_EXCEPTION_STATUS_LABELS: Record<AttendanceExceptionStatusCode, string> = {
  Open: "Open",
  CounselingConducted: "Counseling Conducted",
  MemorandumIssued: "Memorandum Issued",
  Resolved: "Resolved",
  ForAdministrativeAction: "For Administrative Action",
};

export const HABITUAL_TARDINESS_LATE_DAY_THRESHOLD = 10;

export type PerDayImportRow = {
  employeeNo: string;
  employeeName: string;
  officeName: string;
  date: string; // YYYY-MM-DD
  late: boolean;
  undertime: boolean;
  lateMinutes: number;
  undertimeMinutes: number;
};

export type AutoExceptionDraft = {
  employeeNo: string;
  employeeName: string;
  officeName: string;
  /** Earliest incident date (for sorting / DB DateTime). */
  incidentDate: string; // YYYY-MM-DD
  /** All incident dates for this employee+type, sorted, comma-separated. */
  incidentDates: string;
  exceptionType: "T" | "U";
  occurrences: number;
  importKey: string;
};

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

function cellNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function truthyFlag(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = cellStr(v).toLowerCase();
  return s === "y" || s === "yes" || s === "true" || s === "1" || s === "late" || s === "undertime";
}

/** Normalize Excel date (serial, Date, or string) to YYYY-MM-DD. */
export function toIsoDateOnly(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    // Excel serial date (days since 1899-12-30)
    const epoch = Date.UTC(1899, 11, 30);
    const ms = epoch + Math.round(value) * 86400000;
    const dt = new Date(ms);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const d = String(dt.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = cellStr(value);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
}

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

type ColMap = {
  employeeNo?: number;
  employeeName?: number;
  office?: number;
  date?: number;
  lateFlag?: number;
  lateMinutes?: number;
  undertimeFlag?: number;
  undertimeMinutes?: number;
};

function mapPerDayHeaders(headers: string[]): ColMap {
  const map: ColMap = {};
  headers.forEach((h, i) => {
    const key = normHeader(h);
    if (key === "employee no" || key === "employee no." || key === "bio number" || key === "bio no") map.employeeNo = i;
    else if (key === "name" || key === "employee name") map.employeeName = i;
    else if (key === "office" || key === "office/department") map.office = i;
    else if (key === "date") map.date = i;
    else if (key === "late?" || key === "late") map.lateFlag = i;
    else if (key === "late (min)" || key === "late minutes" || key === "late (mins)") map.lateMinutes = i;
    else if (key === "undertime?" || key === "undertime" || key === "ut?") map.undertimeFlag = i;
    else if (key === "ut (min)" || key === "undertime (min)" || key === "undertime minutes") map.undertimeMinutes = i;
  });
  return map;
}

/**
 * Parse a PerDay sheet matrix into daily rows.
 * Biometrics exports often have a short title preamble above the header row —
 * we scan for the first row that looks like PerDay column headers.
 */
export function parsePerDayMatrix(matrix: unknown[][]): PerDayImportRow[] {
  if (!matrix.length) return [];

  let headerIndex = -1;
  let col: ColMap = {};
  for (let i = 0; i < Math.min(matrix.length, 30); i++) {
    const headerRow = (matrix[i] ?? []).map((c) => cellStr(c));
    const mapped = mapPerDayHeaders(headerRow);
    if (mapped.date != null && (mapped.lateFlag != null || mapped.undertimeFlag != null)) {
      headerIndex = i;
      col = mapped;
      break;
    }
  }

  if (headerIndex < 0) {
    throw new Error(
      'PerDay sheet must include Date and Late?/Undertime? columns (biometrics export format). Tip: use the monthly Summary export that has a PerDay sheet.'
    );
  }

  const out: PerDayImportRow[] = [];
  for (let r = headerIndex + 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    if (!row.some((c) => cellStr(c) !== "")) continue;
    const date = toIsoDateOnly(row[col.date!]);
    if (!date) continue;
    const lateMinutes = col.lateMinutes != null ? cellNum(row[col.lateMinutes]) : 0;
    const undertimeMinutes = col.undertimeMinutes != null ? cellNum(row[col.undertimeMinutes]) : 0;
    const late = col.lateFlag != null ? truthyFlag(row[col.lateFlag]) || lateMinutes > 0 : lateMinutes > 0;
    const undertime =
      col.undertimeFlag != null ? truthyFlag(row[col.undertimeFlag]) || undertimeMinutes > 0 : undertimeMinutes > 0;
    out.push({
      employeeNo: col.employeeNo != null ? cellStr(row[col.employeeNo]) : "",
      employeeName: col.employeeName != null ? cellStr(row[col.employeeName]) : "",
      officeName: col.office != null ? cellStr(row[col.office]) : "",
      date,
      late,
      undertime,
      lateMinutes,
      undertimeMinutes,
    });
  }
  return out;
}

export function buildReportingPeriod(dates: string[]): string {
  if (!dates.length) return "unknown";
  const sorted = [...dates].sort();
  const from = sorted[0];
  const to = sorted[sorted.length - 1];
  return from === to ? from : `${from}_to_${to}`;
}

/** One row per employee + type (not per date). */
export function buildImportKey(
  reportingPeriod: string,
  exceptionType: "T" | "U",
  employeeNo: string,
  employeeName: string
): string {
  const who = (employeeNo || employeeName || "unknown").trim().toLowerCase();
  return `auto|${reportingPeriod}|${exceptionType}|${who}`;
}

/** Display / storage helper: unique sorted dates joined with ", ". */
export function joinIncidentDates(dates: string[]): string {
  return [...new Set(dates.filter(Boolean))].sort().join(", ");
}

export function splitIncidentDates(incidentDates: string, fallbackDate?: string): string[] {
  const fromList = incidentDates
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromList.length) return [...new Set(fromList)].sort();
  return fallbackDate ? [fallbackDate] : [];
}

type GroupAcc = {
  employeeNo: string;
  employeeName: string;
  officeName: string;
  dates: Set<string>;
};

export type SummaryEmployeeRow = {
  employeeNo: string;
  employeeName: string;
  officeName: string;
  lateDays: number;
  undertimeDays: number;
};

type SummaryColMap = {
  employeeNo?: number;
  employeeName?: number;
  office?: number;
  lateDays?: number;
  undertimeDays?: number;
};

function mapSummaryHeaders(headers: string[]): SummaryColMap {
  const map: SummaryColMap = {};
  headers.forEach((h, i) => {
    const key = normHeader(h);
    if (key === "employee no" || key === "employee no." || key === "bio number" || key === "bio no") {
      map.employeeNo = i;
    } else if (key === "name" || key === "employee name") map.employeeName = i;
    else if (key === "office" || key === "office/department") map.office = i;
    else if (key === "late (days)" || key === "late days") map.lateDays = i;
    else if (key === "ut (days)" || key === "undertime (days)" || key === "ut days" || key === "undertime days") {
      map.undertimeDays = i;
    }
  });
  return map;
}

/** Normalize bio / employee no for matching (trim; keep digits as-is aside from whitespace). */
export function normalizeBioNo(value: string): string {
  return String(value ?? "").trim().replace(/\s+/g, "");
}

/**
 * Parse the biometrics Summary sheet into the filtered employee list (by Employee No / bio).
 * Scans for a header row with Employee No + Name (title preamble above is ignored).
 */
export function parseSummaryMatrix(matrix: unknown[][]): SummaryEmployeeRow[] {
  if (!matrix.length) return [];

  let headerIndex = -1;
  let col: SummaryColMap = {};
  for (let i = 0; i < Math.min(matrix.length, 30); i++) {
    const headerRow = (matrix[i] ?? []).map((c) => cellStr(c));
    const mapped = mapSummaryHeaders(headerRow);
    if (mapped.employeeNo != null && mapped.employeeName != null) {
      headerIndex = i;
      col = mapped;
      break;
    }
  }

  if (headerIndex < 0) {
    throw new Error(
      'Summary sheet must include Employee No and Name columns (monthly biometrics Summary export).'
    );
  }

  const out: SummaryEmployeeRow[] = [];
  const seen = new Set<string>();
  for (let r = headerIndex + 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    if (!row.some((c) => cellStr(c) !== "")) continue;
    const employeeNo = normalizeBioNo(cellStr(row[col.employeeNo!]));
    if (!employeeNo) continue;
    const key = employeeNo.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      employeeNo,
      employeeName: col.employeeName != null ? cellStr(row[col.employeeName]) : "",
      officeName: col.office != null ? cellStr(row[col.office]) : "",
      lateDays: col.lateDays != null ? cellNum(row[col.lateDays]) : 0,
      undertimeDays: col.undertimeDays != null ? cellNum(row[col.undertimeDays]) : 0,
    });
  }
  return out;
}

/** Collapse PerDay rows into one auto draft per employee + T/U (dates listed together). */
export function perDayToAutoExceptionDrafts(
  rows: PerDayImportRow[],
  options?: {
    /** Only include these bio / employee numbers (from Summary sheet). */
    allowedEmployeeNos?: Set<string> | string[];
    /** Prefer name/office from Summary when bio matches. */
    summaryByBio?: Map<string, Pick<SummaryEmployeeRow, "employeeName" | "officeName">>;
  }
): {
  reportingPeriod: string;
  drafts: AutoExceptionDraft[];
} {
  const allowed = options?.allowedEmployeeNos
    ? new Set(
        [...options.allowedEmployeeNos].map((n) => normalizeBioNo(String(n)).toLowerCase()).filter(Boolean)
      )
    : null;
  const summaryByBio = options?.summaryByBio;

  const scoped = allowed
    ? rows.filter((r) => {
        const bio = normalizeBioNo(r.employeeNo).toLowerCase();
        return bio && allowed.has(bio);
      })
    : rows;

  const allDates = scoped.map((r) => r.date);
  const reportingPeriod = buildReportingPeriod(allDates.length ? allDates : rows.map((r) => r.date));

  const tardy = new Map<string, GroupAcc>();
  const undertime = new Map<string, GroupAcc>();

  const personKey = (employeeNo: string, employeeName: string) =>
    (normalizeBioNo(employeeNo) || employeeName || "unknown").trim().toLowerCase();

  for (const row of scoped) {
    const key = personKey(row.employeeNo, row.employeeName);
    if (row.late) {
      if (!tardy.has(key)) {
        tardy.set(key, {
          employeeNo: row.employeeNo,
          employeeName: row.employeeName,
          officeName: row.officeName,
          dates: new Set(),
        });
      }
      const g = tardy.get(key)!;
      g.dates.add(row.date);
      if (!g.employeeName && row.employeeName) g.employeeName = row.employeeName;
      if (!g.officeName && row.officeName) g.officeName = row.officeName;
      if (!g.employeeNo && row.employeeNo) g.employeeNo = row.employeeNo;
    }
    if (row.undertime) {
      if (!undertime.has(key)) {
        undertime.set(key, {
          employeeNo: row.employeeNo,
          employeeName: row.employeeName,
          officeName: row.officeName,
          dates: new Set(),
        });
      }
      const g = undertime.get(key)!;
      g.dates.add(row.date);
      if (!g.employeeName && row.employeeName) g.employeeName = row.employeeName;
      if (!g.officeName && row.officeName) g.officeName = row.officeName;
      if (!g.employeeNo && row.employeeNo) g.employeeNo = row.employeeNo;
    }
  }

  const applySummaryIdentity = (g: GroupAcc) => {
    const bio = normalizeBioNo(g.employeeNo).toLowerCase();
    const fromSummary = bio && summaryByBio ? summaryByBio.get(bio) : undefined;
    if (fromSummary) {
      if (fromSummary.employeeName) g.employeeName = fromSummary.employeeName;
      if (fromSummary.officeName) g.officeName = fromSummary.officeName;
    }
  };

  const toDrafts = (map: Map<string, GroupAcc>, exceptionType: "T" | "U"): AutoExceptionDraft[] =>
    Array.from(map.values()).map((g) => {
      applySummaryIdentity(g);
      const sorted = [...g.dates].sort();
      return {
        employeeNo: g.employeeNo,
        employeeName: g.employeeName,
        officeName: g.officeName,
        incidentDate: sorted[0],
        incidentDates: joinIncidentDates(sorted),
        exceptionType,
        occurrences: sorted.length,
        importKey: buildImportKey(reportingPeriod, exceptionType, g.employeeNo, g.employeeName),
      };
    });

  const drafts = [...toDrafts(tardy, "T"), ...toDrafts(undertime, "U")].sort(
    (a, b) => a.employeeName.localeCompare(b.employeeName) || a.exceptionType.localeCompare(b.exceptionType)
  );

  return { reportingPeriod, drafts };
}

/**
 * Regroup any T/U drafts (even legacy per-date rows) into one row per employee + type.
 * Safe to run on the server so import never depends on client bundle freshness.
 */
export function consolidateAutoExceptionDrafts(
  drafts: Array<{
    employeeNo: string;
    employeeName: string;
    officeName: string;
    incidentDate: string;
    incidentDates?: string;
    exceptionType: "T" | "U";
    occurrences?: number;
  }>,
  reportingPeriod: string
): AutoExceptionDraft[] {
  const tardy = new Map<string, GroupAcc>();
  const undertime = new Map<string, GroupAcc>();

  const personKey = (employeeNo: string, employeeName: string) =>
    (employeeNo || employeeName || "unknown").trim().toLowerCase();

  const touch = (map: Map<string, GroupAcc>, draft: (typeof drafts)[number], dates: string[]) => {
    const key = personKey(draft.employeeNo, draft.employeeName);
    if (!map.has(key)) {
      map.set(key, {
        employeeNo: draft.employeeNo,
        employeeName: draft.employeeName,
        officeName: draft.officeName,
        dates: new Set(),
      });
    }
    const g = map.get(key)!;
    for (const d of dates) g.dates.add(d);
    if (!g.employeeName && draft.employeeName) g.employeeName = draft.employeeName;
    if (!g.officeName && draft.officeName) g.officeName = draft.officeName;
    if (!g.employeeNo && draft.employeeNo) g.employeeNo = draft.employeeNo;
  };

  for (const draft of drafts) {
    const dates = splitIncidentDates(draft.incidentDates ?? "", draft.incidentDate);
    if (!dates.length) continue;
    if (draft.exceptionType === "T") touch(tardy, draft, dates);
    else touch(undertime, draft, dates);
  }

  const toDrafts = (map: Map<string, GroupAcc>, exceptionType: "T" | "U"): AutoExceptionDraft[] =>
    Array.from(map.values()).map((g) => {
      const sorted = [...g.dates].sort();
      return {
        employeeNo: g.employeeNo,
        employeeName: g.employeeName,
        officeName: g.officeName,
        incidentDate: sorted[0],
        incidentDates: joinIncidentDates(sorted),
        exceptionType,
        occurrences: sorted.length,
        importKey: buildImportKey(reportingPeriod, exceptionType, g.employeeNo, g.employeeName),
      };
    });

  return [...toDrafts(tardy, "T"), ...toDrafts(undertime, "U")].sort(
    (a, b) => a.employeeName.localeCompare(b.employeeName) || a.exceptionType.localeCompare(b.exceptionType)
  );
}

export type ExceptionSummaryInput = {
  employeeName: string;
  employeeNo: string;
  exceptionType: AttendanceExceptionTypeCode;
  incidentDate: string;
  incidentDates?: string;
  occurrences?: number;
};

export function buildAnnex8cSummary(
  rows: ExceptionSummaryInput[],
  habitualThreshold = HABITUAL_TARDINESS_LATE_DAY_THRESHOLD
) {
  const employees = new Set(rows.map((r) => (r.employeeNo || r.employeeName).toLowerCase()));
  const sumType = (t: AttendanceExceptionTypeCode) =>
    rows
      .filter((r) => r.exceptionType === t)
      .reduce((sum, r) => {
        const dates = splitIncidentDates(r.incidentDates ?? "", r.incidentDate);
        if (dates.length > 1) return sum + dates.length;
        return sum + (r.occurrences && r.occurrences > 0 ? r.occurrences : 1);
      }, 0);

  const lateDaysByEmployee = new Map<string, Set<string>>();
  for (const r of rows) {
    if (r.exceptionType !== "T") continue;
    const key = (r.employeeNo || r.employeeName).toLowerCase();
    if (!lateDaysByEmployee.has(key)) lateDaysByEmployee.set(key, new Set());
    for (const d of splitIncidentDates(r.incidentDates ?? "", r.incidentDate)) {
      lateDaysByEmployee.get(key)!.add(d);
    }
  }
  let habitualTardinessCases = 0;
  for (const days of lateDaysByEmployee.values()) {
    if (days.size >= habitualThreshold) habitualTardinessCases += 1;
  }

  return {
    employeesWithExceptions: employees.size,
    tardinessIncidents: sumType("T"),
    undertimeIncidents: sumType("U"),
    missingDtrIncidents: sumType("MD"),
    unauthorizedAbsences: sumType("UA"),
    awolCases: sumType("AWOL"),
    failureToSubmitDtr: sumType("FD"),
    habitualTardinessCases,
    habitualThreshold,
  };
}
