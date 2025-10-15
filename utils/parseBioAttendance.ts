import * as XLSX from "xlsx";
import type { WorkBook } from "xlsx";

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
  isLate: boolean;
  isUndertime: boolean;
  workedHHMM?: string | null;
  scheduleType?: string;
  scheduleSource?: string;
};

export type PerEmployeeRow = {
  employeeId: string;
  employeeName: string;
  resolvedEmployeeId?: string | null;
  officeId?: string | null;
  officeName?: string | null;
  daysWithLogs: number;
  lateDays: number;
  undertimeDays: number;
  lateRate: number;
  undertimeRate: number;
  scheduleTypes?: string[];
  scheduleSource?: string;
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

export function exportResultsToXlsx(perEmployee: PerEmployeeRow[], perDay: PerDayRow[]) {
  const wb = XLSX.utils.book_new();
  const sortedPerEmployee = [...perEmployee].sort((a, b) => {
    const nameDiff = (a.employeeName || "").localeCompare(b.employeeName || "");
    if (nameDiff !== 0) return nameDiff;
    return (a.employeeId || "").localeCompare(b.employeeId || "");
  });
  const s1 = XLSX.utils.json_to_sheet(
    sortedPerEmployee.map((r) => ({
      EmployeeID: r.employeeId,
      EmployeeName: r.employeeName,
      Office: r.officeName ?? "",
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

  const sortedPerDay = sortPerDayRows([...perDay]);
  const s2 = XLSX.utils.json_to_sheet(
    sortedPerDay.map((r) => ({
      EmployeeID: r.employeeId,
      EmployeeName: r.employeeName,
      Office: r.officeName ?? "",
      Date: r.dateISO,
      Day: r.day,
      Earliest: r.earliest ?? "",
      Latest: r.latest ?? "",
      Worked: r.workedHHMM ?? "",
      ScheduleType: r.scheduleType ?? "",
      IsLate: r.isLate ? "Yes" : "No",
      IsUndertime: r.isUndertime ? "Yes" : "No",
      Sources: r.sourceFiles.join(", "),
      Punches: r.allTimes.join(", "),
      ScheduleSource: r.scheduleSource ?? "",
    }))
  );
  XLSX.utils.book_append_sheet(wb, s2, "PerDay");

  XLSX.writeFile(wb, "biometrics_results.xlsx");
}

type AggregateRow = {
  employeeId: string;
  employeeName: string;
  resolvedEmployeeId?: string | null;
  officeId?: string | null;
  officeName?: string | null;
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
  const index = SOURCE_PRIORITY.indexOf(value as typeof SOURCE_PRIORITY[number]);
  return index === -1 ? SOURCE_PRIORITY.length : index;
};

const pickSource = (sources: string[]) => {
  if (!sources.length) return "DEFAULT";
  return sources.sort((a, b) => sourceRank(a) - sourceRank(b))[0] ?? "DEFAULT";
};

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
      | "employeeName"
      | "resolvedEmployeeId"
      | "officeId"
      | "officeName"
      | "earliest"
      | "latest"
      | "allTimes"
      | "isLate"
      | "isUndertime"
      | "scheduleType"
      | "scheduleSource"
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
        resolvedEmployeeId: row.resolvedEmployeeId ?? null,
        officeId: row.officeId ?? null,
        officeName: row.officeName ?? null,
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
    if (!agg.officeId && row.officeId) agg.officeId = row.officeId;
    if (!agg.officeName && row.officeName) agg.officeName = row.officeName;
    if (!agg.resolvedEmployeeId && row.resolvedEmployeeId) {
      agg.resolvedEmployeeId = row.resolvedEmployeeId;
    }
    const hasLogs = Boolean(row.earliest || row.latest || (row.allTimes?.length ?? 0) > 0);
    if (hasLogs) {
      agg.daysWithLogs += 1;
      if (row.isLate) agg.lateDays += 1;
      if (row.isUndertime) agg.undertimeDays += 1;
    }
    if (row.scheduleType) agg.scheduleTypes.add(row.scheduleType);
    if (row.scheduleSource) agg.scheduleSourceSet.add(row.scheduleSource);
  }

  return Array.from(map.values()).map((entry) => ({
    employeeId: entry.employeeId,
    employeeName: entry.employeeName,
    resolvedEmployeeId: entry.resolvedEmployeeId ?? null,
    officeId: entry.officeId ?? null,
    officeName: entry.officeName ?? null,
    daysWithLogs: entry.daysWithLogs,
    lateDays: entry.lateDays,
    undertimeDays: entry.undertimeDays,
    lateRate: entry.daysWithLogs ? +((entry.lateDays / entry.daysWithLogs) * 100).toFixed(1) : 0,
    undertimeRate: entry.daysWithLogs ? +((entry.undertimeDays / entry.daysWithLogs) * 100).toFixed(1) : 0,
    scheduleTypes: Array.from(entry.scheduleTypes).sort(),
    scheduleSource: pickSource(Array.from(entry.scheduleSourceSet)),
  }));
}
