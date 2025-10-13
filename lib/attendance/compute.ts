import { DayResult, EmployeeMatch, Schedule } from "./types";

const pad = (value: number) => String(value).padStart(2, "0");

export function computeDay(times: string[], schedule: Schedule): DayResult {
  const start = schedule.start;
  const end = schedule.end;
  const grace = schedule.graceMin ?? 0;

  const toMin = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };

  const normalized = times
    .map((t) => t.trim())
    .filter(Boolean)
    .map(toMin);

  const am = normalized
    .filter((m) => m >= 5 * 60 && m <= 12 * 60)
    .sort((a, b) => a - b);

  const pm = normalized
    .filter((m) => m >= 12 * 60 && m <= 22 * 60)
    .sort((a, b) => a - b);

  const first = am[0];
  const last = pm.length ? pm[pm.length - 1] : undefined;

  const s = toMin(start);
  const e = toMin(end);

  const tardy = first === undefined ? 0 : Math.max(0, first - s - grace);
  const under = last === undefined ? 0 : Math.max(0, e - last);

  return {
    date: "",
    firstIn:
      first !== undefined ? `${pad(Math.floor(first / 60))}:${pad(first % 60)}` : undefined,
    lastOut:
      last !== undefined ? `${pad(Math.floor(last / 60))}:${pad(last % 60)}` : undefined,
    tardyMin: tardy,
    underMin: under,
    exception: first === undefined || last === undefined ? "Missing punch" : undefined,
  };
}

export function aggregateEmployee(match: EmployeeMatch, schedule: Schedule) {
  const detail: DayResult[] = match.days.map((day) => {
    const result = computeDay(day.times, schedule);
    result.date = day.date;
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
    summary: { present, tardyCount, tardyMin, underCount, underMin, exceptions },
  };
}
