import * as XLSX from "xlsx";
import { RawRecord, UploadMeta } from "./types";

const normalizeString = (value: unknown) => {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value).trim();
  return String(value ?? "").trim();
};

const excelNumberToTime = (value: number) => {
  const totalMinutes = Math.round(value * 24 * 60);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const excelNumberToDate = (value: number) => {
  const parsed = XLSX.SSF.parse_date_code(value);
  if (!parsed) return undefined;
  const date = new Date(Date.UTC(parsed.y, (parsed.m ?? 1) - 1, parsed.d ?? 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
};

const toDateString = (value: unknown): string | undefined => {
  if (value == null || value === "") return undefined;
  if (typeof value === "number" && Number.isFinite(value)) {
    return excelNumberToDate(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const sanitized = trimmed.replace(/[\r\n]+/g, " ");
    const firstToken = sanitized.split(/\s+/)[0];
    const isoMatch = firstToken.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
      const [, y, m, d] = isoMatch;
      return `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    const mdYMatch = firstToken.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
    if (mdYMatch) {
      const [,, rawM, rawY] = mdYMatch;
      const mm = mdYMatch[1].padStart(2, "0");
      const dd = rawM.padStart(2, "0");
      const yyyy = rawY.length === 2 ? `20${rawY}` : rawY.padStart(4, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
    }
  }
  return undefined;
};

const toTimes = (value: unknown): string[] => {
  if (value == null) return [];
  if (typeof value === "number" && Number.isFinite(value)) {
    return [excelNumberToTime(value)];
  }
  const str = normalizeString(value);
  if (!str) return [];
  return str
    .split(/[\n\r,;\s]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      if (/^\d{1,2}:\d{2}$/.test(token)) return token;
      if (/^\d{3,4}$/.test(token)) {
        const padded = token.padStart(4, "0");
        return `${padded.slice(0, 2)}:${padded.slice(2)}`;
      }
      if (/^(\d{1,2})\.(\d{2})$/.test(token)) {
        const [, hh, mm] = token.match(/(\d{1,2})\.(\d{2})$/) ?? [];
        if (hh && mm) return `${hh.padStart(2, "0")}:${mm}`;
      }
      return token;
    })
    .filter((token) => /^\d{1,2}:\d{2}$/.test(token));
};

const extractMonth = (dates: string[], fileName?: string): { month: string; inferred: boolean } => {
  if (dates.length) {
    const sorted = [...dates].sort();
    const first = sorted[0];
    if (first) {
      return { month: first.slice(0, 7), inferred: false };
    }
  }
  if (fileName) {
    const match = fileName.match(/(20\d{2})[-_/]?(\d{2})/);
    if (match) {
      return { month: `${match[1]}-${match[2]}`, inferred: true };
    }
  }
  const now = new Date();
  return { month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`, inferred: true };
};

export function parseWorkbook(buffer: ArrayBuffer, fileName?: string): { raw: RawRecord[]; meta: UploadMeta; month: string } {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) {
    return { raw: [], meta: { rows: 0, distinctBio: 0, inferred: true }, month: "" };
  }

  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });

  if (!rows.length) {
    return { raw: [], meta: { rows: 0, distinctBio: 0, inferred: true }, month: "" };
  }

  const headerRow = rows[0].map((value) => normalizeString(value).toLowerCase());
  const findIndex = (matcher: RegExp, fallback?: number) => {
    const idx = headerRow.findIndex((value) => matcher.test(value));
    if (idx >= 0) return idx;
    return fallback ?? -1;
  };

  const userIdx = findIndex(/^(user\s*id|bio)/i, 5);
  const nameIdx = findIndex(/name/);
  const officeIdx = findIndex(/office|dept|department/);
  const dateIdx = findIndex(/date/);

  const timeIndices = headerRow
    .map((_, idx) => idx)
    .filter((idx) => idx !== userIdx && idx !== nameIdx && idx !== officeIdx && idx !== dateIdx)
    .filter((idx) => /time|in|out|punch/.test(headerRow[idx] ?? ""));

  const recordMap = new Map<string, RawRecord>();
  const dates: string[] = [];
  let processed = 0;

  rows.slice(1).forEach((rowRaw) => {
    const row = rowRaw ?? [];
    const rawId = row[userIdx];
    const bioUserId = normalizeString(rawId);
    if (!bioUserId) return;

    let dateValue: unknown = dateIdx >= 0 ? row[dateIdx] : undefined;
    if (dateValue === undefined || dateValue === "") {
      // attempt fallback by scanning row for recognizable date
      const fromRow = row.find((value) => toDateString(value) !== undefined);
      if (fromRow !== undefined) {
        dateValue = fromRow;
      }
    }
    const date = toDateString(dateValue);
    if (!date) return;

    const times: string[] = [];

    const collectTimeFromIndex = (idx: number) => {
      if (idx < 0) return;
      const value = row[idx];
      const extracted = toTimes(value);
      extracted.forEach((time) => {
        if (!times.includes(time)) times.push(time);
      });
    };

    if (timeIndices.length) {
      timeIndices.forEach(collectTimeFromIndex);
    } else {
      row.forEach((value) => {
        toTimes(value).forEach((time) => {
          if (!times.includes(time)) times.push(time);
        });
      });
    }

    const name = nameIdx >= 0 ? normalizeString(row[nameIdx]) : undefined;
    const officeHint = officeIdx >= 0 ? normalizeString(row[officeIdx]) : undefined;

    const normalizedDate = date;
    if (!normalizedDate) return;

    const existing = recordMap.get(bioUserId);
    if (!existing) {
      recordMap.set(bioUserId, {
        bioUserId,
        name: name || undefined,
        officeHint: officeHint || undefined,
        punches: [
          {
            date: normalizedDate,
            times: times.sort(),
          },
        ],
      });
    } else {
      const day = existing.punches.find((punch) => punch.date === normalizedDate);
      const sortedTimes = times.sort();
      if (day) {
        sortedTimes.forEach((time) => {
          if (!day.times.includes(time)) day.times.push(time);
        });
        day.times.sort();
      } else {
        existing.punches.push({ date: normalizedDate, times: sortedTimes });
        existing.punches.sort((a, b) => a.date.localeCompare(b.date));
      }
    }

    dates.push(normalizedDate);
    processed += 1;
  });

  const { month, inferred } = extractMonth(dates, fileName);
  const raw = Array.from(recordMap.values()).map((record) => ({
    ...record,
    punches: record.punches.sort((a, b) => a.date.localeCompare(b.date)),
  }));

  const meta: UploadMeta = {
    rows: processed,
    distinctBio: raw.length,
    inferred,
  };

  return { raw, meta, month };
}
