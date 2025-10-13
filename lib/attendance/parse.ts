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

type HeaderBlock = {
  bioUserId: string;
  name?: string;
  officeHint?: string;
  days: { day: number; times: string[] }[];
};

type HeaderParseResult = {
  blocks: HeaderBlock[];
  monthCandidates: string[];
};

type ColumnParseResult = {
  records: RawRecord[];
  rows: number;
  dates: string[];
};

type ParseOptions = {
  filename?: string;
  monthHint?: string;
  bioSource: BioSource;
};

const NAME_HEADER_REGEX = /name/i;
const OFFICE_HEADER_REGEX = /(office|dept|department)/i;
const DATE_HEADER_REGEX = /date/i;
const TIME_HEADER_REGEX = /(time|in|out|punch)/i;

const USER_ID_REGEX = /^User\s*ID\s*:\s*(\d+)/i;
const NAME_BLOCK_REGEX = /^Name\s*:\s*(.+)$/i;
const DEPT_BLOCK_REGEX = /^Department\s*:\s*(.+)$/i;
const MONTH_IN_TEXT_REGEX = /(20\d{2})[-\/]?(0?[1-9]|1[0-2])/g;

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

const toDateString = (value: any): string | null => {
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
};

const inferMonthFromDates = (dates: string[]): string => {
  if (!dates.length) return "";
  const sorted = [...dates].sort();
  const first = sorted[0];
  if (!first) return "";
  return first.slice(0, 7);
};

const inferMonthFromFilename = (filename: string): string => {
  const match = filename.match(/(20\d{2})[-_\s]?(0?[1-9]|1[0-2])/);
  if (!match) return "";
  const year = match[1];
  const month = match[2].padStart(2, "0");
  return `${year}-${month}`;
};

const columnLetterToIndex = (letter: string): number => {
  if (!letter) return -1;
  let result = 0;
  const upper = letter.trim().toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    const code = upper.charCodeAt(i);
    if (code < 65 || code > 90) {
      return -1;
    }
    result = result * 26 + (code - 64);
  }
  return result - 1;
};

const getCell = (worksheet: XLSX.WorkSheet, row: number, col: number) => {
  return worksheet[XLSX.utils.encode_cell({ r: row, c: col })];
};

const getCellText = (worksheet: XLSX.WorkSheet, row: number, col: number): string => {
  const cell = getCell(worksheet, row, col);
  if (!cell) return "";
  if (cell.w != null) {
    return norm(cell.w);
  }
  return norm(cell.v);
};

const getCellValue = (worksheet: XLSX.WorkSheet, row: number, col: number) => {
  const cell = getCell(worksheet, row, col);
  if (!cell) return "";
  return cell.v ?? cell.w ?? "";
};

const extractTimes = (value: any): string[] => {
  if (value == null) return [];
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value, { date1904: false });
    if (!parsed) return [];
    const totalMinutes = (parsed.H || 0) * 60 + (parsed.M || 0);
    if (isNaN(totalMinutes)) return [];
    const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const mm = String(totalMinutes % 60).padStart(2, "0");
    return [`${hh}:${mm}`];
  }
  const parts = splitTimes(value);
  const unique = Array.from(new Set(parts));
  return unique;
};

const parseHeaderWorksheet = (worksheet: XLSX.WorkSheet): HeaderParseResult => {
  const ref = worksheet["!ref"];
  if (!ref) {
    return { blocks: [], monthCandidates: [] };
  }
  const range = XLSX.utils.decode_range(ref);
  const processed = new Set<string>();
  const blocks: HeaderBlock[] = [];
  const monthCandidates = new Set<string>();

  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const address = XLSX.utils.encode_cell({ r, c });
      if (processed.has(address)) continue;

      const text = getCellText(worksheet, r, c);
      if (!text) continue;

      MONTH_IN_TEXT_REGEX.lastIndex = 0;
      let monthMatch: RegExpExecArray | null;
      while ((monthMatch = MONTH_IN_TEXT_REGEX.exec(text))) {
        const year = monthMatch[1];
        const month = monthMatch[2].padStart(2, "0");
        monthCandidates.add(`${year}-${month}`);
      }

      const userMatch = USER_ID_REGEX.exec(text);
      if (!userMatch) continue;

      processed.add(address);
      const bioUserId = userMatch[1];

      let name: string | undefined;
      let officeHint: string | undefined;
      for (let offset = c; offset <= Math.min(range.e.c, c + 6); offset++) {
        const cellText = getCellText(worksheet, r, offset);
        if (!name) {
          const nameMatch = NAME_BLOCK_REGEX.exec(cellText);
          if (nameMatch) {
            name = nameMatch[1].trim();
          }
        }
        if (!officeHint) {
          const deptMatch = DEPT_BLOCK_REGEX.exec(cellText);
          if (deptMatch) {
            officeHint = deptMatch[1].trim();
          }
        }
      }

      const gridStartRow = r + 2;
      const dayHeaderRow = gridStartRow - 1;
      const dayColumns: { day: number; col: number }[] = [];
      for (let col = c; col <= range.e.c; col++) {
        const headerValue = getCellText(worksheet, dayHeaderRow, col);
        if (/^\d{1,2}$/.test(headerValue)) {
          dayColumns.push({ day: Number(headerValue), col });
          continue;
        }
        if (dayColumns.length) {
          if (!headerValue) {
            continue;
          }
          break;
        }
      }

      const days: { day: number; times: string[] }[] = [];
      for (const { day, col } of dayColumns) {
        const rawValue = getCellValue(worksheet, gridStartRow, col);
        const times = extractTimes(rawValue);
        days.push({ day, times });
      }

      blocks.push({
        bioUserId,
        name,
        officeHint,
        days,
      });
    }
  }

  return { blocks, monthCandidates: Array.from(monthCandidates) };
};

const finalizeHeaderBlocks = (blocks: HeaderBlock[], month: string) => {
  const dates = new Set<string>();
  let rows = 0;
  const records: RawRecord[] = blocks.map((block) => {
    const punches = block.days
      .filter((day) => day.times.length)
      .map((day) => {
        const date = month ? yyyymmdd(month, day.day) : "";
        if (date) {
          dates.add(date);
        }
        rows += 1;
        return {
          date,
          times: [...day.times],
        };
      });
    return {
      bioUserId: block.bioUserId,
      name: block.name,
      officeHint: block.officeHint,
      punches,
    };
  });

  records.sort((a, b) => a.bioUserId.localeCompare(b.bioUserId));

  return { records, dates: Array.from(dates).sort(), rows };
};

const parseColumnWorksheet = (
  worksheet: XLSX.WorkSheet,
  bioColumnIndex: number
): ColumnParseResult => {
  const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, raw: true, defval: "" });
  if (!rows.length) {
    return { records: [], rows: 0, dates: [] };
  }

  const headerRow = rows[0].map((cell) => norm(cell));
  const dataRows = rows.slice(1);

  const nameColumn = headerRow.findIndex((cell) => NAME_HEADER_REGEX.test(cell));
  const officeColumn = headerRow.findIndex((cell) => OFFICE_HEADER_REGEX.test(cell));
  const dateColumn = headerRow.findIndex((cell) => DATE_HEADER_REGEX.test(cell));
  const timeColumns = headerRow
    .map((cell, idx) => (TIME_HEADER_REGEX.test(cell) ? idx : -1))
    .filter((idx) => idx >= 0);

  const skipIndices = new Set<number>();
  skipIndices.add(bioColumnIndex);
  if (dateColumn >= 0) skipIndices.add(dateColumn);
  if (nameColumn >= 0) skipIndices.add(nameColumn);
  if (officeColumn >= 0) skipIndices.add(officeColumn);

  const timeCandidates = timeColumns.length
    ? timeColumns
    : headerRow.map((_, idx) => idx).filter((idx) => !skipIndices.has(idx));

  const recordMap = new Map<
    string,
    { name?: string; officeHint?: string; dayMap: Map<string, Set<string>> }
  >();
  const allDates = new Set<string>();
  let processedRows = 0;

  for (const row of dataRows) {
    const bioValue = norm(row[bioColumnIndex]);
    if (!bioValue) continue;

    const dateValue = dateColumn >= 0 ? row[dateColumn] : undefined;
    const date = toDateString(dateValue);

    const times: string[] = [];
    for (const idx of timeCandidates) {
      if (idx === bioColumnIndex) continue;
      const cellValue = row[idx];
      const extracted = extractTimes(cellValue);
      for (const time of extracted) {
        if (!times.includes(time)) {
          times.push(time);
        }
      }
    }

    if (!date && !times.length) continue;
    if (date) {
      allDates.add(date);
    }
    if (times.length) {
      processedRows += 1;
    }

    let record = recordMap.get(bioValue);
    if (!record) {
      const name = nameColumn >= 0 ? norm(row[nameColumn]) : undefined;
      const officeHint = officeColumn >= 0 ? norm(row[officeColumn]) : undefined;
      record = {
        name: name || undefined,
        officeHint: officeHint || undefined,
        dayMap: new Map<string, Set<string>>(),
      };
      recordMap.set(bioValue, record);
    }

    if (date) {
      const daySet = record.dayMap.get(date) ?? new Set<string>();
      times.forEach((time) => daySet.add(time));
      record.dayMap.set(date, daySet);
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

  return { records, rows: processedRows, dates: Array.from(allDates).sort() };
};

export function parseAttendanceFile(
  buffer: Buffer | ArrayBuffer,
  options: ParseOptions
): ParseResult {
  const dataBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const workbook = XLSX.read(dataBuffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { ...EMPTY_RESULT };
  }
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    return { ...EMPTY_RESULT };
  }

  const { bioSource, monthHint, filename } = options;

  if (bioSource.kind === "header") {
    const headerResult = parseHeaderWorksheet(worksheet);
    let month = monthHint ?? headerResult.monthCandidates[0] ?? "";
    let inferred = !monthHint && !!month;
    if (!month && filename) {
      const fallback = inferMonthFromFilename(filename);
      if (fallback) {
        month = fallback;
        inferred = true;
      }
    }

    const { records, dates, rows } = finalizeHeaderBlocks(headerResult.blocks, month);
    return {
      records,
      month,
      inferred,
      rows,
      distinctBio: records.length,
      dates,
    };
  }

  const columnIndex = columnLetterToIndex(bioSource.column);
  if (columnIndex < 0) {
    return { ...EMPTY_RESULT };
  }

  const columnResult = parseColumnWorksheet(worksheet, columnIndex);
  let month = monthHint || inferMonthFromDates(columnResult.dates);
  let inferred = !monthHint && !!month;
  if (!month && filename) {
    const fallback = inferMonthFromFilename(filename);
    if (fallback) {
      month = fallback;
      inferred = true;
    }
  }

  return {
    records: columnResult.records,
    month,
    inferred,
    rows: columnResult.rows,
    distinctBio: columnResult.records.length,
    dates: columnResult.dates,
  };
}
