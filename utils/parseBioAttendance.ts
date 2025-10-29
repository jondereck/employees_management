import * as XLSX from "xlsx-js-style";
import type { WorkBook } from "xlsx";

import { firstEmployeeNoToken } from "@/lib/employeeNo";

import {
  DEFAULT_SUMMARY_SELECTED_COLUMNS,
  SUMMARY_COLUMN_DEFINITION_MAP,
  type SummaryColumnDefinition,
  type SummaryColumnKey,
  type SummaryColumnWidth,
} from "./biometricsExportConfig";
import {
  formatScheduleSource,
  UNASSIGNED_OFFICE_LABEL,
  UNKNOWN_OFFICE_LABEL,
  UNMATCHED_LABEL,
  normalizeBiometricToken,
} from "./biometricsShared";

import type { DayEvaluationStatus } from "./evaluateDay";
import type { WeeklyPatternWindow } from "./weeklyPattern";

export type WarningLevel = "info" | "warning";

export type UnmatchedIdentityWarningDetail = {
  token: string;
  employeeIds: string[];
};

export type ParseWarning = {
  type: "DATE_PARSE" | "GENERAL" | "MERGED_DUPLICATES";
  level: WarningLevel;
  message: string;
  count?: number;
  samples?: string[];
  unmatchedIdentities?: UnmatchedIdentityWarningDetail[];
};

export type DayPunch = {
  time: string;
  minuteOfDay: number;
  source: "original" | "merged";
  files: string[];
};

export type WorkbookParserType = "legacy" | "grid-report";

export type ParsedDayRecord = {
  employeeId: string;
  employeeToken: string;
  employeeName: string;
  employeeDept?: string | null;
  resolvedEmployeeId?: string | null;
  officeId?: string | null;
  officeName?: string | null;
  dateISO: string;
  day: number;
  punches: DayPunch[];
  sourceFiles: string[];
  sheetName: string;
  composedFromDayOnly: boolean;
  parserType: WorkbookParserType;
  parserTypes: WorkbookParserType[];
};

export type ParsedPerDayRow = {
  employeeId: string;
  employeeToken: string;
  employeeName: string;
  employeeNo?: string | null;
  isHead?: boolean | null;
  employeeDept?: string | null;
  resolvedEmployeeId?: string | null;
  officeId?: string | null;
  officeName?: string | null;
  dateISO: string;
  day: number;
  earliest: string | null;
  latest: string | null;
  allTimes: string[];
  punches: DayPunch[];
  sourceFiles: string[];
  composedFromDayOnly: boolean;
  parserType?: WorkbookParserType;
  parserTypes?: WorkbookParserType[];
};

export type PerDayRow = ParsedPerDayRow & {
  status?: DayEvaluationStatus | string;
  evaluationStatus?: DayEvaluationStatus;
  isLate: boolean;
  isUndertime: boolean;
  workedHHMM?: string | null;
  workedMinutes?: number | null;
  presenceMinutes?: number | null;
  OT_pre?: number | null;
  OT_post?: number | null;
  OT_restday?: number | null;
  OT_holiday?: number | null;
  OT_excused?: number | null;
  OT_total?: number | null;
  ND_minutes?: number | null;
  absent?: boolean;
  scheduleType?: string;
  scheduleSource?: string;
  lateMinutes?: number | null;
  undertimeMinutes?: number | null;
  requiredMinutes?: number | null;
  scheduleStart?: string | null;
  scheduleEnd?: string | null;
  scheduleGraceMinutes?: number | null;
  identityStatus?: "matched" | "unmatched" | "ambiguous";
  weeklyPatternApplied?: boolean;
  weeklyPatternWindows?: WeeklyPatternWindow[] | null;
  weeklyPatternPresence?: { start: string; end: string }[];
  weeklyExclusionApplied?: { mode: string; ignoreUntil: string | null } | null;
  weeklyExclusionMode?: string | null;
  weeklyExclusionIgnoreUntil?: string | null;
  weeklyExclusionId?: string | null;
  notes?: string[];
};

export type PerEmployeeRow = {
  employeeId: string;
  employeeToken: string;
  employeeName: string;
  employeeNo?: string | null;
  isHead?: boolean | null;
  resolvedEmployeeId?: string | null;
  officeId?: string | null;
  officeName?: string | null;
  daysWithLogs: number;
  noPunchDays: number;
  absences: number;
  lateDays: number;
  undertimeDays: number;
  lateRate: number;
  undertimeRate: number;
  scheduleTypes?: string[];
  scheduleSource?: string;
  totalLateMinutes: number;
  totalUndertimeMinutes: number;
  totalOTMinutes: number;
  totalOTPreMinutes: number;
  totalOTPostMinutes: number;
  totalOTRestdayMinutes: number;
  totalOTHolidayMinutes: number;
  totalOTExcusedMinutes: number;
  totalNightDiffMinutes: number;
  totalRequiredMinutes: number;
  identityStatus: "matched" | "unmatched" | "ambiguous";
  weeklyPatternDayCount: number;
  excusedDays: number;
};

export type ParsedWorkbook = {
  days: ParsedDayRecord[];
  warnings: ParseWarning[];
  monthHints: string[];
  dateRange: { start: string; end: string } | null;
  employeeCount: number;
  totalPunches: number;
  normalizedXlsx?: ArrayBuffer;
  parserTypes: WorkbookParserType[];
};

export type MergeResult = {
  perDay: ParsedPerDayRow[];
  warnings: ParseWarning[];
  months: string[];
  employeeCount: number;
  totalPunches: number;
  dateRange: { start: string; end: string } | null;
  mergedDuplicates: number;
};

type MonthDetection = {
  year: number;
  month: number;
  hints: string[];
};

type MutablePunch = {
  time: string;
  minuteOfDay: number;
  source: "original" | "merged";
  files: Set<string>;
};

type MutableDay = {
  employeeId: string;
  employeeToken: string;
  employeeName: string;
  employeeDept?: string | null;
  dateISO: string;
  day: number;
  punches: Map<number, MutablePunch>;
  sourceFiles: Set<string>;
  sheetName: string;
  composedFromDayOnly: boolean;
  parserTypes: Set<WorkbookParserType>;
};

const MONTH_NAMES = new Map<string, number>([
  ["jan", 1],
  ["january", 1],
  ["feb", 2],
  ["february", 2],
  ["mar", 3],
  ["march", 3],
  ["apr", 4],
  ["april", 4],
  ["may", 5],
  ["jun", 6],
  ["june", 6],
  ["jul", 7],
  ["july", 7],
  ["aug", 8],
  ["august", 8],
  ["sep", 9],
  ["sept", 9],
  ["september", 9],
  ["oct", 10],
  ["october", 10],
  ["nov", 11],
  ["november", 11],
  ["dec", 12],
  ["december", 12],
]);

const pad2 = (value: number) => String(value).padStart(2, "0");

const normalizeWhitespace = (value: string) => value.trim().replace(/\s+/g, " ");

const firstEmployeeToken = (value: string) => {
  const token = value.split(",")[0]?.trim();
  if (token) return token.split(/\s+/)[0] ?? token;
  return value.trim();
};

const toMinuteOfDay = (time: string) => {
  const [hh, mm] = time.split(":").map(Number);
  return hh * 60 + mm;
};

const isHeaderRow = (row: unknown[]): boolean => {
  const c1 = String(row?.[1] ?? "").trim();
  const c2 = String(row?.[2] ?? "").trim();
  const c3 = String(row?.[3] ?? "").trim();
  return c1 === "1" && c2 === "2" && c3 === "3";
};

const GRID_SHEET_NAME_PATTERN = /(att\.?\s*log report|attendance record report)/i;
const GRID_HEADER_SCAN_LIMIT = 20;
const GRID_MIN_DAY_RUN = 20;

const normalizeCellText = (raw: unknown): string => {
  if (raw == null) return "";
  if (typeof raw === "number" && !Number.isFinite(raw)) return "";
  const text = String(raw ?? "").trim();
  if (!text) return "";
  if (text.toLowerCase() === "nan") return "";
  return text;
};

const isGridSheetName = (sheetName: string): boolean => GRID_SHEET_NAME_PATTERN.test(sheetName ?? "");

const isWorkbookInput = (value: unknown): value is WorkBook =>
  Boolean(value && typeof value === "object" && Array.isArray((value as WorkBook).SheetNames));

export type GridHeaderDetection = {
  headerRowIndex: number;
  dayColumns: Array<{ day: number; columnIndex: number }>;
};

export const detectGridHeaderRow = (rows: unknown[][]): GridHeaderDetection | null => {
  const limit = Math.min(rows.length, GRID_HEADER_SCAN_LIMIT);
  for (let r = 0; r < limit; r++) {
    const row = rows[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      const cell = normalizeCellText(row[c]);
      if (!cell) continue;
      const day = Number(cell.replace(/^0+/, "")) || Number(cell);
      if (!Number.isInteger(day) || day !== 1) continue;

      const dayColumns: Array<{ day: number; columnIndex: number }> = [];
      let expected = 1;
      let column = c;
      while (column < row.length) {
        const value = normalizeCellText(row[column]);
        if (!value) break;
        const current = Number(value.replace(/^0+/, "")) || Number(value);
        if (!Number.isInteger(current) || current !== expected) break;
        dayColumns.push({ day: current, columnIndex: column });
        expected += 1;
        column += 1;
      }

      if (dayColumns.length >= GRID_MIN_DAY_RUN) {
        return { headerRowIndex: r, dayColumns };
      }
    }
  }
  return null;
};

export type GridEmployeeBlock = {
  startRow: number;
  endRow: number;
  idColumn: number;
};

export const detectGridEmployeeBlocks = (
  rows: unknown[][],
  headerRowIdx: number
): GridEmployeeBlock[] => {
  const blocks: GridEmployeeBlock[] = [];
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      const cell = normalizeCellText(row[c]).toUpperCase();
      if (cell === "ID:") {
        blocks.push({ startRow: r, endRow: rows.length - 1, idColumn: c });
        break;
      }
    }
  }

  for (let i = 0; i < blocks.length; i++) {
    const next = blocks[i + 1];
    if (next) {
      blocks[i] = { ...blocks[i], endRow: Math.max(blocks[i].startRow, next.startRow - 1) };
    }
  }

  return blocks;
};

const GRID_VALUE_WINDOW_ROWS = 6;
const GRID_VALUE_WINDOW_COLS = 3;

const matchAnyLabel = (value: string, labels: string[]) =>
  labels.includes(value.toLowerCase());

const findValueNearLabel = (
  rows: unknown[][],
  block: GridEmployeeBlock,
  labels: string[],
  validator: (value: string) => boolean
): string => {
  for (let r = block.startRow; r <= block.endRow; r++) {
    const row = rows[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      const cell = normalizeCellText(row[c]);
      if (!cell) continue;
      if (!matchAnyLabel(cell.toLowerCase(), labels)) continue;

      const maxRow = Math.min(block.endRow, r + GRID_VALUE_WINDOW_ROWS);
      for (let rr = r; rr <= maxRow; rr++) {
        const windowRow = rows[rr] ?? [];
        const maxCol = Math.min(windowRow.length - 1, c + GRID_VALUE_WINDOW_COLS);
        for (let cc = c + 1; cc <= maxCol; cc++) {
          const candidate = normalizeCellText(windowRow[cc]);
          if (!candidate) continue;
          if (matchAnyLabel(candidate.toLowerCase(), labels)) continue;
          if (validator(candidate)) return normalizeWhitespace(candidate);
        }
      }
    }
  }
  return "";
};

const nearestMeta = (rows: unknown[][], headerRowIdx: number) => {
  let employeeId = "";
  let employeeName = "";
  for (let r = headerRowIdx - 1; r >= 0; r--) {
    const row = rows[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] ?? "").trim();
      if (!employeeId && cell === "User ID:" && row[c + 1] != null) {
        const v = String(row[c + 1]).trim();
        if (v && v.toLowerCase() !== "nan") employeeId = v;
      }
      if (!employeeName && cell === "Name:" && row[c + 1] != null) {
        const v = String(row[c + 1]).trim();
        if (v && v.toLowerCase() !== "nan") employeeName = v;
      }
    }
    if (employeeId && employeeName) break;
  }
  return { employeeId: normalizeWhitespace(employeeId), employeeName: normalizeWhitespace(employeeName) };
};

const parseMonthCandidatesFromCell = (raw: unknown): MonthDetection[] => {
  if (raw == null) return [];

  const candidates: MonthDetection[] = [];

  const pushCandidate = (year: number, month: number) => {
    if (!Number.isFinite(year) || !Number.isFinite(month)) return;
    if (month < 1 || month > 12) return;
    candidates.push({ year, month, hints: [`${year}-${pad2(month)}`] });
  };

  if (raw instanceof Date) {
    pushCandidate(raw.getUTCFullYear(), raw.getUTCMonth() + 1);
    return candidates;
  }

  if (typeof raw === "number") {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed && parsed.y && parsed.m) {
      pushCandidate(parsed.y, parsed.m);
    }
    return candidates;
  }

  const text = String(raw ?? "").trim();
  if (!text) return candidates;

  const isoMatches = text.matchAll(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/g);
  for (const match of isoMatches) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    pushCandidate(year, month);
  }

  const usMatches = text.matchAll(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/g);
  for (const match of usMatches) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const year = Number(match[3]);
    const month = first > 12 && second <= 12 ? second : first;
    pushCandidate(year, month);
  }

  const ymMatches = text.matchAll(/(\d{4})[\/-](\d{1,2})(?![\d])/g);
  for (const match of ymMatches) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    pushCandidate(year, month);
  }

  const nameMatches = text.matchAll(/([A-Za-z]+)(?:\s+|\s*,\s*)(\d{4})/g);
  for (const match of nameMatches) {
    const monthName = match[1]?.toLowerCase();
    const year = Number(match[2]);
    const month = MONTH_NAMES.get(monthName ?? "");
    if (month) pushCandidate(year, month);
  }

  const longNameMatches = text.matchAll(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/g);
  for (const match of longNameMatches) {
    const monthName = match[1]?.toLowerCase();
    const month = MONTH_NAMES.get(monthName ?? "");
    const year = Number(match[3]);
    if (month) pushCandidate(year, month);
  }

  return candidates;
};

const detectMonthContext = (rows: unknown[][], headerRowIdx: number): MonthDetection => {
  const matches: MonthDetection[] = [];
  const start = Math.max(0, headerRowIdx - 12);
  const end = Math.min(rows.length, headerRowIdx + 12);

  for (let r = start; r < end; r++) {
    const row = rows[r] ?? [];
    for (const cell of row) {
      const candidates = parseMonthCandidatesFromCell(cell);
      matches.push(...candidates);
    }
  }

  if (!matches.length) {
    throw new Error("Unable to detect month information near the header row.");
  }

  const counts = new Map<string, { candidate: MonthDetection; count: number }>();
  for (const candidate of matches) {
    for (const hint of candidate.hints) {
      const existing = counts.get(hint);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(hint, { candidate, count: 1 });
      }
    }
  }

  const sorted = Array.from(counts.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    const aKey = `${a.candidate.year}-${pad2(a.candidate.month)}`;
    const bKey = `${b.candidate.year}-${pad2(b.candidate.month)}`;
    return aKey.localeCompare(bKey);
  });

  const best = sorted[0]?.candidate;
  if (!best) {
    throw new Error("Unable to determine the workbook month.");
  }

  const uniqueHints = new Set<string>();
  for (const value of counts.values()) {
    uniqueHints.add(`${value.candidate.year}-${pad2(value.candidate.month)}`);
  }

  return { year: best.year, month: best.month, hints: Array.from(uniqueHints).sort() };
};

const normalizeTime = (hours: number, minutes: number) => {
  const safeHours = ((hours % 24) + 24) % 24;
  const safeMinutes = Math.max(0, Math.min(59, minutes));
  return `${pad2(safeHours)}:${pad2(safeMinutes)}`;
};

export const extractGridTimes = (raw: unknown): string[] => {
  const results = new Map<number, string>();

  if (raw == null) return [];

  if (raw instanceof Date) {
    const time = normalizeTime(raw.getHours(), raw.getMinutes());
    results.set(toMinuteOfDay(time), time);
  } else if (typeof raw === "number" && Number.isFinite(raw)) {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed) {
      const hours = (parsed.H ?? 0) + (parsed.d ?? 0) * 24;
      const minutes = parsed.M ?? 0;
      const time = normalizeTime(hours, minutes);
      results.set(toMinuteOfDay(time), time);
    }
  } else {
    const text = normalizeCellText(raw);
    if (!text) return [];
    const pattern = /(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text))) {
      let hours = Number(match[1]);
      const minutes = Number(match[2]);
      if (!Number.isFinite(hours) || !Number.isFinite(minutes)) continue;
      const suffix = match[3]?.toLowerCase();
      if (suffix === "pm" && hours < 12) hours += 12;
      if (suffix === "am" && hours === 12) hours = 0;
      const time = normalizeTime(hours, minutes);
      results.set(toMinuteOfDay(time), time);
    }
  }

  return Array.from(results.entries())
    .sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]))
    .map(([, time]) => time);
};

const extractTimesFromCell = (raw: unknown): string[] => {
  if (raw == null) return [];

  if (raw instanceof Date) {
    return [normalizeTime(raw.getHours(), raw.getMinutes())];
  }

  if (typeof raw === "number") {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed) {
      const hours = (parsed.H ?? 0) + (parsed.d ?? 0) * 24;
      const minutes = parsed.M ?? 0;
      return [normalizeTime(hours, minutes)];
    }
    return [];
  }

  const text = String(raw ?? "").trim();
  if (!text || text.toLowerCase() === "nan") return [];

  const results = new Set<string>();
  const pattern = /\b(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?\b/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const suffix = match[3]?.toLowerCase();
    if (suffix === "pm" && hours < 12) hours += 12;
    if (suffix === "am" && hours === 12) hours = 0;
    results.add(normalizeTime(hours, minutes));
  }

  return Array.from(results.values());
};

const ensureValidDate = (
  year: number,
  month: number,
  day: number,
  context: { samples: string[]; count: number },
  sampleLabel: string
): string | null => {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
    context.count += 1;
    if (context.samples.length < 10) {
      context.samples.push(sampleLabel);
    }
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
};

const finalizeDay = (day: MutableDay): ParsedDayRecord => {
  const punches = Array.from(day.punches.values())
    .sort((a, b) => a.minuteOfDay - b.minuteOfDay || a.time.localeCompare(b.time))
    .map<DayPunch>((entry) => ({
      time: entry.time,
      minuteOfDay: entry.minuteOfDay,
      source: entry.source,
      files: Array.from(entry.files.values()).sort(),
    }));

  const parserTypes = Array.from(day.parserTypes.values()).sort();
  const primaryParserType = parserTypes.includes("grid-report")
    ? "grid-report"
    : parserTypes[0] ?? "legacy";

  return {
    employeeId: day.employeeId,
    employeeToken: day.employeeToken,
    employeeName: day.employeeName,
    employeeDept: day.employeeDept ?? null,
    dateISO: day.dateISO,
    day: day.day,
    punches,
    sourceFiles: Array.from(day.sourceFiles.values()).sort(),
    sheetName: day.sheetName,
    composedFromDayOnly: day.composedFromDayOnly,
    parserType: primaryParserType,
    parserTypes,
  };
};



export function parseBioAttendance(
  input: ArrayBuffer | WorkBook,
  options: { fileName?: string } = {}
): ParsedWorkbook {
  const workbook = isWorkbookInput(input)
    ? input
    : XLSX.read(input as ArrayBuffer, { type: "array", cellDates: true });

  const parsedDays: ParsedDayRecord[] = [];
  const monthHints = new Set<string>();
  const invalidDateContext = { samples: [] as string[], count: 0 };
  const employeeTokens = new Set<string>();
  const parseWarnings: ParseWarning[] = [];
  const parserTypes = new Set<WorkbookParserType>();
  const sourceFile = options.fileName ?? "Unknown file";

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });

    const gridDetection = isGridSheetName(sheetName) ? detectGridHeaderRow(rows) : null;
    if (gridDetection) {
      parserTypes.add("grid-report");
      const { year, month, hints } = detectMonthContext(rows, gridDetection.headerRowIndex);
      hints.forEach((hint) => monthHints.add(hint));

      const blocks = detectGridEmployeeBlocks(rows, gridDetection.headerRowIndex);
      let emptyBlocks = 0;
      const emptySamples: string[] = [];

      for (const block of blocks) {
        const employeeNoRaw = findValueNearLabel(rows, block, ["id:"], (value) => {
          const digits = value.replace(/\D+/g, "");
          return digits.length >= 5;
        });
        const nameRaw = findValueNearLabel(rows, block, ["name:"], (value) => Boolean(value.trim()));
        const deptRaw = findValueNearLabel(rows, block, ["dept:", "dept."], (value) => Boolean(value.trim()));

        const employeeId = normalizeWhitespace(employeeNoRaw || nameRaw || "");
        const employeeName = normalizeWhitespace(nameRaw || employeeNoRaw || "");
        const employeeDept = deptRaw ? normalizeWhitespace(deptRaw) : null;
        const tokenSource = employeeId || employeeName;
        const employeeToken = firstEmployeeToken(tokenSource || "");

        if (!employeeToken) {
          continue;
        }

        const dayMap = new Map<number, MutableDay>();
        for (const { day, columnIndex } of gridDetection.dayColumns) {
          const dateISO = ensureValidDate(
            year,
            month,
            day,
            invalidDateContext,
            `${employeeId || employeeName || "Unknown"} • ${sheetName} • Day ${day}`
          );
          if (!dateISO) continue;

          const record: MutableDay = {
            employeeId: employeeId || employeeName || employeeToken,
            employeeToken,
            employeeName: employeeName || employeeId || employeeToken,
            employeeDept,
            dateISO,
            day,
            punches: new Map<number, MutablePunch>(),
            sourceFiles: new Set<string>([sourceFile]),
            sheetName,
            composedFromDayOnly: true,
            parserTypes: new Set<WorkbookParserType>(["grid-report"]),
          };
          dayMap.set(day, record);
        }

        if (!dayMap.size) {
          continue;
        }

        let blockPunchCount = 0;

        for (let r = block.startRow; r <= block.endRow; r++) {
          const row = rows[r] ?? [];
          for (const { day, columnIndex } of gridDetection.dayColumns) {
            const record = dayMap.get(day);
            if (!record) continue;
            const cell = row[columnIndex];
            const times = extractGridTimes(cell);
            for (const time of times) {
              const minute = toMinuteOfDay(time);
              const existing = record.punches.get(minute);
              if (existing) {
                existing.source = "merged";
                existing.files.add(sourceFile);
              } else {
                record.punches.set(minute, {
                  time,
                  minuteOfDay: minute,
                  source: "original",
                  files: new Set<string>([sourceFile]),
                });
                blockPunchCount += 1;
              }
            }
          }
        }

        for (const record of dayMap.values()) {
          parsedDays.push(finalizeDay(record));
          employeeTokens.add(record.employeeToken);
        }

        if (blockPunchCount === 0) {
          emptyBlocks += 1;
          if (emptySamples.length < 10) {
            emptySamples.push(`${employeeName || employeeId || employeeToken || "Unknown"} (${sheetName})`);
          }
        }
      }

      if (emptyBlocks > 0) {
        parseWarnings.push({
          type: "GENERAL",
          level: "warning",
          message: `Empty attendance sections (${emptyBlocks})`,
          count: emptyBlocks,
          samples: emptySamples,
        });
      }

      continue;
    }

    for (let r = 0; r < rows.length; r++) {
      const header = rows[r] ?? [];
      if (!isHeaderRow(header)) continue;

      const runLength = (() => {
        let run = 0;
        for (let d = 1; d < header.length; d++) {
          const value = String(header[d] ?? "").trim();
          if (/^\d{1,2}$/.test(value)) run += 1;
          else break;
        }
        return run;
      })();

      if (runLength === 0) continue;

      parserTypes.add("legacy");

      const { employeeId, employeeName } = nearestMeta(rows, r);
      const employeeToken = firstEmployeeToken(employeeId || employeeName || "");
      const { year, month, hints } = detectMonthContext(rows, r);
      hints.forEach((hint) => monthHints.add(hint));

      const dayMap = new Map<number, MutableDay>();
      for (let d = 1; d <= runLength; d++) {
        const dateISO = ensureValidDate(
          year,
          month,
          d,
          invalidDateContext,
          `${employeeId || employeeName || "Unknown"} • ${sheetName} • Day ${d}`
        );
        if (!dateISO) continue;
        const record: MutableDay = {
          employeeId,
          employeeToken,
          employeeName,
          employeeDept: null,
          dateISO,
          day: d,
          punches: new Map<number, MutablePunch>(),
          sourceFiles: new Set<string>([sourceFile]),
          sheetName,
          composedFromDayOnly: true,
          parserTypes: new Set<WorkbookParserType>(["legacy"]),
        };
        dayMap.set(d, record);
      }

      if (!dayMap.size) continue;

      for (let rr = r + 1; rr < rows.length; rr++) {
        const row = rows[rr] ?? [];
        if (isHeaderRow(row) || row.some((cell) => String(cell ?? "").trim() === "User ID:")) break;

        for (let d = 1; d <= runLength; d++) {
          const record = dayMap.get(d);
          if (!record) continue;
          const times = extractTimesFromCell(row[d]);
          for (const time of times) {
            const minute = toMinuteOfDay(time);
            const existing = record.punches.get(minute);
            if (existing) {
              existing.source = "merged";
              existing.files.add(sourceFile);
            } else {
              record.punches.set(minute, {
                time,
                minuteOfDay: minute,
                source: "original",
                files: new Set<string>([sourceFile]),
              });
            }
          }
        }
      }

      for (const record of dayMap.values()) {
        parsedDays.push(finalizeDay(record));
        employeeTokens.add(record.employeeToken);
      }
    }
  }

  if (!parsedDays.length) {
    throw new Error("No recognizable biometrics sections were found in the workbook.");
  }

  const sortedDays = parsedDays.sort((a, b) => {
    const tokenDiff = a.employeeToken.localeCompare(b.employeeToken);
    if (tokenDiff !== 0) return tokenDiff;
    if (a.dateISO !== b.dateISO) return a.dateISO.localeCompare(b.dateISO);
    return a.sheetName.localeCompare(b.sheetName);
  });

  let minDate: string | null = null;
  let maxDate: string | null = null;
  let totalPunches = 0;
  for (const day of sortedDays) {
    if (!minDate || day.dateISO < minDate) minDate = day.dateISO;
    if (!maxDate || day.dateISO > maxDate) maxDate = day.dateISO;
    totalPunches += day.punches.length;
  }

  const warnings: ParseWarning[] = [...parseWarnings];
  if (invalidDateContext.count > 0) {
    warnings.push({
      type: "DATE_PARSE",
      level: "warning",
      message: `Unable to parse ${invalidDateContext.count} date${invalidDateContext.count > 1 ? "s" : ""}.`,
      count: invalidDateContext.count,
      samples: invalidDateContext.samples,
    });
  }

  const normalizedXlsx = options.fileName?.toLowerCase().endsWith(".xls")
    ? XLSX.write(workbook, { bookType: "xlsx", type: "array" })
    : undefined;

  return {
    days: sortedDays,
    warnings,
    monthHints: Array.from(monthHints.values()).sort(),
    dateRange: minDate && maxDate ? { start: minDate, end: maxDate } : null,
    employeeCount: employeeTokens.size,
    totalPunches,
    normalizedXlsx,
    parserTypes: Array.from(parserTypes.values()).sort(),
  };
}

export function detectWorkbookParsers(input: ArrayBuffer | WorkBook): WorkbookParserType[] {
  const workbook = isWorkbookInput(input)
    ? input
    : XLSX.read(input as ArrayBuffer, { type: "array", cellDates: true });
  const parserTypes = new Set<WorkbookParserType>();

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });

    if (isGridSheetName(sheetName) && detectGridHeaderRow(rows)) {
      parserTypes.add("grid-report");
    }

    if (rows.some((row) => isHeaderRow(row))) {
      parserTypes.add("legacy");
    }
  }

  if (!parserTypes.size) {
    parserTypes.add("legacy");
  }

  return Array.from(parserTypes.values()).sort();
}

export function mergeParsedWorkbooks(files: ParsedWorkbook[]): MergeResult {
  const dayMap = new Map<string, MutableDay>();
  const months = new Set<string>();
  const warnings: ParseWarning[] = [];
  const employeeTokens = new Set<string>();
  let minDate: string | null = null;
  let maxDate: string | null = null;
  let mergedDuplicates = 0;

  for (const file of files) {
    warnings.push(...file.warnings);
    for (const day of file.days) {
      const key = `${day.employeeToken}::${day.dateISO}`;
      months.add(day.dateISO.slice(0, 7));
      employeeTokens.add(day.employeeToken);
      if (!minDate || day.dateISO < minDate) minDate = day.dateISO;
      if (!maxDate || day.dateISO > maxDate) maxDate = day.dateISO;

      const base = dayMap.get(key);
      if (!base) {
        const mutable: MutableDay = {
          employeeId: day.employeeId,
          employeeToken: day.employeeToken,
          employeeName: day.employeeName,
          employeeDept: day.employeeDept ?? null,
          dateISO: day.dateISO,
          day: day.day,
          punches: new Map<number, MutablePunch>(),
          sourceFiles: new Set<string>(day.sourceFiles),
          sheetName: day.sheetName,
          composedFromDayOnly: day.composedFromDayOnly,
          parserTypes: new Set<WorkbookParserType>(
            day.parserTypes?.length
              ? day.parserTypes
              : day.parserType
              ? [day.parserType]
              : ["legacy"]
          ),
        };
        for (const punch of day.punches) {
          mutable.punches.set(punch.minuteOfDay, {
            time: punch.time,
            minuteOfDay: punch.minuteOfDay,
            source: punch.source,
            files: new Set<string>(punch.files),
          });
        }
        dayMap.set(key, mutable);
      } else {
        if (!base.employeeName && day.employeeName) {
          base.employeeName = day.employeeName;
        }
        if (!base.employeeDept && day.employeeDept) {
          base.employeeDept = day.employeeDept;
        }
        base.composedFromDayOnly = base.composedFromDayOnly || day.composedFromDayOnly;
        base.sourceFiles = new Set<string>([...base.sourceFiles, ...day.sourceFiles]);
        const incomingParsers = day.parserTypes?.length
          ? day.parserTypes
          : day.parserType
          ? [day.parserType]
          : ["legacy"];
        for (const parserType of incomingParsers) {
          base.parserTypes.add(parserType as WorkbookParserType);
        }
        for (const punch of day.punches) {
          const existing = base.punches.get(punch.minuteOfDay);
          if (existing) {
            mergedDuplicates += 1;
            existing.source = "merged";
            for (const fileName of punch.files) existing.files.add(fileName);
          } else {
            base.punches.set(punch.minuteOfDay, {
              time: punch.time,
              minuteOfDay: punch.minuteOfDay,
              source: punch.source,
              files: new Set<string>(punch.files),
            });
          }
        }
      }
    }
  }

  const perDay: ParsedPerDayRow[] = Array.from(dayMap.values())
    .map((mutable) => finalizeDay(mutable))
    .map<ParsedPerDayRow>((record) => {
      const allTimes = record.punches.map((punch) => punch.time);
      return {
        employeeId: record.employeeId,
        employeeToken: record.employeeToken,
        employeeName: record.employeeName,
        employeeDept: record.employeeDept ?? null,
        dateISO: record.dateISO,
        day: Number(record.dateISO.slice(-2)),
        earliest: allTimes[0] ?? null,
        latest: allTimes.length ? allTimes[allTimes.length - 1] : null,
        allTimes,
        punches: record.punches,
        sourceFiles: record.sourceFiles,
        composedFromDayOnly: record.composedFromDayOnly,
        parserType: record.parserType,
        parserTypes: record.parserTypes,
      };
    })
    .sort(comparePerDayRows);

  const totalPunches = perDay.reduce((acc, row) => acc + row.allTimes.length, 0);

  if (mergedDuplicates > 0) {
    warnings.push({
      type: "MERGED_DUPLICATES",
      level: "info",
      message: `Detected and merged ${mergedDuplicates} duplicate punch${
        mergedDuplicates > 1 ? "es" : ""
      } that occurred within the same minute. The duplicates were removed automatically and only one entry per minute was kept.`,
    });
  }

  return {
    perDay,
    warnings,
    months: Array.from(months.values()).sort(),
    employeeCount: employeeTokens.size,
    totalPunches,
    dateRange: minDate && maxDate ? { start: minDate, end: maxDate } : null,
    mergedDuplicates,
  };
}

type AggregateRow = {
  employeeId: string;
  employeeToken: string;
  employeeName: string;
  employeeNo?: string | null;
  isHead?: boolean | null;
  identityStatus: "matched" | "unmatched" | "ambiguous";
  resolvedEmployeeId?: string | null;
  officeId?: string | null;
  officeName?: string | null;
  daysWithLogs: number;
  noPunchDays: number;
  excusedDays: number;
  absences: number;
  lateDays: number;
  undertimeDays: number;
  totalLateMinutes: number;
  totalUndertimeMinutes: number;
  totalOTMinutes: number;
  totalOTPreMinutes: number;
  totalOTPostMinutes: number;
  totalOTRestdayMinutes: number;
  totalOTHolidayMinutes: number;
  totalOTExcusedMinutes: number;
  totalNightDiffMinutes: number;
  totalRequiredMinutes: number;
  scheduleTypes: Set<string>;
  scheduleSourceSet: Set<string>;
  weeklyPatternDays: number;
};

const SOURCE_PRIORITY = ["EXCEPTION", "WORKSCHEDULE", "DEFAULT", "NOMAPPING"] as const;

const sourceRank = (value: string) => {
  const index = SOURCE_PRIORITY.indexOf(value as typeof SOURCE_PRIORITY[number]);
  return index === -1 ? SOURCE_PRIORITY.length : index;
};

const pickSource = (sources: string[]) => {
  if (!sources.length) return "DEFAULT";
  return sources.sort((a, b) => sourceRank(a) - sourceRank(b))[0] ?? "DEFAULT";
};

type ScheduleSummaryOptions = {
  mappingByToken?: Map<string, string>;
  schedulePresenceByEmployee?: Map<string, boolean>;
};

const resolveScheduleSourceForAggregate = (
  entry: AggregateRow,
  options?: ScheduleSummaryOptions
): string => {
  const normalizedToken = normalizeBiometricToken(entry.employeeToken);
  const hasMappingFromOptions = options?.mappingByToken
    ? options.mappingByToken.has(normalizedToken)
    : null;
  const hasMapping = hasMappingFromOptions ?? Boolean(entry.resolvedEmployeeId);

  if (!hasMapping) {
    return "NOMAPPING";
  }

  if (options?.schedulePresenceByEmployee && entry.resolvedEmployeeId) {
    const hasSchedule = options.schedulePresenceByEmployee.get(entry.resolvedEmployeeId) ?? false;
    if (hasSchedule || entry.weeklyPatternDays > 0) {
      return "WORKSCHEDULE";
    }
    return "DEFAULT";
  }

  const fallback = pickSource(Array.from(entry.scheduleSourceSet));
  if (entry.weeklyPatternDays > 0 && fallback !== "NOMAPPING") {
    return "WORKSCHEDULE";
  }
  if (fallback === "NOMAPPING") {
    return entry.weeklyPatternDays > 0 ? "WORKSCHEDULE" : "DEFAULT";
  }
  return fallback;
};

const statusPriority = {
  unmatched: 0,
  ambiguous: 1,
  matched: 2,
} as const;

const resolveMatchStatus = (
  status?: "matched" | "unmatched" | "ambiguous",
  resolvedEmployeeId?: string | null,
  manualSolved?: boolean
): "matched" | "unmatched" | "solved" => {
  if (manualSolved) return "solved";
  if (status === "matched") return "matched";
  if (resolvedEmployeeId) return "matched";
  return "unmatched";
};

const toMinute = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

function resolveLateMinutes(
  row: Pick<
    PerDayRow,
    "lateMinutes" | "earliest" | "scheduleStart" | "scheduleGraceMinutes"
  >
): number | null {
  if (typeof row.lateMinutes === "number") return row.lateMinutes;
  const earliest = toMinute(row.earliest ?? null);
  const start = toMinute(row.scheduleStart ?? null);
  if (earliest == null || start == null) return null;
  const grace = row.scheduleGraceMinutes ?? 0;
  return Math.max(0, earliest - (start + grace));
}

function resolveUndertimeMinutes(
  row: Pick<PerDayRow, "undertimeMinutes" | "requiredMinutes" | "workedMinutes">
): number | null {
  if (typeof row.undertimeMinutes === "number") return row.undertimeMinutes;
  if (row.requiredMinutes == null) return null;
  if (typeof row.workedMinutes === "number") {
    return Math.max(0, row.requiredMinutes - row.workedMinutes);
  }
  return row.requiredMinutes;
}

const getToken = (row: { employeeId: string; employeeToken?: string | null }): string =>
  (row.employeeToken || row.employeeId || "").trim();

const getEarliest = (row: { earliest: string | null; allTimes: string[] }): string => {
  if (row.earliest) return row.earliest;
  if (row.allTimes?.length) return row.allTimes[0] ?? "";
  return "";
};

const getLatest = (row: { latest: string | null; allTimes: string[] }): string => {
  if (row.latest) return row.latest;
  if (row.allTimes?.length) return row.allTimes[row.allTimes.length - 1] ?? "";
  return "";
};

export const comparePerDayRows = <T extends {
  employeeId: string;
  employeeToken?: string | null;
  employeeName?: string;
  dateISO: string;
  earliest: string | null;
  latest: string | null;
  allTimes: string[];
}>(a: T, b: T): number => {
  const tokenDiff = getToken(a).localeCompare(getToken(b));
  if (tokenDiff !== 0) return tokenDiff;

  const dateDiff = a.dateISO.localeCompare(b.dateISO);
  if (dateDiff !== 0) return dateDiff;

  const earliestDiff = getEarliest(a).localeCompare(getEarliest(b));
  if (earliestDiff !== 0) return earliestDiff;

  const latestDiff = getLatest(a).localeCompare(getLatest(b));
  if (latestDiff !== 0) return latestDiff;

  const lengthDiff = (a.allTimes?.length ?? 0) - (b.allTimes?.length ?? 0);
  if (lengthDiff !== 0) return lengthDiff;

  return (a.employeeName ?? "").localeCompare(b.employeeName ?? "");
};

export const sortPerDayRows = <T extends {
  employeeId: string;
  employeeToken?: string | null;
  employeeName?: string;
  dateISO: string;
  earliest: string | null;
  latest: string | null;
  allTimes: string[];
}>(rows: T[]): T[] => {
  return [...rows].sort(comparePerDayRows);
};

export function summarizePerEmployee(
  perDay: Array<
    Pick<
      PerDayRow,
      | "employeeId"
      | "employeeToken"
      | "employeeName"
      | "employeeNo"
      | "resolvedEmployeeId"
      | "officeId"
      | "officeName"
      | "status"
      | "evaluationStatus"
      | "isHead"
      | "earliest"
      | "latest"
      | "allTimes"
      | "isLate"
      | "isUndertime"
      | "scheduleType"
      | "scheduleSource"
      | "identityStatus"
      | "lateMinutes"
      | "undertimeMinutes"
      | "requiredMinutes"
      | "scheduleStart"
      | "scheduleGraceMinutes"
      | "workedMinutes"
      | "absent"
      | "weeklyPatternApplied"
      | "OT_total"
      | "OT_pre"
      | "OT_post"
      | "OT_restday"
      | "OT_holiday"
      | "OT_excused"
      | "ND_minutes"
    >
  >,
  options?: ScheduleSummaryOptions
): PerEmployeeRow[] {
  const map = new Map<string, AggregateRow>();
  for (const row of perDay) {
    const token = row.employeeToken || row.employeeId || row.employeeName;
    const key = `${token}||${row.employeeName}`;
    const identityStatus = row.identityStatus ?? (row.resolvedEmployeeId ? "matched" : "unmatched");
    const employeeNo = firstEmployeeNoToken(row.employeeNo);
    if (!map.has(key)) {
      map.set(key, {
        employeeId: row.employeeId,
        employeeToken: token,
        employeeName: row.employeeName,
        employeeNo: employeeNo ?? null,
        isHead: row.isHead ?? null,
        identityStatus,
        resolvedEmployeeId: row.resolvedEmployeeId ?? null,
        officeId: row.officeId ?? null,
        officeName: row.officeName ?? null,
        daysWithLogs: 0,
        noPunchDays: 0,
        excusedDays: 0,
        absences: 0,
        lateDays: 0,
        undertimeDays: 0,
        totalLateMinutes: 0,
        totalUndertimeMinutes: 0,
        totalOTMinutes: 0,
        totalOTPreMinutes: 0,
        totalOTPostMinutes: 0,
        totalOTRestdayMinutes: 0,
        totalOTHolidayMinutes: 0,
        totalOTExcusedMinutes: 0,
        totalNightDiffMinutes: 0,
        totalRequiredMinutes: 0,
        scheduleTypes: new Set<string>(),
        scheduleSourceSet: new Set<string>(),
        weeklyPatternDays: 0,
      });
    }
    const agg = map.get(key)!;
    if (!agg.officeId && row.officeId) agg.officeId = row.officeId;
    if (!agg.officeName && row.officeName) agg.officeName = row.officeName;
    if (!agg.resolvedEmployeeId && row.resolvedEmployeeId) {
      agg.resolvedEmployeeId = row.resolvedEmployeeId;
    }
    if (!agg.employeeNo && employeeNo) {
      agg.employeeNo = employeeNo;
    }
    if (agg.isHead == null && row.isHead != null) {
      agg.isHead = row.isHead;
    }
    if (statusPriority[identityStatus] > statusPriority[agg.identityStatus]) {
      agg.identityStatus = identityStatus;
    }

    const evaluationStatus: DayEvaluationStatus = row.evaluationStatus
      ? row.evaluationStatus
      : row.status === "no_punch" || row.status === "excused" || row.status === "evaluated"
      ? (row.status as DayEvaluationStatus)
      : row.earliest || row.latest || (row.allTimes?.length ?? 0) > 0
      ? "evaluated"
      : "no_punch";

    if (evaluationStatus === "no_punch") {
      agg.noPunchDays += 1;
    } else if (evaluationStatus === "excused") {
      agg.excusedDays += 1;
    } else {
      agg.daysWithLogs += 1;
      if (row.isLate) agg.lateDays += 1;
      if (row.isUndertime) agg.undertimeDays += 1;
      const lateMinutes = resolveLateMinutes(row);
      if (lateMinutes != null) agg.totalLateMinutes += lateMinutes;
      const undertimeMinutes = resolveUndertimeMinutes(row);
      if (undertimeMinutes != null) agg.totalUndertimeMinutes += undertimeMinutes;
      if (row.requiredMinutes != null) agg.totalRequiredMinutes += row.requiredMinutes;
      if (row.weeklyPatternApplied) {
        agg.weeklyPatternDays += 1;
      }
    }

    const otTotal = Number(row.OT_total ?? 0);
    if (Number.isFinite(otTotal)) agg.totalOTMinutes += otTotal;
    const otPre = Number(row.OT_pre ?? 0);
    if (Number.isFinite(otPre)) agg.totalOTPreMinutes += otPre;
    const otPost = Number(row.OT_post ?? 0);
    if (Number.isFinite(otPost)) agg.totalOTPostMinutes += otPost;
    const otRestday = Number(row.OT_restday ?? 0);
    if (Number.isFinite(otRestday)) agg.totalOTRestdayMinutes += otRestday;
    const otHoliday = Number(row.OT_holiday ?? 0);
    if (Number.isFinite(otHoliday)) agg.totalOTHolidayMinutes += otHoliday;
    const otExcused = Number(row.OT_excused ?? 0);
    if (Number.isFinite(otExcused)) agg.totalOTExcusedMinutes += otExcused;
    const ndMinutes = Number(row.ND_minutes ?? 0);
    if (Number.isFinite(ndMinutes)) agg.totalNightDiffMinutes += ndMinutes;
    if (row.absent) {
      agg.absences += 1;
    }
    if (row.scheduleType) agg.scheduleTypes.add(row.scheduleType);
    if (row.scheduleSource) agg.scheduleSourceSet.add(row.scheduleSource);
  }

  return Array.from(map.values()).map((entry) => ({
    employeeId: entry.employeeId,
    employeeToken: entry.employeeToken,
    employeeName: entry.employeeName,
    employeeNo: entry.employeeNo ?? null,
    isHead: entry.isHead ?? null,
    resolvedEmployeeId: entry.resolvedEmployeeId ?? null,
    officeId: entry.officeId ?? null,
    officeName: entry.officeName ?? null,
    daysWithLogs: entry.daysWithLogs,
    noPunchDays: entry.noPunchDays,
    absences: entry.absences,
    excusedDays: entry.excusedDays,
    lateDays: entry.lateDays,
    undertimeDays: entry.undertimeDays,
    lateRate: entry.daysWithLogs ? +((entry.lateDays / entry.daysWithLogs) * 100).toFixed(1) : 0,
    undertimeRate: entry.daysWithLogs ? +((entry.undertimeDays / entry.daysWithLogs) * 100).toFixed(1) : 0,
    scheduleTypes: Array.from(entry.scheduleTypes).sort(),
    scheduleSource: resolveScheduleSourceForAggregate(entry, options),
    totalLateMinutes: Math.round(entry.totalLateMinutes),
    totalUndertimeMinutes: Math.round(entry.totalUndertimeMinutes),
    totalOTMinutes: Math.round(entry.totalOTMinutes),
    totalOTPreMinutes: Math.round(entry.totalOTPreMinutes),
    totalOTPostMinutes: Math.round(entry.totalOTPostMinutes),
    totalOTRestdayMinutes: Math.round(entry.totalOTRestdayMinutes),
    totalOTHolidayMinutes: Math.round(entry.totalOTHolidayMinutes),
    totalOTExcusedMinutes: Math.round(entry.totalOTExcusedMinutes),
    totalNightDiffMinutes: Math.round(entry.totalNightDiffMinutes),
    totalRequiredMinutes: Math.round(entry.totalRequiredMinutes),
    identityStatus: entry.identityStatus,
    weeklyPatternDayCount: entry.weeklyPatternDays,
  }));
}

type SummaryCellValue = string | number | Date | null;

type SummaryRowValues = Record<SummaryColumnKey, SummaryCellValue>;

type SummaryTotals = Partial<Record<SummaryColumnKey, number | null>>;

type SummaryColumnContext = {
  definition: SummaryColumnDefinition | null;
  width: SummaryColumnWidth | undefined;
  type: SummaryColumnDefinition["type"] | undefined;
};

const HEADER_FILL_COLOR = "F3F4F6";
const HEADER_FONT_COLOR = "1F2937";
const ROW_BAND_COLOR = "F9FAFB";
const BORDER_COLOR = "D1D5DB";

const SUMMARY_SHEET_NAME = "Summary";
const PER_DAY_SHEET_NAME = "PerDay";
const METADATA_SHEET_NAME = "Metadata";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MONTH_FULL_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const pad = (value: number) => String(value).padStart(2, "0");

const ensureDate = (input?: Date | string | number) => {
  if (!input) return new Date();
  const candidate = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(candidate.getTime())) {
    return new Date();
  }
  return candidate;
};

const fmtTs = (input?: Date | string | number) => {
  const date = ensureDate(input);
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return {
    file: `${year}${month}${day}-${hours}${minutes}${seconds}`,
    display: `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`,
  };
};

type ExportPeriod = { month: number; year: number } | null | undefined;

const periodLabel = (period: ExportPeriod) => {
  if (!period) {
    return { text: "—", ym: "0000-00", fileSegment: "Attendance_Summary" };
  }
  const { month, year } = period;
  if (!Number.isFinite(month) || !Number.isFinite(year)) {
    return { text: "—", ym: "0000-00", fileSegment: "Attendance_Summary" };
  }
  if (month < 1 || month > 12) {
    const clampedMonth = Math.max(1, Math.min(12, month || 1));
    return {
      text: "—",
      ym: `${year}-${pad(clampedMonth)}`,
      fileSegment: "Attendance_Summary",
    };
  }

  const shortLabel = MONTHS[month - 1];
  const longLabel = MONTH_FULL_NAMES[month - 1];
  const ym = `${year}-${pad(month)}`;
  return {
    text: `${shortLabel} ${year}`,
    ym,
    fileSegment: `${longLabel}_${year}_Monthly_Summary`,
  };
};

type TimestampInfo = ReturnType<typeof fmtTs>;

const TABLE_HEADER_OFFSET = 4;

const buildSheet = (
  dataAoA: any[][],
  title: string,
  period: ExportPeriod,
  timestamp: TimestampInfo = fmtTs()
) => {
  const { display } = timestamp;
  const { text } = periodLabel(period);
  const header = [[title], [`Period: ${text}`], [`Generated at: ${display}`], [""]];
  const worksheet = XLSX.utils.aoa_to_sheet([...header, ...dataAoA]);

  const colCount = dataAoA.reduce((max, row) => Math.max(max, row.length), 1);
  (worksheet["!merges"] ||= []).push({ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } });
  if (worksheet["A1"]) {
    worksheet["A1"].s = {
      font: { bold: true, sz: 14 },
      alignment: { horizontal: "center" },
    } as any;
  }
  if (worksheet["A2"]) {
    worksheet["A2"].s = { font: { bold: true } } as any;
  }

  worksheet["!freeze"] = { xSplit: 0, ySplit: TABLE_HEADER_OFFSET } as any;

  return worksheet;
};

const WIDTH_LIMITS: Record<string, { min: number; max: number } | number> = {
  id: { min: 14, max: 22 },
  office: { min: 14, max: 22 },
  schedule: { min: 14, max: 22 },
  name: { min: 26, max: 40 },
  numeric: { min: 10, max: 12 },
  date: 14,
  time: { min: 22, max: 36 },
  punches: { min: 22, max: 36 },
};

type BiometricsExportFilters = {
  offices: string[];
  labels: string[];
  viewLabels: string[];
  applied: boolean;
  applyToDownload: boolean;
  exportFilteredOnly: boolean;
};

type BiometricsExportMetadata = {
  exportTime: Date;
  period: string;
  columnLabels: string[];
  appVersion?: string;
};

export type BiometricsExportOptions = {
  columns: SummaryColumnKey[];
  filters: BiometricsExportFilters;
  metadata: BiometricsExportMetadata;
  fileName?: string;
  period?: { month: number; year: number } | null;
  manualResolvedTokens?: string[];
};

type PerDayColumnKey =
  | "employeeId"
  | "employeeName"
  | "office"
  | "scheduleType"
  | "scheduleSource"
  | "date"
  | "status"
  | "earliest"
  | "latest"
  | "workedMinutes"
  | "OT_pre"
  | "OT_post"
  | "OT_restday"
  | "OT_holiday"
  | "OT_excused"
  | "OT_total"
  | "ND_minutes"
  | "lateFlag"
  | "lateMinutes"
  | "undertimeFlag"
  | "undertimeMinutes"
  | "requiredMinutes"
  | "weeklyPattern"
  | "punches"
  | "sourceFiles";

type ColumnType =
  | "text"
  | "number"
  | "percent"
  | "minutes"
  | "date"
  | "time"
  | "punches";

type PerDayColumnDefinition = {
  key: PerDayColumnKey;
  label: string;
  type: ColumnType;
  width: SummaryColumnWidth | "date" | "time" | "punches";
};

const PER_DAY_COLUMNS: PerDayColumnDefinition[] = [
  { key: "employeeId", label: "Employee No", type: "text", width: "id" },
  { key: "employeeName", label: "Name", type: "text", width: "name" },
  { key: "office", label: "Office", type: "text", width: "office" },
  { key: "scheduleType", label: "Schedule", type: "text", width: "schedule" },
  { key: "scheduleSource", label: "Schedule Source", type: "text", width: "schedule" },
  { key: "date", label: "Date", type: "date", width: "date" },
  { key: "status", label: "Status", type: "text", width: "schedule" },
  { key: "earliest", label: "Earliest", type: "time", width: "time" },
  { key: "latest", label: "Latest", type: "time", width: "time" },
  { key: "workedMinutes", label: "Worked (min)", type: "minutes", width: "numeric" },
  { key: "OT_pre", label: "OT (pre)", type: "minutes", width: "numeric" },
  { key: "OT_post", label: "OT (post)", type: "minutes", width: "numeric" },
  { key: "OT_restday", label: "Rest day OT", type: "minutes", width: "numeric" },
  { key: "OT_holiday", label: "Holiday OT", type: "minutes", width: "numeric" },
  { key: "OT_excused", label: "Excused OT", type: "minutes", width: "numeric" },
  { key: "OT_total", label: "OT (min)", type: "minutes", width: "numeric" },
  { key: "ND_minutes", label: "Night diff", type: "minutes", width: "numeric" },
  { key: "lateFlag", label: "Late?", type: "text", width: "numeric" },
  { key: "lateMinutes", label: "Late (min)", type: "minutes", width: "numeric" },
  { key: "undertimeFlag", label: "Undertime?", type: "text", width: "numeric" },
  { key: "undertimeMinutes", label: "UT (min)", type: "minutes", width: "numeric" },
  { key: "requiredMinutes", label: "Required (min)", type: "minutes", width: "numeric" },
  { key: "weeklyPattern", label: "Weekly Pattern", type: "text", width: "schedule" },
  { key: "punches", label: "Punches", type: "punches", width: "punches" },
  { key: "sourceFiles", label: "Source Files", type: "punches", width: "punches" },
];

const isTotalsSupported = (type: ColumnType | SummaryColumnDefinition["type"] | undefined): type is
  | "number"
  | "minutes"
  | "percent" => type === "number" || type === "minutes" || type === "percent";

const toEmployeeKey = (token: string | null | undefined, name: string | null | undefined) =>
  `${token || ""}||${name || ""}`;

const toDisplayEmployeeId = (row: Pick<PerEmployeeRow, "employeeNo" | "employeeToken" | "identityStatus" | "resolvedEmployeeId">) => {
  const employeeNo = firstEmployeeNoToken(row.employeeNo);
  const token = row.employeeToken?.trim();
  if (row.resolvedEmployeeId) {
    return employeeNo && employeeNo.length ? employeeNo : "—";
  }
  if (row.identityStatus === "unmatched" && !row.resolvedEmployeeId) {
    return token || "";
  }
  if (employeeNo && employeeNo.length) {
    return employeeNo;
  }
  return token || "";
};

const toDisplayOffice = (
  row: Pick<PerEmployeeRow | PerDayRow, "officeName" | "resolvedEmployeeId" | "identityStatus">,
  fallbackUnmatched = false
) => {
  const label = row.officeName?.trim();
  if (label) return label;
  if (fallbackUnmatched && row.identityStatus === "unmatched" && !row.resolvedEmployeeId) {
    return UNKNOWN_OFFICE_LABEL;
  }
  if (row.resolvedEmployeeId) {
    return UNASSIGNED_OFFICE_LABEL;
  }
  return UNKNOWN_OFFICE_LABEL;
};

const toScheduleLabel = (types: string[] | undefined | null) => {
  if (!types?.length) return "";
  return types
    .map((type) => type.charAt(0) + type.slice(1).toLowerCase())
    .join(", ");
};

const toMatchStatusLabel = (
  row: Pick<PerEmployeeRow, "identityStatus" | "resolvedEmployeeId">,
  manualSolved: boolean
) => {
  const status = resolveMatchStatus(row.identityStatus, row.resolvedEmployeeId, manualSolved);
  switch (status) {
    case "matched":
      return "Matched";
    case "solved":
      return "Solved";
    default:
      return "Unmatched";
  }
};

const toLocalISO = (value: Date) => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  const hours = `${value.getHours()}`.padStart(2, "0");
  const minutes = `${value.getMinutes()}`.padStart(2, "0");
  const seconds = `${value.getSeconds()}`.padStart(2, "0");
  const offsetMinutes = value.getTimezoneOffset();
  const offsetSign = offsetMinutes > 0 ? "-" : "+";
  const absMinutes = Math.abs(offsetMinutes);
  const offsetHoursPart = `${Math.floor(absMinutes / 60)}`.padStart(2, "0");
  const offsetMinutesPart = `${absMinutes % 60}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offsetSign}${offsetHoursPart}:${offsetMinutesPart}`;
};

const EXCEL_DATE_EPOCH = Date.UTC(1899, 11, 30);

const toExcelDateNumber = (iso: string | null | undefined) => {
  if (!iso) return null;
  const [yearStr, monthStr, dayStr] = iso.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const utc = Date.UTC(year, month - 1, day);
  return (utc - EXCEL_DATE_EPOCH) / 86_400_000;
};

const toExcelTimeNumber = (value: string | null | undefined) => {
  if (!value) return null;
  const [hoursStr, minutesStr] = value.split(":");
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return (hours * 60 + minutes) / 1440;
};

const ensureArray = <T,>(values: T[] | null | undefined): T[] => (Array.isArray(values) ? values : []);

const computeSummaryRow = (
  row: PerEmployeeRow,
  sourceFileCounts: Map<string, number>,
  manualResolvedTokens?: Set<string>
): SummaryRowValues => {
  const key = toEmployeeKey(row.employeeToken, row.employeeName);
  const normalizedToken = normalizeBiometricToken(row.employeeToken ?? row.employeeId ?? "");
  const manualSolved = normalizedToken
    ? manualResolvedTokens?.has(normalizedToken) ?? false
    : false;
  const sourceLabel = formatScheduleSource(row.scheduleSource) ?? "";
  return {
    employeeId: toDisplayEmployeeId(row) || null,
    employeeName: row.employeeName?.trim() ? row.employeeName : UNMATCHED_LABEL,
    office: toDisplayOffice(row, true),
    schedule: toScheduleLabel(row.scheduleTypes),
    matchStatus: toMatchStatusLabel(row, manualSolved),
    source: sourceLabel,
    head: row.isHead == null ? null : row.isHead ? "Yes" : "No",
    days: row.daysWithLogs ?? 0,
    noPunchDays: row.noPunchDays ?? 0,
    absences: row.absences ?? 0,
    excusedDays: row.excusedDays ?? 0,
    lateDays: row.lateDays ?? 0,
    undertimeDays: row.undertimeDays ?? 0,
    latePercent: typeof row.lateRate === "number" ? row.lateRate / 100 : null,
    undertimePercent: typeof row.undertimeRate === "number" ? row.undertimeRate / 100 : null,
    lateMinutes: row.totalLateMinutes ?? 0,
    undertimeMinutes: row.totalUndertimeMinutes ?? 0,
    otTotalMinutes: row.totalOTMinutes ?? 0,
    otPreMinutes: row.totalOTPreMinutes ?? 0,
    otPostMinutes: row.totalOTPostMinutes ?? 0,
    otRestdayMinutes: row.totalOTRestdayMinutes ?? 0,
    otHolidayMinutes: row.totalOTHolidayMinutes ?? 0,
    otExcusedMinutes: row.totalOTExcusedMinutes ?? 0,
    nightDiffMinutes: row.totalNightDiffMinutes ?? 0,
    resolvedEmployeeId: row.resolvedEmployeeId?.trim() || null,
    resolvedAt: null,
    sourceFilesCount: sourceFileCounts.get(key) ?? null,
  } as SummaryRowValues;
};

const summarizeTotals = (rows: SummaryRowValues[]): SummaryTotals => {
  const totals: SummaryTotals = {};
  let totalDays = 0;
  let totalLateDays = 0;
  let totalNoPunchDays = 0;
  let totalAbsences = 0;
  let totalExcusedDays = 0;
  let totalUndertimeDays = 0;
  let totalLateMinutes = 0;
  let totalUndertimeMinutes = 0;
  let totalOTMinutes = 0;
  let totalOTPreMinutes = 0;
  let totalOTPostMinutes = 0;
  let totalOTRestdayMinutes = 0;
  let totalOTHolidayMinutes = 0;
  let totalOTExcusedMinutes = 0;
  let totalNightDiffMinutes = 0;
  let totalSourceFiles = 0;

  for (const row of rows) {
    totalDays += Number(row.days ?? 0);
    totalNoPunchDays += Number(row.noPunchDays ?? 0);
    totalAbsences += Number(row.absences ?? 0);
    totalExcusedDays += Number(row.excusedDays ?? 0);
    totalLateDays += Number(row.lateDays ?? 0);
    totalUndertimeDays += Number(row.undertimeDays ?? 0);
    totalLateMinutes += Number(row.lateMinutes ?? 0);
    totalUndertimeMinutes += Number(row.undertimeMinutes ?? 0);
    totalOTMinutes += Number(row.otTotalMinutes ?? 0);
    totalOTPreMinutes += Number(row.otPreMinutes ?? 0);
    totalOTPostMinutes += Number(row.otPostMinutes ?? 0);
    totalOTRestdayMinutes += Number(row.otRestdayMinutes ?? 0);
    totalOTHolidayMinutes += Number(row.otHolidayMinutes ?? 0);
    totalOTExcusedMinutes += Number(row.otExcusedMinutes ?? 0);
    totalNightDiffMinutes += Number(row.nightDiffMinutes ?? 0);
    totalSourceFiles += Number(row.sourceFilesCount ?? 0);
  }

  totals.days = totalDays;
  totals.noPunchDays = totalNoPunchDays;
  totals.absences = totalAbsences;
  totals.lateDays = totalLateDays;
  totals.excusedDays = totalExcusedDays;
  totals.undertimeDays = totalUndertimeDays;
  totals.lateMinutes = totalLateMinutes;
  totals.undertimeMinutes = totalUndertimeMinutes;
  totals.otTotalMinutes = totalOTMinutes;
  totals.otPreMinutes = totalOTPreMinutes;
  totals.otPostMinutes = totalOTPostMinutes;
  totals.otRestdayMinutes = totalOTRestdayMinutes;
  totals.otHolidayMinutes = totalOTHolidayMinutes;
  totals.otExcusedMinutes = totalOTExcusedMinutes;
  totals.nightDiffMinutes = totalNightDiffMinutes;
  totals.sourceFilesCount = totalSourceFiles;
  totals.latePercent = totalDays > 0 ? totalLateDays / totalDays : null;
  totals.undertimePercent = totalDays > 0 ? totalUndertimeDays / totalDays : null;

  return totals;
};

const getWidthLimit = (category: SummaryColumnWidth | "date" | "time" | "punches" | undefined) => {
  if (!category) return { min: 10, max: 18 };
  const limits = WIDTH_LIMITS[category];
  if (typeof limits === "number") {
    return { min: limits, max: limits };
  }
  return limits;
};

const computeDisplayLength = (
  value: SummaryCellValue,
  type: ColumnType | SummaryColumnDefinition["type"] | undefined
): number => {
  if (value == null) return 0;
  if (type === "percent") {
    return `${((value as number) * 100).toFixed(1)}%`.length;
  }
  if (type === "minutes") {
    return `${value} min`.length;
  }
  if (type === "number") {
    return `${value}`.length;
  }
  if (type === "date") {
    return "Sep 30, 2024".length; // matches "mmm d, yyyy"
  }
  if (type === "time") {
    return "00:00".length;
  }
  if (type === "punches") {
    return String(value).length;
  }
  return String(value).length;
};

const applyHeaderStyles = (
  sheet: XLSX.WorkSheet,
  headerLength: number,
  rowOffset = 0
) => {
  for (let columnIndex = 0; columnIndex < headerLength; columnIndex += 1) {
    const address = XLSX.utils.encode_cell({ r: rowOffset, c: columnIndex });
    const cell = sheet[address] as XLSX.CellObject & { s?: any };
    if (!cell) continue;
    cell.s = {
      font: { bold: true, sz: 12, color: { rgb: HEADER_FONT_COLOR } },
      alignment: { horizontal: "left", vertical: "center", wrapText: true },
      fill: { patternType: "solid", fgColor: { rgb: HEADER_FILL_COLOR } },
      border: {
        top: { style: "thin", color: { rgb: BORDER_COLOR } },
        bottom: { style: "thin", color: { rgb: BORDER_COLOR } },
        left: { style: "thin", color: { rgb: BORDER_COLOR } },
        right: { style: "thin", color: { rgb: BORDER_COLOR } },
      },
    };
  }
};

type StyleColumnContext = {
  type: ColumnType | SummaryColumnDefinition["type"] | undefined;
  width?: SummaryColumnWidth | "date" | "time" | "punches";
};

const applyDataStyles = (
  sheet: XLSX.WorkSheet,
  columns: StyleColumnContext[],
  dataRowStart: number,
  totalsRowIndex: number | null,
  zebraStart?: number
) => {
  if (!sheet["!ref"]) return;
  const range = XLSX.utils.decode_range(sheet["!ref"] as string);
  const zebraOrigin = zebraStart ?? dataRowStart;
  for (let rowIndex = dataRowStart; rowIndex <= range.e.r; rowIndex += 1) {
    const isTotalsRow = totalsRowIndex != null && rowIndex === totalsRowIndex;
    const zebra = (rowIndex - zebraOrigin) % 2 === 0;
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const cell = sheet[address] as XLSX.CellObject & { s?: any };
      if (!cell) continue;
      const columnInfo = columns[columnIndex] ?? {};
      const columnType = columnInfo.type;
      const isNumeric = columnType === "number" || columnType === "minutes" || columnType === "percent";
      const isTime = columnType === "time";
      const isDate = columnType === "date";
      const style: any = cell.s || {};
      const shouldWrap =
        columnType === "punches" ||
        columnInfo.width === "schedule" ||
        columnInfo.width === "punches";
      style.alignment = {
        ...(style.alignment || {}),
        horizontal: isNumeric || isTime || isDate ? "right" : "left",
        vertical: "center",
        wrapText: shouldWrap,
      };
      if (typeof cell.v === "string") {
        style.alignment = { ...(style.alignment || {}), horizontal: "left" };
      }
      if (isNumeric) {
        if (columnType === "minutes") {
          style.numFmt = '0" min"';
        } else if (columnType === "percent") {
          style.numFmt = "0.0%";
        }
      }
      if (isTime) {
        style.numFmt = "hh:mm";
      }
      if (isDate) {
        style.numFmt = "mmm d, yyyy";
      }
      if (!isTotalsRow && zebra) {
        style.fill = { patternType: "solid", fgColor: { rgb: ROW_BAND_COLOR } };
      }
      if (isTotalsRow) {
        style.font = { ...(style.font || {}), bold: true };
        style.border = {
          top: { style: "thin", color: { rgb: BORDER_COLOR } },
          bottom: { style: "thin", color: { rgb: BORDER_COLOR } },
          left: { style: "thin", color: { rgb: BORDER_COLOR } },
          right: { style: "thin", color: { rgb: BORDER_COLOR } },
        };
      }
      cell.s = style;
    }
  }
};

const clampWidth = (category: SummaryColumnWidth | "date" | "time" | "punches" | undefined, length: number) => {
  const limits = getWidthLimit(category);
  const maxLength = Math.max(limits.min, length + 2);
  return Math.min(Math.max(maxLength, limits.min), limits.max);
};

const buildSummarySheet = (
  rows: SummaryRowValues[],
  columns: SummaryColumnKey[],
  definitions: Map<SummaryColumnKey, SummaryColumnContext>,
  totals: SummaryTotals,
  period: ExportPeriod,
  timestamp: TimestampInfo
) => {
  const headerLabels = columns.map(
    (key) => definitions.get(key)?.definition?.label ?? SUMMARY_COLUMN_DEFINITION_MAP[key]?.label ?? key
  );
  const dataRows = rows.map((row) => columns.map((key) => row[key] ?? null));
  const totalsRow: SummaryCellValue[] = columns.map((key, index) => {
    const context = definitions.get(key);
    if (index === 0) return "Totals";
    if (!context || !isTotalsSupported(context.type)) return null;
    return totals[key] ?? null;
  });

  const dataAoA = [headerLabels, ...dataRows, totalsRow];
  const worksheet = buildSheet(dataAoA, "Per-Employee Summary", period, timestamp);

  const columnContexts: StyleColumnContext[] = columns.map((key) => ({
    type: definitions.get(key)?.type,
    width: definitions.get(key)?.width,
  }));

  const columnWidths = columns.map((key, index) => {
    const context = definitions.get(key);
    const type = context?.type as ColumnType | undefined;
    const headerLength = computeDisplayLength(headerLabels[index] ?? "", "text");
    const lengths: number[] = rows.map((row) => computeDisplayLength(row[key] ?? null, type));
    const totalsLength = computeDisplayLength(totals[key] ?? null, type);
    if (totalsLength > 0) lengths.push(totalsLength);
    const dataLength = lengths.length ? Math.max(...lengths) : 0;
    const length = Math.max(headerLength, dataLength);
    return { wch: clampWidth(context?.width, length) };
  });

  (worksheet as any)["!cols"] = columnWidths;

  const headerRowIndex = TABLE_HEADER_OFFSET;
  const firstDataRowIndex = headerRowIndex + 1;
  const totalsRowIndex = firstDataRowIndex + dataRows.length;

  if (headerLabels.length) {
    const filterRange = XLSX.utils.encode_range({
      s: { r: headerRowIndex, c: 0 },
      e: { r: totalsRowIndex, c: headerLabels.length - 1 },
    });
    (worksheet as any)["!autofilter"] = { ref: filterRange };
  }

  applyHeaderStyles(worksheet, columns.length, headerRowIndex);
  applyDataStyles(worksheet, columnContexts, firstDataRowIndex, totalsRowIndex, firstDataRowIndex);

  return worksheet;
};

const buildPerDaySheet = (
  rows: PerDayRow[],
  period: ExportPeriod,
  timestamp: TimestampInfo
) => {
  const header = PER_DAY_COLUMNS.map((column) => column.label);

  const dataRows = rows.map((row) => {
    const evaluationStatus: DayEvaluationStatus = row.evaluationStatus
      ? row.evaluationStatus
      : row.status === "no_punch" || row.status === "excused" || row.status === "evaluated"
      ? (row.status as DayEvaluationStatus)
      : row.earliest || row.latest || (row.allTimes?.length ?? 0) > 0
      ? "evaluated"
      : "no_punch";

    return PER_DAY_COLUMNS.map((column) => {
      switch (column.key) {
        case "employeeId": {
          const employeeNo = firstEmployeeNoToken(row.employeeNo);
          if (row.resolvedEmployeeId) {
            return employeeNo && employeeNo.length ? employeeNo : "—";
          }
          if (row.identityStatus === "unmatched" && !row.resolvedEmployeeId) {
            return row.employeeToken || row.employeeId || "";
          }
          if (employeeNo && employeeNo.length) {
            return employeeNo;
          }
          return row.employeeToken || row.employeeId || "";
        }
        case "employeeName":
          return row.employeeName?.trim() ? row.employeeName : UNMATCHED_LABEL;
        case "office":
          return toDisplayOffice(row, true);
        case "scheduleType":
          return row.scheduleType ? row.scheduleType.charAt(0) + row.scheduleType.slice(1).toLowerCase() : "";
        case "scheduleSource":
          return formatScheduleSource(row.scheduleSource) ?? "";
        case "date":
          return toExcelDateNumber(row.dateISO);
        case "status": {
          if (typeof row.status === "string" && row.status.length) {
            return row.status;
          }
          if (evaluationStatus === "excused") return "Excused";
          return row.absent ? "Absent" : "Present";
        }
        case "earliest":
          return toExcelTimeNumber(row.earliest ?? null);
        case "latest":
          return toExcelTimeNumber(row.latest ?? null);
        case "workedMinutes":
          return row.workedMinutes ?? null;
        case "OT_pre":
          return row.OT_pre ?? null;
        case "OT_post":
          return row.OT_post ?? null;
        case "OT_restday":
          return row.OT_restday ?? null;
        case "OT_holiday":
          return row.OT_holiday ?? null;
        case "OT_excused":
          return row.OT_excused ?? null;
        case "OT_total":
          return row.OT_total ?? null;
        case "ND_minutes":
          return row.ND_minutes ?? null;
        case "lateFlag": {
          if (evaluationStatus === "no_punch") return "No punches";
          if (evaluationStatus === "excused") return "Excused";
          return row.isLate ? "Yes" : "No";
        }
        case "lateMinutes":
          return resolveLateMinutes(row) ?? null;
        case "undertimeFlag": {
          if (evaluationStatus === "no_punch") return "No punches";
          if (evaluationStatus === "excused") return "Excused";
          return row.isUndertime ? "Yes" : "No";
        }
        case "undertimeMinutes":
          return resolveUndertimeMinutes(row) ?? null;
        case "requiredMinutes":
          return row.requiredMinutes ?? null;
        case "weeklyPattern":
          return row.weeklyPatternApplied ? "Applied" : "—";
        case "punches":
          return row.allTimes?.length
            ? row.allTimes.join(", ")
            : evaluationStatus === "no_punch"
            ? "No punches"
            : "";
        case "sourceFiles":
          return row.sourceFiles?.length ? row.sourceFiles.join(", ") : "";
        default:
          return "";
      }
    });
  });

  const dataAoA = [header, ...dataRows];
  const worksheet = buildSheet(dataAoA, "Per-Day Detail", period, timestamp);

  const columnWidths = PER_DAY_COLUMNS.map((column, columnIndex) => {
    const type = column.type;
    const headerLength = computeDisplayLength(header[columnIndex], "text");
    const lengths = dataRows.map((row) => computeDisplayLength(row[columnIndex] ?? null, type));
    const dataLength = lengths.length ? Math.max(...lengths) : 0;
    const length = Math.max(headerLength, dataLength);
    return { wch: clampWidth(column.width, length) };
  });

  (worksheet as any)["!cols"] = columnWidths;
  (worksheet as any)["!freeze"] = {
    ySplit: 1,
    xSplit: 0,
    topLeftCell: "A2",
    activePane: "bottomLeft",
    state: "frozen",
  };

  if (worksheet["!ref"]) {
    (worksheet as any)["!autofilter"] = { ref: worksheet["!ref"] };
  }

  const columnContexts: StyleColumnContext[] = PER_DAY_COLUMNS.map((column) => ({
    width: column.width,
    type: column.type,
  }));
  const headerRowIndex = TABLE_HEADER_OFFSET;
  const firstDataRowIndex = headerRowIndex + 1;
  const lastRowIndex = dataRows.length ? firstDataRowIndex + dataRows.length - 1 : headerRowIndex;

  if (header.length) {
    const filterRange = XLSX.utils.encode_range({
      s: { r: headerRowIndex, c: 0 },
      e: { r: Math.max(lastRowIndex, headerRowIndex), c: header.length - 1 },
    });
    (worksheet as any)["!autofilter"] = { ref: filterRange };
  }

  applyHeaderStyles(worksheet, PER_DAY_COLUMNS.length, headerRowIndex);
  applyDataStyles(worksheet, columnContexts, firstDataRowIndex, null, firstDataRowIndex);

  return worksheet;
};

const buildMetadataSheet = (
  options: BiometricsExportOptions,
  period: ExportPeriod,
  timestamp: TimestampInfo
) => {
  const { metadata, filters } = options;
  const rows: Array<[string, string]> = [
    ["Exported At", toLocalISO(metadata.exportTime)],
    ["Period", metadata.period || "—"],
    [
      "Office filters (view)",
      filters.applied && filters.viewLabels.length ? filters.viewLabels.join(", ") : "All offices",
    ],
    [
      "Office filters (export)",
      filters.applyToDownload && filters.labels.length ? filters.labels.join(", ") : "All offices",
    ],
    ["Export filtered only", filters.exportFilteredOnly ? "Yes" : "No"],
    ["Column selection", metadata.columnLabels.length ? metadata.columnLabels.join(", ") : "Default"],
    [
      "Weekly exclusions",
      "Excused days are excluded from Late/UT totals; see the Excused days column.",
    ],
    ["App version", metadata.appVersion || "—"],
  ];

  const dataAoA: any[][] = [["Field", "Value"], ...rows];
  const worksheet = buildSheet(dataAoA, "Export Metadata", period, timestamp);

  const headerRowIndex = TABLE_HEADER_OFFSET;
  const firstDataRowIndex = headerRowIndex + 1;

  (worksheet as any)["!cols"] = [{ wch: 26 }, { wch: 60 }];

  applyHeaderStyles(worksheet, 2, headerRowIndex);
  applyDataStyles(
    worksheet,
    [
      { width: "schedule", type: "text" },
      { width: "punches", type: "text" },
    ],
    firstDataRowIndex,
    null,
    firstDataRowIndex
  );

  return worksheet;
};

const buildSourceFileCounts = (perDay: PerDayRow[]) => {
  const map = new Map<string, Set<string>>();
  for (const row of perDay) {
    const key = toEmployeeKey(row.employeeToken || row.employeeId || row.employeeName, row.employeeName);
    if (!map.has(key)) {
      map.set(key, new Set());
    }
    const set = map.get(key)!;
    for (const file of ensureArray(row.sourceFiles)) {
      set.add(file);
    }
  }
  const counts = new Map<string, number>();
  for (const [key, set] of map.entries()) {
    counts.set(key, set.size);
  }
  return counts;
};

const makeSummaryColumnDefinitions = (columns: SummaryColumnKey[]) => {
  const map = new Map<SummaryColumnKey, SummaryColumnContext>();
  for (const key of columns) {
    const definition = SUMMARY_COLUMN_DEFINITION_MAP[key] ?? null;
    map.set(key, {
      definition,
      width: definition?.width,
      type: definition?.type,
    });
  }
  return map;
};

export function exportResultsToXlsx(
  perEmployee: PerEmployeeRow[],
  perDay: PerDayRow[],
  options: BiometricsExportOptions
) {
  const selectedColumns = options.columns?.length
    ? options.columns.filter((key): key is SummaryColumnKey => key in SUMMARY_COLUMN_DEFINITION_MAP)
    : DEFAULT_SUMMARY_SELECTED_COLUMNS;

  const columnDefinitions = makeSummaryColumnDefinitions(selectedColumns);
  const sourceFileCounts = buildSourceFileCounts(perDay);
  const manualResolvedSet = new Set(
    (options.manualResolvedTokens ?? [])
      .map((token) => normalizeBiometricToken(token))
      .filter((token) => token.length > 0)
  );
  const summaryRows = perEmployee.map((row) =>
    computeSummaryRow(row, sourceFileCounts, manualResolvedSet)
  );
  const totals = summarizeTotals(summaryRows);

  const period = options.period ?? null;
  const timestampInfo = fmtTs(options.metadata.exportTime);
  const summarySheet = buildSummarySheet(
    summaryRows,
    selectedColumns,
    columnDefinitions,
    totals,
    period,
    timestampInfo
  );
  const perDaySheet = buildPerDaySheet(sortPerDayRows([...perDay]), period, timestampInfo);
  const metadataSheet = buildMetadataSheet(options, period, timestampInfo);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, summarySheet, SUMMARY_SHEET_NAME);
  XLSX.utils.book_append_sheet(workbook, perDaySheet, PER_DAY_SHEET_NAME);
  XLSX.utils.book_append_sheet(workbook, metadataSheet, METADATA_SHEET_NAME);

  const { file } = timestampInfo;
  const { fileSegment } = periodLabel(period);
  const sanitizedSegment = fileSegment.replace(/\s+/g, "_");
  const defaultFileName = `HRPS_${sanitizedSegment}_${file}.xlsx`;
  const filename = options.fileName ?? defaultFileName;
  XLSX.writeFile(workbook, filename, { compression: true });
}
