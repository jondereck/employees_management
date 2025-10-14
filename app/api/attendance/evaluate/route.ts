import { NextResponse } from "next/server";

import {
  DEFAULT_SCHEDULE,
  getScheduleFor,
  loadNormalizedSchedulesForMonth,
  normalizeSchedule,
  type NormalizedSchedule,
} from "@/lib/schedules";
import { evaluateDay } from "@/utils/evaluateDay";
import type { PerDayRow } from "@/utils/parseBioAttendance";
import { summarizePerEmployee } from "@/utils/parseBioAttendance";

function isValidMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value);
}

function toDateISO(monthISO: string, day: number) {
  return `${monthISO}-${String(day).padStart(2, "0")}`;
}

const MAX_FALLBACK_CONCURRENCY = 4;

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Schedule lookup timed out"));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { monthISO, perDay } = body as {
      monthISO?: unknown;
      perDay?: Array<Partial<PerDayRow>>;
    };

    if (!isValidMonth(monthISO)) {
      return NextResponse.json({ error: "Invalid month" }, { status: 400 });
    }

    if (!Array.isArray(perDay)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const validRows = perDay
      .map((row) => {
        const day = Number(row?.day);
        if (!row?.employeeId || Number.isNaN(day) || day < 1 || day > 31) {
          return null;
        }
        const dateISO = toDateISO(monthISO, day);
        const punches = Array.isArray(row.allTimes)
          ? row.allTimes.filter((value): value is string => typeof value === "string")
          : [];
        return {
          employeeId: row.employeeId,
          employeeName: row.employeeName ?? "",
          day,
          dateISO,
          earliest: (row.earliest ?? null) as PerDayRow["earliest"],
          latest: (row.latest ?? null) as PerDayRow["latest"],
          allTimes: punches,
        };
      })
      .filter((row): row is {
        employeeId: string;
        employeeName: string;
        day: number;
        dateISO: string;
        earliest: PerDayRow["earliest"];
        latest: PerDayRow["latest"];
        allTimes: string[];
      } => Boolean(row));

    const scheduleKeys = validRows.map((row) => ({ employeeId: row.employeeId, dateISO: row.dateISO }));
    const scheduleKey = (employeeId: string, dateISO: string) => `${employeeId}||${dateISO}`;
    const normalizedSchedules = await withTimeout(
      loadNormalizedSchedulesForMonth(scheduleKeys, monthISO),
      5_000
    ).catch((error) => {
      console.error("Bulk schedule lookup failed", error);
      return new Map<string, NormalizedSchedule>();
    });

    const fallbackTargets = scheduleKeys.filter(({ employeeId, dateISO }) => {
      const key = scheduleKey(employeeId, dateISO);
      const match = normalizedSchedules.get(key);
      return !match || match.source === "DEFAULT";
    });

    const fallbackSchedules = await loadFallbackSchedules(fallbackTargets, scheduleKey);

    const defaultSchedule = normalizeSchedule(DEFAULT_SCHEDULE);
    const evaluatedPerDay: PerDayRow[] = [];

    for (const row of validRows) {
      const key = scheduleKey(row.employeeId, row.dateISO);
      const schedule =
        normalizedSchedules.get(key) ??
        fallbackSchedules.get(key) ??
        defaultSchedule;

      const evaluation = evaluateDay({
        dateISO: row.dateISO,
        earliest: row.earliest ?? undefined,
        latest: row.latest ?? undefined,
        allTimes: row.allTimes,
        schedule,
      });

      evaluatedPerDay.push({
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        day: row.day,
        dateISO: row.dateISO,
        earliest: row.earliest,
        latest: row.latest,
        allTimes: row.allTimes,
        isLate: evaluation.isLate,
        isUndertime: evaluation.isUndertime,
        workedHHMM: evaluation.workedHHMM,
        scheduleType: schedule.type,
        scheduleSource: schedule.source,
      });
    }

    const perEmployee = summarizePerEmployee(evaluatedPerDay);

    return NextResponse.json({ perDay: evaluatedPerDay, perEmployee });
  } catch (error) {
    console.error("Failed to evaluate attendance", error);
    return NextResponse.json({ error: "Failed to evaluate attendance" }, { status: 500 });
  }
}

async function loadFallbackSchedules(
  entries: Array<{ employeeId: string; dateISO: string }>,
  toKey: (employeeId: string, dateISO: string) => string
): Promise<Map<string, NormalizedSchedule>> {
  if (!entries.length) {
    return new Map();
  }

  const seen = new Set<string>();
  const unique: Array<{ employeeId: string; dateISO: string }> = [];
  for (const entry of entries) {
    const key = toKey(entry.employeeId, entry.dateISO);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(entry);
    }
  }

  if (!unique.length) {
    return new Map();
  }

  const results = new Map<string, NormalizedSchedule>();
  const queue = [...unique];
  const workers = Array.from({ length: Math.min(MAX_FALLBACK_CONCURRENCY, queue.length) }, () =>
    (async function run() {
      while (queue.length) {
        const next = queue.pop();
        if (!next) {
          break;
        }
        const key = toKey(next.employeeId, next.dateISO);
        try {
          const record = await getScheduleFor(next.employeeId, next.dateISO);
          results.set(key, normalizeSchedule(record));
        } catch (error) {
          console.error("Fallback schedule lookup failed", {
            employeeId: next.employeeId,
            dateISO: next.dateISO,
            error,
          });
          results.set(key, normalizeSchedule(DEFAULT_SCHEDULE));
        }
      }
    })()
  );

  await Promise.all(workers);
  return results;
}
