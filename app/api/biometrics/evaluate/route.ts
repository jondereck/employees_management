import { NextResponse } from "next/server";
import { z } from "zod";

import { getScheduleFor, normalizeSchedule, type NormalizedSchedule } from "@/lib/schedules";
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

  for (const entry of payload.entries as ParsedPerDayRow[]) {
    const dateISO = `${year}-${month}-${padDay(entry.day)}`;
    const scheduleRecord = await getScheduleFor(entry.employeeId, dateISO);
    const schedule = normalizeSchedule(scheduleRecord);
    const {
      isLate,
      isUndertime,
      workedHHMM,
      workedMinutes,
      lateMinutes,
      undertimeMinutes,
      requiredMinutes,
      scheduleStart,
      scheduleEnd,
      scheduleGraceMinutes,
    } = evaluateDay({
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
      workedMinutes,
      scheduleType: schedule.type,
      scheduleSource: (schedule as NormalizedSchedule).source,
      lateMinutes,
      undertimeMinutes,
      requiredMinutes,
      scheduleStart: scheduleStart ?? null,
      scheduleEnd: scheduleEnd ?? null,
      scheduleGraceMinutes: scheduleGraceMinutes ?? null,
    });
  }

  const perEmployee = summarizePerEmployee(evaluated);
  return { perDay: evaluated, perEmployee };
}
