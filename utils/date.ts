// utils/date.ts
import * as XLSX from 'xlsx-js-style';

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
