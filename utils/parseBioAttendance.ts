import * as XLSX from "xlsx";

import { firstEmployeeNoToken } from "@/lib/employeeNo";

export type ParsedPerDayRow = {
  employeeId: string;
  employeeName: string;
  day: number;
  earliest: string | null;
  latest: string | null;
  allTimes: string[];
};

export type PerDayRow = ParsedPerDayRow & {
  isLate: boolean;
  isUndertime: boolean;
  workedHHMM?: string | null;
  scheduleType?: string;
  scheduleSource?: string;
};

export type PerEmployeeRow = {
  employeeId: string;
  employeeName: string;
  daysWithLogs: number;
  lateDays: number;
  undertimeDays: number;
  lateRate: number;
  undertimeRate: number;
  scheduleTypes?: string[];
  scheduleSource?: string;
};

export type ParseWarningType = "date" | "time" | "structure" | "employee" | "merge";

export type ParseWarning = {
  type: ParseWarningType;
  message: string;
  count: number;
  examples: string[];
};

export type CanonicalPunch = {
  employeeId: string;
  employeeToken: string;
  employeeName: string;
  originalEmployeeId: string;
  originalEmployeeName: string;
  dateISO: string;
  month: string;
  day: number;
  time: string;
  rawTime: string;
  sourceFile: string;
  sheetName: string;
};

export type WorkbookParseOptions = {
  fileName: string;
  workbookType: "xls" | "xlsx";
  yieldEvery?: number;
};

export type WorkbookParseResult = {
  rows: CanonicalPunch[];
  warnings: ParseWarning[];
  normalizedXlsx?: ArrayBuffer;
  months: string[];
  sheetsParsed: number;
};

export type MergeInput = {
  fileName: string;
  rows: CanonicalPunch[];
};

export type MergedPunch = CanonicalPunch & {
  sourceFiles: string[];
  sourceSheets: string[];
  origin: "single" | "merged";
};

export type MergedPerDayRow = ParsedPerDayRow & {
  dateISO: string;
  month: string;
  sourceFiles: string[];
  origin: "single" | "merged";
};

export type MergeSummary = {
  punches: MergedPunch[];
  perDay: MergedPerDayRow[];
  warnings: ParseWarning[];
  totalPunches: number;
  uniqueEmployees: number;
  months: string[];
  dateRange: { from?: string; to?: string };
};

const DEFAULT_YIELD_EVERY = 750;

class WarningCollector {
  private readonly map = new Map<string, ParseWarning>();

  add(type: ParseWarningType, message: string, example?: string) {
    const key = `${type}|${message}`;
    const existing = this.map.get(key);
    if (!existing) {
      this.map.set(key, {
        type,
        message,
        count: 1,
        examples: example ? [example] : [],
      });
      return;
    }

    existing.count += 1;
    if (example) {
      const trimmed = example.trim();
      if (trimmed && existing.examples.length < 10 && !existing.examples.includes(trimmed)) {
        existing.examples.push(trimmed);
      }
    }
  }

  toArray(): ParseWarning[] {
    return Array.from(this.map.values()).map((entry) => ({
      type: entry.type,
      message: entry.message,
      count: entry.count,
      examples: [...entry.examples],
    }));
  }
}

const MONTH_NAMES: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const pad2 = (value: number) => String(value).padStart(2, "0");

const toCleanString = (value: unknown) => String(value ?? "").trim();

const normalizeName = (value: string | null | undefined) =>
  toCleanString(value).replace(/\s+/g, " ");

const normalizeId = (value: string | null | undefined) => toCleanString(value);

const yieldToEventLoop = () => new Promise((resolve) => setTimeout(resolve, 0));

const isHeaderRow = (row: any[]): boolean => {
  const col1 = toCleanString(row?.[1]);
  const col2 = toCleanString(row?.[2]);
  const col3 = toCleanString(row?.[3]);
  return col1 === "1" && col2 === "2" && col3 === "3";
};

type Meta = {
  employeeId: string;
  employeeName: string;
};

const nearestMeta = (rows: any[][], headerRowIdx: number): Meta => {
  let employeeId = "";
  let employeeName = "";
  for (let r = headerRowIdx - 1; r >= 0; r--) {
    const row = rows[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      const cell = toCleanString(row[c]);
      if (!employeeId && cell === "User ID:" && row[c + 1] != null) {
        const raw = normalizeId(row[c + 1] as string);
        if (raw && raw.toLowerCase() !== "nan") {
          employeeId = raw;
        }
      }
      if (!employeeName && cell === "Name:" && row[c + 1] != null) {
        const raw = normalizeName(row[c + 1] as string);
        if (raw && raw.toLowerCase() !== "nan") {
          employeeName = raw;
        }
      }
    }
    if (employeeId && employeeName) break;
  }
  return { employeeId, employeeName };
};

type NormalizedTime = {
  hhmm: string;
  raw: string;
};

const extractTimes = (raw: unknown): NormalizedTime[] => {
  const text = toCleanString(raw);
  if (!text || text.toLowerCase() === "nan") return [];

  const matches: NormalizedTime[] = [];
  const timeRegex = /(\d{1,2})(?::(\d{1,2}))(?::(\d{1,2}))?\s*(AM|PM)?/gi;
  let match: RegExpExecArray | null;

  while ((match = timeRegex.exec(text))) {
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    const second = match[3] ? Number(match[3]) : 0;
    const meridiem = match[4]?.toUpperCase();

    if (!Number.isFinite(hour) || !Number.isFinite(minute)) continue;
    if (hour < 0 || hour > 23) continue;
    if (minute < 0 || minute > 59) continue;
    if (second < 0 || second > 59) continue;

    let normalizedHour = hour;
    if (meridiem === "AM" && normalizedHour === 12) normalizedHour = 0;
    if (meridiem === "PM" && normalizedHour < 12) normalizedHour += 12;

    const hhmm = `${pad2(normalizedHour)}:${pad2(minute)}`;
    matches.push({ hhmm, raw: match[0] });
  }

  return matches;
};

const parseMonthFromText = (text: string): string | null => {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  const isoMatch = normalized.match(/(\d{4})[\/-](\d{1,2})/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    if (year >= 1900 && month >= 1 && month <= 12) {
      return `${isoMatch[1]}-${pad2(month)}`;
    }
  }

  const monthFirst = normalized.match(/(\d{1,2})[\/-](\d{4})/);
  if (monthFirst) {
    const month = Number(monthFirst[1]);
    const year = Number(monthFirst[2]);
    if (year >= 1900 && month >= 1 && month <= 12) {
      return `${monthFirst[2]}-${pad2(month)}`;
    }
  }

  const monthNameRegex = /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b/i;
  const nameMatch = normalized.match(monthNameRegex);

  if (nameMatch) {
    const monthName = nameMatch[1]?.toLowerCase();
    const monthNumber = monthName ? MONTH_NAMES[monthName] : undefined;
    if (monthNumber) {
      const yearMatch = normalized.match(/(19|20)\d{2}/);
      if (yearMatch) {
        return `${yearMatch[0]}-${pad2(monthNumber)}`;
      }
    }
  }

  return null;
};

const inferMonth = (
  rows: any[][],
  headerRowIdx: number,
  sheetName: string,
  fileName: string
): { month: string | null; context?: string } => {
  const maxLookback = Math.max(0, headerRowIdx - 12);
  for (let r = headerRowIdx; r >= maxLookback; r--) {
    const row = rows[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      const cell = toCleanString(row[c]);
      if (!cell) continue;
      const candidate = parseMonthFromText(cell);
      if (candidate) {
        return { month: candidate, context: `${fileName} → ${sheetName} row ${r + 1}` };
      }
    }
  }

  const sheetCandidate = parseMonthFromText(sheetName);
  if (sheetCandidate) {
    return { month: sheetCandidate, context: `${fileName} → ${sheetName}` };
  }

  const fileCandidate = parseMonthFromText(fileName);
  if (fileCandidate) {
    return { month: fileCandidate, context: fileName };
  }

  return { month: null };
};

export async function parseBioAttendance(
  arrayBuffer: ArrayBuffer,
  options: WorkbookParseOptions
): Promise<WorkbookParseResult> {
  const { fileName, workbookType, yieldEvery = DEFAULT_YIELD_EVERY } = options;

  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const normalizedXlsx =
    workbookType === "xls" ? (XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer) : undefined;

  const warnings = new WarningCollector();
  const rows: CanonicalPunch[] = [];
  const months = new Set<string>();
  let sheetsParsed = 0;
  let processedCells = 0;

  const maybeYield = async () => {
    if (yieldEvery <= 0) return;
    processedCells += 1;
    if (processedCells % yieldEvery === 0) {
      await yieldToEventLoop();
    }
  };

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const matrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
    let hasHeader = false;

    for (let r = 0; r < matrix.length; r++) {
      const header = matrix[r] ?? [];
      if (!isHeaderRow(header)) continue;
      hasHeader = true;

      const { month, context } = inferMonth(matrix, r, sheetName, fileName);
      if (!month) {
        warnings.add(
          "date",
          `Unable to infer month for sheet "${sheetName}" in ${fileName}. These rows were skipped.`,
          context ?? `${fileName} → ${sheetName}`
        );
        continue;
      }
      months.add(month);

      const dayColumns: { index: number; day: number }[] = [];
      for (let d = 1; d < header.length; d++) {
        const value = toCleanString(header[d]);
        if (!value) break;
        const day = Number(value);
        if (!Number.isFinite(day)) break;
        dayColumns.push({ index: d, day });
      }

      if (!dayColumns.length) {
        warnings.add(
          "structure",
          `No day columns detected for header row in sheet "${sheetName}" (file ${fileName}).`,
          `${fileName} → ${sheetName} row ${r + 1}`
        );
        continue;
      }

      const { employeeId: rawEmployeeId, employeeName: rawEmployeeName } = nearestMeta(matrix, r);
      const originalEmployeeId = normalizeId(rawEmployeeId);
      const token = firstEmployeeNoToken(originalEmployeeId);
      const originalEmployeeName = normalizeName(rawEmployeeName);
      const employeeName = originalEmployeeName || "Unknown";

      if (!token) {
        warnings.add(
          "employee",
          `Skipped entries without a valid employee number near row ${r + 1} in sheet "${sheetName}".`,
          `${fileName} → ${sheetName} row ${r + 1}`
        );
        continue;
      }

      for (let rr = r + 1; rr < matrix.length; rr++) {
        const row = matrix[rr] ?? [];
        const sentinel = row.some((cell) => toCleanString(cell) === "User ID:");
        if (isHeaderRow(row) || sentinel) break;

        for (const { index, day } of dayColumns) {
          const cell = row[index];
          const times = extractTimes(cell);

          if (!times.length && cell != null && toCleanString(cell)) {
            warnings.add(
              "time",
              `Unrecognized time format in ${fileName} (${sheetName}).`,
              String(cell)
            );
          }

          for (const time of times) {
            const dateISO = `${month}-${pad2(day)}`;
            rows.push({
              employeeId: token,
              employeeToken: token,
              employeeName,
              originalEmployeeId,
              originalEmployeeName,
              dateISO,
              month,
              day,
              time: time.hhmm,
              rawTime: time.raw,
              sourceFile: fileName,
              sheetName,
            });
          }

          if (times.length) {
            await maybeYield();
          }
        }
      }
    }

    if (hasHeader) {
      sheetsParsed += 1;
    }
  }

  return {
    rows,
    warnings: warnings.toArray(),
    normalizedXlsx,
    months: Array.from(months),
    sheetsParsed,
  };
}

export function mergeParsedRows(files: MergeInput[]): MergeSummary {
  const dedupMap = new Map<string, MergedPunch>();
  let dedupCount = 0;

  for (const file of files) {
    for (const row of file.rows) {
      const key = `${row.employeeId}||${row.dateISO}||${row.time}`;
      const existing = dedupMap.get(key);
      if (existing) {
        dedupCount += 1;
        if (!existing.sourceFiles.includes(row.sourceFile)) {
          existing.sourceFiles.push(row.sourceFile);
        }
        if (!existing.sourceSheets.includes(row.sheetName)) {
          existing.sourceSheets.push(row.sheetName);
        }
        existing.rawTime = row.rawTime;
        existing.origin = "merged";
      } else {
        dedupMap.set(key, {
          ...row,
          sourceFiles: [row.sourceFile],
          sourceSheets: [row.sheetName],
          origin: "single",
        });
      }
    }
  }

  const punches = Array.from(dedupMap.values()).sort((a, b) => {
    if (a.employeeId !== b.employeeId) return a.employeeId.localeCompare(b.employeeId);
    if (a.dateISO !== b.dateISO) return a.dateISO.localeCompare(b.dateISO);
    return a.time.localeCompare(b.time);
  });

  const perDayAccumulator = new Map<
    string,
    {
      employeeId: string;
      employeeName: string;
      day: number;
      dateISO: string;
      month: string;
      earliest: string | null;
      latest: string | null;
      times: string[];
      sourceFiles: Set<string>;
      origin: "single" | "merged";
    }
  >();

  for (const punch of punches) {
    const key = `${punch.employeeId}||${punch.dateISO}`;
    if (!perDayAccumulator.has(key)) {
      perDayAccumulator.set(key, {
        employeeId: punch.employeeId,
        employeeName: punch.employeeName,
        day: punch.day,
        dateISO: punch.dateISO,
        month: punch.month,
        earliest: punch.time,
        latest: punch.time,
        times: [punch.time],
        sourceFiles: new Set(punch.sourceFiles),
        origin: punch.origin,
      });
    } else {
      const bucket = perDayAccumulator.get(key)!;
      bucket.times.push(punch.time);
      if (!bucket.earliest || punch.time < bucket.earliest) {
        bucket.earliest = punch.time;
      }
      if (!bucket.latest || punch.time > bucket.latest) {
        bucket.latest = punch.time;
      }
      for (const source of punch.sourceFiles) {
        bucket.sourceFiles.add(source);
      }
      if (punch.origin === "merged" || bucket.times.length > 1) {
        bucket.origin = "merged";
      }
    }
  }

  const perDay = Array.from(perDayAccumulator.values())
    .sort((a, b) => {
      if (a.employeeId !== b.employeeId) return a.employeeId.localeCompare(b.employeeId);
      if (a.dateISO !== b.dateISO) return a.dateISO.localeCompare(b.dateISO);
      return 0;
    })
    .map<MergedPerDayRow>((bucket) => ({
      employeeId: bucket.employeeId,
      employeeName: bucket.employeeName,
      day: bucket.day,
      earliest: bucket.earliest,
      latest: bucket.latest,
      allTimes: [...bucket.times],
      dateISO: bucket.dateISO,
      month: bucket.month,
      sourceFiles: Array.from(bucket.sourceFiles).sort(),
      origin: bucket.origin,
    }));

  const uniqueEmployees = new Set(punches.map((row) => row.employeeId)).size;
  const months = Array.from(new Set(punches.map((row) => row.month))).sort();
  const dates = punches.map((row) => row.dateISO).sort();
  const dateRange: { from?: string; to?: string } = {};
  if (dates.length > 0) {
    dateRange.from = dates[0];
    dateRange.to = dates[dates.length - 1];
  }

  const warnings: ParseWarning[] = [];
  if (dedupCount > 0) {
    warnings.push({
      type: "merge",
      message: `Deduplicated ${dedupCount} punches that occurred within the same minute across files.`,
      count: dedupCount,
      examples: [],
    });
  }

  return {
    punches,
    perDay,
    warnings,
    totalPunches: punches.length,
    uniqueEmployees,
    months,
    dateRange,
  };
}

export function exportResultsToXlsx(perEmployee: PerEmployeeRow[], perDay: PerDayRow[]) {
  const wb = XLSX.utils.book_new();
  const s1 = XLSX.utils.json_to_sheet(
    perEmployee.map((r) => ({
      EmployeeID: r.employeeId,
      EmployeeName: r.employeeName,
      DaysWithLogs: r.daysWithLogs,
      LateDays: r.lateDays,
      UndertimeDays: r.undertimeDays,
      LateRatePercent: r.lateRate,
      UndertimeRatePercent: r.undertimeRate,
      ScheduleTypes: (r.scheduleTypes ?? []).join(", "),
      ScheduleSource: r.scheduleSource ?? "",
    }))
  );
  XLSX.utils.book_append_sheet(wb, s1, "PerEmployee");

  const s2 = XLSX.utils.json_to_sheet(
    perDay.map((r) => ({
      EmployeeID: r.employeeId,
      EmployeeName: r.employeeName,
      Day: r.day,
      Earliest: r.earliest ?? "",
      Latest: r.latest ?? "",
      Worked: r.workedHHMM ?? "",
      ScheduleType: r.scheduleType ?? "",
      IsLate: r.isLate ? "Yes" : "No",
      IsUndertime: r.isUndertime ? "Yes" : "No",
      ScheduleSource: r.scheduleSource ?? "",
    }))
  );
  XLSX.utils.book_append_sheet(wb, s2, "PerDay");

  XLSX.writeFile(wb, "biometrics_results.xlsx");
}

type AggregateRow = {
  employeeId: string;
  employeeName: string;
  daysWithLogs: number;
  lateDays: number;
  undertimeDays: number;
  lateRate: number;
  undertimeRate: number;
  scheduleTypes: Set<string>;
  scheduleSourceSet: Set<string>;
};

const SOURCE_PRIORITY = ["EXCEPTION", "WORKSCHEDULE", "DEFAULT", "NOMAPPING"] as const;

const sourceRank = (value: string) => {
  const index = SOURCE_PRIORITY.indexOf(value as (typeof SOURCE_PRIORITY)[number]);
  return index === -1 ? SOURCE_PRIORITY.length : index;
};

const pickSource = (sources: string[]) => {
  if (!sources.length) return "DEFAULT";
  return sources.sort((a, b) => sourceRank(a) - sourceRank(b))[0] ?? "DEFAULT";
};

export function summarizePerEmployee(
  perDay: Array<
    Pick<
      PerDayRow,
      "employeeId" | "employeeName" | "earliest" | "latest" | "allTimes" | "isLate" | "isUndertime" | "scheduleType" | "scheduleSource"
    >
  >
): PerEmployeeRow[] {
  const map = new Map<string, AggregateRow>();
  for (const row of perDay) {
    const key = `${row.employeeId}||${row.employeeName}`;
    if (!map.has(key)) {
      map.set(key, {
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        daysWithLogs: 0,
        lateDays: 0,
        undertimeDays: 0,
        lateRate: 0,
        undertimeRate: 0,
        scheduleTypes: new Set<string>(),
        scheduleSourceSet: new Set<string>(),
      });
    }
    const agg = map.get(key)!;
    const hasLogs = Boolean(row.earliest || row.latest || (row.allTimes?.length ?? 0) > 0);
    if (hasLogs) {
      agg.daysWithLogs++;
      if (row.isLate) agg.lateDays++;
      if (row.isUndertime) agg.undertimeDays++;
    }
    if (row.scheduleType) {
      agg.scheduleTypes.add(row.scheduleType);
    }
    if (row.scheduleSource) {
      agg.scheduleSourceSet.add(row.scheduleSource);
    }
  }

  return Array.from(map.values()).map((entry) => ({
    employeeId: entry.employeeId,
    employeeName: entry.employeeName,
    daysWithLogs: entry.daysWithLogs,
    lateDays: entry.lateDays,
    undertimeDays: entry.undertimeDays,
    lateRate: entry.daysWithLogs ? +((entry.lateDays / entry.daysWithLogs) * 100).toFixed(1) : 0,
    undertimeRate: entry.daysWithLogs ? +((entry.undertimeDays / entry.daysWithLogs) * 100).toFixed(1) : 0,
    scheduleTypes: Array.from(entry.scheduleTypes).sort(),
    scheduleSource: pickSource(Array.from(entry.scheduleSourceSet)),
  }));
}
