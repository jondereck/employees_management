import * as XLSX from "xlsx";
import { RawRecord } from "./types";

type ParseResult = {
  records: RawRecord[];
  month: string;
  inferred: boolean;
  rows: number;
  distinctBio: number;
  dates: string[];
};

const BIO_HEADER_REGEX = /^(user\s*id|bio)/i;
const NAME_HEADER_REGEX = /name/i;
const OFFICE_HEADER_REGEX = /(office|dept|department)/i;
const DATE_HEADER_REGEX = /date/i;
const TIME_HEADER_REGEX = /(time|in|out|punch)/i;

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
      // treat as time-only
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

const toTimeStrings = (value: any): string[] => {
  if (value == null) return [];
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value, { date1904: false });
    if (!parsed) return [];
    const totalMinutes = (parsed.H || 0) * 60 + (parsed.M || 0);
    if (isNaN(totalMinutes)) return [];
    return [
      `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`,
    ];
  }
  const tokens = String(value)
    .split(/\s+|\n|\r|,|;/)
    .map((t) => t.trim())
    .filter(Boolean);
  const times: string[] = [];
  for (const token of tokens) {
    const match = token.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      const h = Number(match[1]);
      const m = Number(match[2]);
      if (h >= 0 && h < 24 && m >= 0 && m < 60) {
        times.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      }
    }
  }
  return times;
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

export function parseAttendanceFile(buffer: Buffer, filename = ""): ParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { records: [], month: "", inferred: false, rows: 0, distinctBio: 0, dates: [] };
  }
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, raw: false, defval: "" });
  if (!rows.length) {
    return { records: [], month: "", inferred: false, rows: 0, distinctBio: 0, dates: [] };
  }

  const headerRow = rows[0].map((cell) => String(cell ?? "").trim());
  const dataRows = rows.slice(1);

  const bioIndex = headerRow.findIndex((cell) => BIO_HEADER_REGEX.test(cell));
  const bioColumn = bioIndex >= 0 ? bioIndex : 5;
  const nameColumn = headerRow.findIndex((cell) => NAME_HEADER_REGEX.test(cell));
  const officeColumn = headerRow.findIndex((cell) => OFFICE_HEADER_REGEX.test(cell));
  const dateColumn = headerRow.findIndex((cell) => DATE_HEADER_REGEX.test(cell));
  const timeColumns = headerRow
    .map((cell, idx) => (TIME_HEADER_REGEX.test(cell) ? idx : -1))
    .filter((idx) => idx >= 0);

  const recordMap = new Map<string, RawRecord & { dayMap: Map<string, Set<string>> }>();
  const allDates = new Set<string>();
  let processedRows = 0;

  for (const row of dataRows) {
    const bioValue = row[bioColumn];
    const bioUserId = String(bioValue ?? "").trim();
    if (!bioUserId) continue;

    const dateValue = dateColumn >= 0 ? row[dateColumn] : undefined;
    const date = toDateString(dateValue);

    const timeCandidates: number[] = timeColumns.length ? timeColumns : headerRow.map((_, idx) => idx);
    const times: string[] = [];
    for (const idx of timeCandidates) {
      if (idx === bioColumn || idx === dateColumn) continue;
      const cellValue = row[idx];
      const extracted = toTimeStrings(cellValue);
      if (extracted.length) {
        times.push(...extracted);
      }
    }

    if (!date && !times.length) continue;
    if (date) allDates.add(date);
    processedRows += 1;

    const existing = recordMap.get(bioUserId);
    if (!existing) {
      const name = nameColumn >= 0 ? String(row[nameColumn] ?? "").trim() : undefined;
      const officeHint = officeColumn >= 0 ? String(row[officeColumn] ?? "").trim() : undefined;
      const dayMap = new Map<string, Set<string>>();
      if (date) {
        dayMap.set(date, new Set(times));
      }
      recordMap.set(bioUserId, {
        bioUserId,
        name: name || undefined,
        officeHint: officeHint || undefined,
        punches: [],
        dayMap,
      });
      continue;
    }

    if (date) {
      const daySet = existing.dayMap.get(date) ?? new Set<string>();
      times.forEach((t) => daySet.add(t));
      existing.dayMap.set(date, daySet);
    }
  }

  const records: RawRecord[] = [];
  for (const record of recordMap.values()) {
    const punches = Array.from(record.dayMap.entries())
      .map(([date, set]) => ({
        date,
        times: Array.from(set).sort(),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    records.push({
      bioUserId: record.bioUserId,
      name: record.name,
      officeHint: record.officeHint,
      punches,
    });
  }

  const distinctBio = records.length;
  const dates = Array.from(allDates);
  let month = inferMonthFromDates(dates);
  let inferred = false;
  if (!month) {
    month = inferMonthFromFilename(filename);
  } else {
    inferred = true;
  }
  if (!month && filename) {
    const fallback = inferMonthFromFilename(filename);
    if (fallback) {
      month = fallback;
      inferred = true;
    }
  }

  return { records, month, inferred, rows: processedRows, distinctBio, dates };
}
