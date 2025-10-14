import { NextResponse } from "next/server";

import {
  DEFAULT_SCHEDULE,
  loadMonthlyScheduleContext,
  normalizeSchedule,
  resolveScheduleForDate,
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

    const employeeIds = Array.from(new Set(validRows.map((row) => row.employeeId)));
    const scheduleContext = await loadMonthlyScheduleContext(employeeIds, monthISO).catch((error) => {
      console.error("Failed to preload monthly schedules", error);
      return null;
    });

    const defaultSchedule = normalizeSchedule(DEFAULT_SCHEDULE);
    const evaluatedPerDay: PerDayRow[] = [];

    for (const row of validRows) {
      const schedule = scheduleContext
        ? resolveScheduleForDate(scheduleContext, row.employeeId, row.dateISO)
        : defaultSchedule;

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
