import { NextResponse } from "next/server";
import { z } from "zod";

import {
  DEFAULT_SCHEDULE,
  loadMonthlyScheduleContext,
  normalizeSchedule,
  resolveScheduleForDate,
  type MonthlyScheduleContext,
} from "@/lib/schedules";
import { evaluateDay } from "@/utils/evaluateDay";
import type { HHMM } from "@/utils/evaluateDay";
import type { ParsedPerDayRow, PerDayRow, PerEmployeeRow } from "@/utils/parseBioAttendance";
import { summarizePerEmployee } from "@/utils/parseBioAttendance";

const payloadSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  entries: z.array(z.object({
    employeeId: z.string(),
    employeeName: z.string(),
    day: z.number().int().min(1).max(31),
    earliest: z.string().nullable(),
    latest: z.string().nullable(),
    allTimes: z.array(z.string()),
  })),
});

type Payload = z.infer<typeof payloadSchema>;

type EvaluationResult = {
  perDay: PerDayRow[];
  perEmployee: PerEmployeeRow[];
};

const padDay = (day: number) => String(day).padStart(2, "0");

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = payloadSchema.parse(json);
    const data = await evaluate(payload);
    return NextResponse.json(data satisfies EvaluationResult);
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unable to evaluate attendance.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

async function evaluate(payload: Payload): Promise<EvaluationResult> {
  const [year, month] = payload.month.split("-");
  const evaluated: PerDayRow[] = [];
  const employeeIds = Array.from(new Set(payload.entries.map((entry) => entry.employeeId)));
  let context: MonthlyScheduleContext | null = null;

  try {
    context = await loadMonthlyScheduleContext(employeeIds, payload.month);
  } catch (error) {
    console.error("Failed to load schedules for biometrics evaluation", error);
  }

  for (const entry of payload.entries as ParsedPerDayRow[]) {
    const dateISO = `${year}-${month}-${padDay(entry.day)}`;
    const schedule = context
      ? resolveScheduleForDate(context, entry.employeeId, dateISO)
      : normalizeSchedule(DEFAULT_SCHEDULE);
    const { isLate, isUndertime, workedHHMM } = evaluateDay({
      dateISO,
      earliest: (entry.earliest ?? undefined) as HHMM | undefined,
      latest: (entry.latest ?? undefined) as HHMM | undefined,
      allTimes: entry.allTimes as any,
      schedule,
    });

    evaluated.push({
      ...entry,
      isLate,
      isUndertime,
      workedHHMM,
      scheduleType: schedule.type,
      scheduleSource: schedule.source,
    });
  }

  const perEmployee = summarizePerEmployee(evaluated);
  return { perDay: evaluated, perEmployee };
}
