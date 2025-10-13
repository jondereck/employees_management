import { DayResult, EmployeeMatch, Schedule } from "./types";

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const toTime = (min: number | undefined) => {
  if (typeof min !== "number" || Number.isNaN(min)) {
    return undefined;
  }
  const hours = Math.floor(min / 60);
  const minutes = min % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

export function computeDay(times: string[], schedule: Schedule): DayResult {
  const normalizedTimes = times
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      if (/^\d{1,2}:\d{2}$/.test(t)) {
        return t;
      }
      const cleaned = t.replace(/[^0-9:]/g, "");
      if (/^\d{3,4}$/.test(cleaned)) {
        const padded = cleaned.padStart(4, "0");
        return `${padded.slice(0, 2)}:${padded.slice(2)}`;
      }
      return cleaned;
    })
    .filter((v) => /^\d{1,2}:\d{2}$/.test(v));

  const minutes = normalizedTimes
    .map((value) => {
      const [h, m] = value.split(":").map(Number);
      return h * 60 + m;
    })
    .filter((val) => Number.isFinite(val));

  const am = minutes.filter((m) => m >= 5 * 60 && m <= 12 * 60).sort((a, b) => a - b);
  const pm = minutes.filter((m) => m >= 12 * 60 && m <= 22 * 60).sort((a, b) => a - b);

  const first = am[0];
  const last = pm.length ? pm[pm.length - 1] : undefined;

  const s = toMin(schedule.start);
  const e = toMin(schedule.end);
  const grace = schedule.graceMin ?? 0;

  const tardy = first === undefined ? 0 : Math.max(0, first - s - grace);
  const under = last === undefined ? 0 : Math.max(0, e - last);

  return {
    date: "",
    firstIn: toTime(first),
    lastOut: toTime(last),
    tardyMin: tardy,
    underMin: under,
    exception: first === undefined || last === undefined ? "Missing punch" : undefined,
  };
}

export function aggregateEmployee(match: EmployeeMatch, schedule: Schedule) {
  const detail: DayResult[] = match.days.map((d) => {
    const result = computeDay(d.times, schedule);
    result.date = d.date;
    return result;
  });

  const present = detail.filter((d) => d.firstIn || d.lastOut).length;
  const tardyCount = detail.filter((d) => d.tardyMin > 0).length;
  const underCount = detail.filter((d) => d.underMin > 0).length;
  const tardyMin = detail.reduce((acc, d) => acc + d.tardyMin, 0);
  const underMin = detail.reduce((acc, d) => acc + d.underMin, 0);
  const exceptions = detail.filter((d) => d.exception).length;

  return {
    detail,
    summary: {
      present,
      tardyCount,
      tardyMin,
      underCount,
      underMin,
      exceptions,
    },
  };
}
