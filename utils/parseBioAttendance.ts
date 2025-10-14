import * as XLSX from "xlsx";

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
  scheduleSources?: string[];
};

const toParts = (t?: string | null) => {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  return { h: +m[1], m: +m[2] };
};
const lt = (a: string, b: string) => {
  const A = toParts(a), B = toParts(b);
  if (!A || !B) return false;
  return A.h < B.h || (A.h === B.h && A.m < B.m);
};

function isHeaderRow(row: any[]): boolean {
  return String(row?.[1] ?? "").trim() === "1"
      && String(row?.[2] ?? "").trim() === "2"
      && String(row?.[3] ?? "").trim() === "3";
}
function nearestMeta(rows: any[][], headerRowIdx: number) {
  let employeeId = "", employeeName = "";
  for (let r = headerRowIdx - 1; r >= 0; r--) {
    const row = rows[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] ?? "").trim();
      if (!employeeId && cell === "User ID:" && row[c+1] != null) {
        const v = String(row[c+1]).trim();
        if (v && v.toLowerCase() !== "nan") employeeId = v;
      }
      if (!employeeName && cell === "Name:" && row[c+1] != null) {
        const v = String(row[c+1]).trim();
        if (v && v.toLowerCase() !== "nan") employeeName = v;
      }
    }
    if (employeeId && employeeName) break;
  }
  return { employeeId, employeeName };
}
const timesInCell = (raw: any): string[] => {
  const s = String(raw ?? "").trim();
  if (!s || s.toLowerCase() === "nan") return [];
  const out: string[] = [];
  const re = /\b(\d{1,2}:\d{2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out.push(m[1]);
  return out;
};

export function parseBioAttendance(arrayBuffer: ArrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const perDay: ParsedPerDayRow[] = [];

  for (const sn of wb.SheetNames) {
    const ws = wb.Sheets[sn];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });

    for (let r = 0; r < rows.length; r++) {
      const header = rows[r] ?? [];
      if (!isHeaderRow(header)) continue;

      // day run length
      let run = 0;
      for (let d = 1; d < header.length; d++) {
        const v = String(header[d] ?? "").trim();
        if (/^\d{1,2}$/.test(v)) run++; else break;
      }

      const { employeeId, employeeName } = nearestMeta(rows, r);
      const earliest: (string|null)[] = Array(run + 1).fill(null);
      const latest: (string|null)[] = Array(run + 1).fill(null);
      const allTimes: string[][] = Array.from({ length: run + 1 }, () => []);

      // scan down until next header or "User ID:"
      for (let rr = r + 1; rr < rows.length; rr++) {
        const row = rows[rr] ?? [];
        if (isHeaderRow(row) || row.some(c => String(c ?? "").trim() === "User ID:")) break;

        for (let d = 1; d <= run; d++) {
          const ts = timesInCell(row[d]);
          if (ts.length) {
            allTimes[d].push(...ts);
            for (const t of ts) {
              if (!earliest[d] || lt(t, earliest[d]!)) earliest[d] = t;
              if (!latest[d] || lt(latest[d]!, t))   latest[d]   = t;
            }
          }
        }
      }

      for (let d = 1; d <= run; d++) {
        const e = earliest[d];
        const l = latest[d];
        perDay.push({
          employeeId,
          employeeName,
          day: d,
          earliest: e,
          latest: l,
          allTimes: [...allTimes[d]],
        });
      }
    }
  }

  return { perDay };
}

export function exportResultsToXlsx(perEmployee: PerEmployeeRow[], perDay: PerDayRow[]) {
  const wb = XLSX.utils.book_new();
  const s1 = XLSX.utils.json_to_sheet(perEmployee.map(r => ({
    EmployeeID: r.employeeId,
    EmployeeName: r.employeeName,
    DaysWithLogs: r.daysWithLogs,
    LateDays: r.lateDays,
    UndertimeDays: r.undertimeDays,
    LateRatePercent: r.lateRate,
    UndertimeRatePercent: r.undertimeRate,
    ScheduleTypes: (r.scheduleTypes ?? []).join(", "),
    ScheduleSources: (r.scheduleSources ?? []).join(", "),
  })));
  XLSX.utils.book_append_sheet(wb, s1, "PerEmployee");

  const s2 = XLSX.utils.json_to_sheet(perDay.map(r => ({
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
  })));
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
  scheduleSources: Set<string>;
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
        scheduleSources: new Set<string>(),
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
      agg.scheduleSources.add(row.scheduleSource);
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
    scheduleSources: Array.from(entry.scheduleSources).sort(),
  }));
}
