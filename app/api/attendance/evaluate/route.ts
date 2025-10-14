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

    const normalizedSchedules = new Map<string, Awaited<ReturnType<typeof normalizeSchedule>>>();

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

    for (const row of validRows) {
      const cacheKey = `${row.employeeId}||${row.dateISO}`;
      if (normalizedSchedules.has(cacheKey)) {
        continue;
      }

      const schedule = await withTimeout(getScheduleFor(row.employeeId, row.dateISO), 5_000)
        .catch((error) => {
          console.error("Schedule lookup failed", { employeeId: row.employeeId, dateISO: row.dateISO, error });
          return { ...DEFAULT_SCHEDULE };
        })
        .then((record) => normalizeSchedule(record));

      normalizedSchedules.set(cacheKey, schedule);
    }

    const evaluatedPerDay = await Promise.all(
      validRows.map(async (row) => {
        const scheduleKey = `${row.employeeId}||${row.dateISO}`;
        const schedule = normalizedSchedules.get(scheduleKey) ?? normalizeSchedule({ ...DEFAULT_SCHEDULE });
        const evaluation = evaluateDay({
          dateISO: row.dateISO,
          earliest: row.earliest ?? undefined,
          latest: row.latest ?? undefined,
          allTimes: row.allTimes,
          schedule,
        });

        return {
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
        } satisfies PerDayRow;
      })
    );

    const perEmployee = summarizePerEmployee(evaluatedPerDay);

    return NextResponse.json({ perDay: evaluatedPerDay, perEmployee });
  } catch (error) {
    console.error("Failed to evaluate attendance", error);
    return NextResponse.json({ error: "Failed to evaluate attendance" }, { status: 500 });
  }
}
