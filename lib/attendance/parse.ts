import * as XLSX from "xlsx";
import { BioSource, RawRecord } from "./types";

export type ParseResult = {
  records: RawRecord[];
  month: string;
  inferred: boolean;
  rows: number;
  distinctBio: number;
  dates: string[];
};

export type ParseOptions = {
  filename?: string;
  monthHint?: string;
  bioSource: BioSource;
};

const RX_USER = /^User\s*ID\s*:\s*(\d+)/i;
const RX_USER_LABEL = /^User\s*ID\s*:?\s*\$/i;
const RX_BIO_VALUE = /^\d{3,}$/;
const RX_NAME = /^Name\s*:\s*(.+)$/i;
const RX_DEPT = /^Department\s*:\s*(.+)$/i;
const RX_DAY = /^(0?[1-9]|[12]\d|3[01])$/;
const RX_YEAR_MONTH = /(20\d{2})[-/_\s]*(0?[1-9]|1[0-2])/;
const RX_MONTH_YEAR = /(0?[1-9]|1[0-2])[-/_\s]*(20\d{2})/;
const RX_MONTH_NAME = /(January|February|March|April|May|June|July|August|September|October|November|December)[^0-9]*(20\d{2})/i;

const MONTH_NAME_TO_NUMBER: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

const EMPTY_RESULT: ParseResult = {
  records: [],
  month: "",
  inferred: false,
  rows: 0,
  distinctBio: 0,
  dates: [],
};

export function norm(value: any): string {
  return (value ?? "").toString().trim();
}

export function splitTimes(val: any): string[] {
  return norm(val)
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => /^\d{2}:\d{2}$/.test(t));
}

export function yyyymmdd(month: string, day: number): string {
  return `${month}-${String(day).padStart(2, "0")}`;
}

function dedupeTimes(times: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const time of times) {
    if (!seen.has(time)) {
      seen.add(time);
      ordered.push(time);
    }
  }
  return ordered;
}

function columnLetterToIndex(letter: string): number {
  if (!letter) return -1;
  let result = 0;
  const trimmed = letter.trim().toUpperCase();
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    if (code < 65 || code > 90) {
      return -1;
    }
    result = result * 26 + (code - 64);
  }
  return result - 1;
}

function toDateString(value: any): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = value.getMonth() + 1;
    const d = value.getDate();
    return `${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}-${d
      .toString()
      .padStart(2, "0")}`;
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value, { date1904: false });
    if (!parsed) return null;
    const y = parsed.y || 0;
    const m = (parsed.m || 1) - 1;
    const d = parsed.d || 1;
    if (y === 0) {
      return null;
    }
    const date = new Date(Date.UTC(y, m, d));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
      date.getUTCDate()
    ).padStart(2, "0")}`;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/(\d{4})[-\/]?(\d{2})[-\/]?(\d{2})/);
    if (match) {
      const [, y, m, d] = match;
      return `${y}-${m}-${d}`;
    }
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(
        parsed.getDate()
      ).padStart(2, "0")}`;
    }
  }
  return null;
}

function extractTimes(value: any): string[] {
  if (value == null) return [];
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value, { date1904: false });
    if (!parsed) return [];
    const totalMinutes = (parsed.H || 0) * 60 + (parsed.M || 0);
    if (Number.isNaN(totalMinutes)) return [];
    const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const mm = String(totalMinutes % 60).padStart(2, "0");
    return [`${hh}:${mm}`];
  }
  return splitTimes(value);
}

function cellText(ws: XLSX.WorkSheet, r: number, c: number): string {
  const address = XLSX.utils.encode_cell({ r, c });
  const cell = ws[address];
  if (!cell) return "";
  if (cell.w != null) return norm(cell.w);
  return norm(cell.v);
}

function extractMonthFromText(text: string): string | undefined {
  const numericYearMonth = RX_YEAR_MONTH.exec(text);
  if (numericYearMonth) {
    const year = numericYearMonth[1];
    const month = numericYearMonth[2].padStart(2, "0");
    return `${year}-${month}`;
  }
  const numericMonthYear = RX_MONTH_YEAR.exec(text);
  if (numericMonthYear) {
    const month = numericMonthYear[1].padStart(2, "0");
    const year = numericMonthYear[2];
    return `${year}-${month}`;
  }
  const nameMatch = RX_MONTH_NAME.exec(text);
  if (nameMatch) {
    const monthName = nameMatch[1].toLowerCase();
    const year = nameMatch[2];
    const month = MONTH_NAME_TO_NUMBER[monthName];
    if (month) {
      return `${year}-${month}`;
    }
  }
  return undefined;
}

export function detectMonthFromSheet(ws: XLSX.WorkSheet): string | undefined {
  const ref = ws["!ref"];
  if (!ref) return undefined;
  const range = XLSX.utils.decode_range(ref);
  const maxRow = Math.min(range.e.r, range.s.r + 15);
  const maxCol = Math.min(range.e.c, range.s.c + 10);

  for (let r = range.s.r; r <= maxRow; r++) {
    for (let c = range.s.c; c <= maxCol; c++) {
      const text = cellText(ws, r, c);
      if (!text) continue;
      const month = extractMonthFromText(text);
      if (month) {
        return month;
      }
    }
  }
  return undefined;
}

type Anchor = { r: number; c: number; valueCol: number; bio: string };

type DayColumn = { col: number; day: number };

function buildTextMatrix(ws: XLSX.WorkSheet, range: XLSX.Range): string[][] {
  const text: string[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    text[r] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      text[r][c] = cellText(ws, r, c);
    }
  }
  return text;
}

function findAnchors(range: XLSX.Range, text: string[][]): Anchor[] {
  const anchors: Anchor[] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const value = text[r]?.[c] ?? "";
      if (!value) continue;
      const inline = RX_USER.exec(value);
      if (inline) {
        anchors.push({ r, c, valueCol: c, bio: inline[1] });
        continue;
      }
      if (RX_USER_LABEL.test(value)) {
        const right = text[r]?.[c + 1] ?? "";
        if (RX_BIO_VALUE.test(right)) {
          anchors.push({ r, c, valueCol: c + 1, bio: right });
        }
      }
    }
  }
  return anchors;
}

function scanForInfo(
  text: string[][],
  range: XLSX.Range,
  anchor: Anchor,
  regex: RegExp
): string | undefined {
  const startCol = Math.min(anchor.c, anchor.valueCol);
  const endCol = Math.min(range.e.c, startCol + 10);
  const maxRow = Math.min(range.e.r, anchor.r + 2);
  for (let r = anchor.r; r <= maxRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const value = text[r]?.[c] ?? "";
      if (!value) continue;
      const match = regex.exec(value);
      if (match) {
        return match[1].trim();
      }
    }
  }
  return undefined;
}

function findDayHeaderRow(range: XLSX.Range, text: string[][], anchor: Anchor): number | undefined {
  const startRow = anchor.r + 1;
  const endRow = Math.min(range.e.r, anchor.r + 4);
  for (let r = startRow; r <= endRow; r++) {
    let dayCount = 0;
    for (let c = range.s.c; c <= range.e.c; c++) {
      if (RX_DAY.test(text[r]?.[c] ?? "")) {
        dayCount += 1;
      }
    }
    if (dayCount >= 5) {
      return r;
    }
  }
  return undefined;
}

function collectDayColumns(range: XLSX.Range, text: string[][], dayRow: number): DayColumn[] {
  const columns: DayColumn[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const value = text[dayRow]?.[c] ?? "";
    if (!value) continue;
    if (RX_DAY.test(value)) {
      const day = Number(value);
      columns.push({ col: c, day });
    }
  }
  return columns;
}

function buildDate(month: string, day: number): string {
  return `${month}-${String(day).padStart(2, "0")}`;
}

export function parseBlockSheet(ws: XLSX.WorkSheet, month: string): RawRecord[] {
  if (!month) return [];
  const ref = ws["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const text = buildTextMatrix(ws, range);
  const anchors = findAnchors(range, text);
  const records: RawRecord[] = [];

  for (const anchor of anchors) {
    if (!RX_BIO_VALUE.test(anchor.bio)) {
      continue;
    }

    const name = scanForInfo(text, range, anchor, RX_NAME) ?? undefined;
    const dept = scanForInfo(text, range, anchor, RX_DEPT) ?? undefined;
    const dayRow = findDayHeaderRow(range, text, anchor);
    if (dayRow == null) {
      continue;
    }

    const dayColumns = collectDayColumns(range, text, dayRow);
    if (!dayColumns.length) {
      continue;
    }

    const punches = dayColumns
      .map(({ col, day }) => {
        const row1 = text[dayRow + 1]?.[col] ?? "";
        const row2 = text[dayRow + 2]?.[col] ?? "";
        const merged = dedupeTimes([...splitTimes(row1), ...splitTimes(row2)]);
        if (!merged.length) {
          return null;
        }
        return {
          date: buildDate(month, day),
          times: merged,
        };
      })
      .filter((entry): entry is { date: string; times: string[] } => entry !== null);

    records.push({
      bioUserId: anchor.bio,
      name,
      officeHint: dept,
      punches,
    });
  }

  records.sort((a, b) => a.bioUserId.localeCompare(b.bioUserId));
  return records;
}

export function parseColumnSheet(
  ws: XLSX.WorkSheet,
  columnLetter: string
): { records: RawRecord[]; dates: string[]; rows: number } {
  const columnIndex = columnLetterToIndex(columnLetter);
  if (columnIndex < 0) {
    return { records: [], dates: [], rows: 0 };
  }

  const rows = XLSX.utils.sheet_to_json<any[]>(ws, {
    header: 1,
    raw: true,
    defval: "",
  });

  if (!rows.length) {
    return { records: [], dates: [], rows: 0 };
  }

  const headerRow = rows[0].map((cell) => norm(cell));
  const dataRows = rows.slice(1);

  const nameColumn = headerRow.findIndex((cell) => /name/i.test(cell));
  const officeColumn = headerRow.findIndex((cell) => /(office|dept|department)/i.test(cell));
  const dateColumn = headerRow.findIndex((cell) => /date/i.test(cell));
  const timeColumns = headerRow
    .map((cell, idx) => (/(time|in|out|punch)/i.test(cell) ? idx : -1))
    .filter((idx) => idx >= 0);

  const skip = new Set<number>([columnIndex]);
  if (dateColumn >= 0) skip.add(dateColumn);
  if (nameColumn >= 0) skip.add(nameColumn);
  if (officeColumn >= 0) skip.add(officeColumn);

  const timeCandidates = timeColumns.length
    ? timeColumns
    : headerRow.map((_, idx) => idx).filter((idx) => !skip.has(idx));

  const recordMap = new Map<
    string,
    { name?: string; officeHint?: string; dayMap: Map<string, Set<string>> }
  >();
  const allDates = new Set<string>();
  let processedRows = 0;

  for (const row of dataRows) {
    const rawBio = norm(row[columnIndex]);
    if (!RX_BIO_VALUE.test(rawBio)) {
      continue;
    }

    const dateValue = dateColumn >= 0 ? row[dateColumn] : undefined;
    const date = toDateString(dateValue);

    const times: string[] = [];
    for (const idx of timeCandidates) {
      if (idx === columnIndex) continue;
      const candidate = row[idx];
      const extracted = extractTimes(candidate);
      for (const t of extracted) {
        if (!times.includes(t)) {
          times.push(t);
        }
      }
    }

    if (!date && !times.length) {
      continue;
    }

    if (date) {
      allDates.add(date);
    }

    if (times.length) {
      processedRows += 1;
    }

    let record = recordMap.get(rawBio);
    if (!record) {
      const name = nameColumn >= 0 ? norm(row[nameColumn]) : undefined;
      const officeHint = officeColumn >= 0 ? norm(row[officeColumn]) : undefined;
      record = {
        name: name || undefined,
        officeHint: officeHint || undefined,
        dayMap: new Map<string, Set<string>>(),
      };
      recordMap.set(rawBio, record);
    }

    if (date) {
      const existing = record.dayMap.get(date) ?? new Set<string>();
      times.forEach((time) => existing.add(time));
      record.dayMap.set(date, existing);
    }
  }

  const records: RawRecord[] = [];
  for (const [bioUserId, info] of recordMap.entries()) {
    const punches = Array.from(info.dayMap.entries())
      .map(([date, set]) => ({
        date,
        times: Array.from(set).sort(),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    records.push({
      bioUserId,
      name: info.name,
      officeHint: info.officeHint,
      punches,
    });
  }

  records.sort((a, b) => a.bioUserId.localeCompare(b.bioUserId));

  return {
    records,
    dates: Array.from(allDates).sort(),
    rows: processedRows,
  };
}

export function summarizeRecords(records: RawRecord[]): { rows: number; distinctBio: number; dates: string[] } {
  const dates = new Set<string>();
  let rows = 0;
  for (const record of records) {
    for (const punch of record.punches) {
      if (punch.times.length) {
        rows += 1;
      }
      if (punch.date) {
        dates.add(punch.date);
      }
    }
  }
  return { rows, distinctBio: records.length, dates: Array.from(dates).sort() };
}

export function parseWorksheet(
  ws: XLSX.WorkSheet,
  options: ParseOptions & { month?: string }
): ParseResult {
  const { bioSource, monthHint, filename } = options;
  let month = options.month || detectMonthFromSheet(ws) || "";
  let inferred = !!month && !monthHint;

  if (monthHint) {
    month = monthHint;
    inferred = false;
  } else if (!month && filename) {
    const fallback = extractMonthFromText(filename);
    if (fallback) {
      month = fallback;
      inferred = true;
    }
  }

  if (bioSource.kind === "header") {
    if (!month) {
      return { ...EMPTY_RESULT };
    }
    const records = parseBlockSheet(ws, month);
    const meta = summarizeRecords(records);
    return {
      records,
      month,
      inferred,
      rows: meta.rows,
      distinctBio: meta.distinctBio,
      dates: meta.dates,
    };
  }

  const column = bioSource.column;
  const { records, dates, rows } = parseColumnSheet(ws, column);
  if (!month) {
    const inferredMonth = dates.length ? dates[0].slice(0, 7) : "";
    if (inferredMonth) {
      month = inferredMonth;
      inferred = !monthHint;
    }
  }

  return {
    records,
    month,
    inferred,
    rows,
    distinctBio: records.length,
    dates,
  };
}

export function parseAttendanceFile(buffer: Buffer | ArrayBuffer, options: ParseOptions): ParseResult {
  const dataBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const workbook = XLSX.read(dataBuffer, {
    type: "buffer",
    cellDates: true,
    cellText: true,
    raw: false,
  });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { ...EMPTY_RESULT };
  }
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    return { ...EMPTY_RESULT };
  }
  return parseWorksheet(worksheet, options);
}
