// utils/date.ts
import * as XLSX from 'xlsx-js-style';

// utils/date.ts

// Parse a date-like value and return UTC Y/M/D
export function getUTCYMD(value?: string | Date | null): { y: number; m: number; d: number } | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() };
}

// Excel serial date from UTC Y/M/D (days since 1899-12-30), ignoring TZ completely.
export function excelSerialFromUTCYMD(ymd: { y: number; m: number; d: number }): number {
  const { y, m, d } = ymd;
  const ms = Date.UTC(y, m, d) - Date.UTC(1899, 11, 30); // Excel epoch
  return Math.round(ms / 86400000); // exact day count
}

// Convenience: input -> Excel serial (or null if invalid)
export function toExcelSerialDate(value?: string | Date | null): number | null {
  const ymd = getUTCYMD(value);
  if (!ymd) return null;
  return excelSerialFromUTCYMD(ymd);
}


// Reusable formatter for *string* output when you just need display text
export const fmtDateUTC = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function formatUTCDate(value?: string | Date | null): string {
  if (!value) return '';
  return fmtDateUTC.format(new Date(value));
}

// Use this when exporting to Excel (true "date-only" at UTC midnight)
export function toUTCDateOnly(value?: string | Date | null): Date | "" {
  if (!value) return "";
  const d = new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Helper: map header name -> Excel column letter (e.g., 'Birthday' -> 'N')
export function columnLetterFromHeader(headers: string[], name: string): string {
  const idx = headers.indexOf(name);
  if (idx === -1) throw new Error(`Header not found: ${name}`);
  return XLSX.utils.encode_col(idx); // e.g., 13 -> 'N'
}
