import { NextResponse } from "next/server";

import { getScheduleFor, normalizeSchedule } from "@/lib/schedules";
import { evaluateDay } from "@/utils/evaluateDay";
import type { PerDayRow } from "@/utils/parseBioAttendance";
import { summarizePerEmployee } from "@/utils/parseBioAttendance";

function isValidMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value);
}

function toDateISO(monthISO: string, day: number) {
  return `${monthISO}-${String(day).padStart(2, "0")}`;
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

    const scheduleCache = new Map<string, ReturnType<typeof getScheduleFor>>();

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
        const cacheKey = `${row.employeeId}||${dateISO}`;
        let schedulePromise = scheduleCache.get(cacheKey);
        if (!schedulePromise) {
          schedulePromise = getScheduleFor(row.employeeId, dateISO);
          scheduleCache.set(cacheKey, schedulePromise);
        }
        const scheduleRecord = await schedulePromise;
        const schedule = normalizeSchedule(scheduleRecord);
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
