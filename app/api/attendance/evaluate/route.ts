import { NextResponse } from "next/server";

import { DEFAULT_SCHEDULE, getScheduleFor, normalizeSchedule } from "@/lib/schedules";
import { evaluateDay } from "@/utils/evaluateDay";
import type { PerDayRow } from "@/utils/parseBioAttendance";
import { summarizePerEmployee } from "@/utils/parseBioAttendance";

function isValidMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value);
}

function toDateISO(monthISO: string, day: number) {
  return `${monthISO}-${String(day).padStart(2, "0")}`;
}

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

    const scheduleCache = new Map<string, Promise<ReturnType<typeof normalizeSchedule>>>();

    const loadSchedule = (employeeId: string, dateISO: string) => {
      const cacheKey = `${employeeId}||${dateISO}`;
      let cached = scheduleCache.get(cacheKey);
      if (!cached) {
        cached = withTimeout(getScheduleFor(employeeId, dateISO), 5_000)
          .catch((error) => {
            console.error("Schedule lookup failed", { employeeId, dateISO, error });
            return { ...DEFAULT_SCHEDULE };
          })
          .then((record) => normalizeSchedule(record));
        scheduleCache.set(cacheKey, cached);
      }
      return cached;
    };

    const evaluatedPerDay = await Promise.all(
      perDay.map(async (row) => {
        const day = Number(row.day);
        if (!row.employeeId || Number.isNaN(day) || day < 1 || day > 31) {
          return null;
        }

        const dateISO = toDateISO(monthISO, day);
        const punches = Array.isArray(row.allTimes)
          ? row.allTimes.filter((value): value is string => typeof value === "string")
          : [];
        const schedule = await loadSchedule(row.employeeId, dateISO);
        const evaluation = evaluateDay({
          dateISO,
          earliest: (row.earliest ?? undefined) as PerDayRow["earliest"],
          latest: (row.latest ?? undefined) as PerDayRow["latest"],
          allTimes: punches,
          schedule,
        });

        return {
          employeeId: row.employeeId,
          employeeName: row.employeeName ?? "",
          day,
          dateISO,
          earliest: (row.earliest ?? null) as PerDayRow["earliest"],
          latest: (row.latest ?? null) as PerDayRow["latest"],
          allTimes: punches,
          isLate: evaluation.isLate,
          isUndertime: evaluation.isUndertime,
          workedHHMM: evaluation.workedHHMM,
          scheduleType: schedule.type,
        } satisfies PerDayRow;
      })
    );

    const filteredPerDay = evaluatedPerDay.filter((row): row is PerDayRow => Boolean(row));
    const perEmployee = summarizePerEmployee(filteredPerDay);

    return NextResponse.json({ perDay: filteredPerDay, perEmployee });
  } catch (error) {
    console.error("Failed to evaluate attendance", error);
    return NextResponse.json({ error: "Failed to evaluate attendance" }, { status: 500 });
  }
}
