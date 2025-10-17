import { NextResponse } from "next/server";
import { z } from "zod";

import { getScheduleFor, normalizeSchedule, type NormalizedSchedule } from "@/lib/schedules";
import { getWeeklyExclusionForDate } from "@/lib/weeklyExclusions.server";
import { evaluateDay, normalizePunchTimes } from "@/utils/evaluateDay";
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
    const normalizedAllTimes = normalizePunchTimes(entry.allTimes);

    const weeklyExclusion = await getWeeklyExclusionForDate(entry.employeeId, dateISO);

    const evaluation = evaluateDay({
      dateISO,
      earliest: (entry.earliest ?? undefined) as HHMM | undefined,
      latest: (entry.latest ?? undefined) as HHMM | undefined,
      allTimes: normalizedAllTimes,
      schedule,
      weeklyExclusion: weeklyExclusion
        ? {
            mode: weeklyExclusion.mode,
            ignoreUntilMinutes: weeklyExclusion.ignoreUntilMinutes,
          }
        : null,
    });

    evaluated.push({
      ...entry,
      status: evaluation.status,
      allTimes: normalizedAllTimes,
      isLate: evaluation.isLate,
      isUndertime: evaluation.isUndertime,
      workedHHMM: evaluation.workedHHMM,
      workedMinutes: evaluation.workedMinutes,
      scheduleType: schedule.type,
      scheduleSource: (schedule as NormalizedSchedule).source,
      lateMinutes: evaluation.lateMinutes,
      undertimeMinutes: evaluation.undertimeMinutes,
      requiredMinutes: evaluation.requiredMinutes,
      scheduleStart: evaluation.scheduleStart ?? null,
      scheduleEnd: evaluation.scheduleEnd ?? null,
      scheduleGraceMinutes: evaluation.scheduleGraceMinutes ?? null,
      weeklyPatternApplied: evaluation.weeklyPatternApplied ?? false,
      weeklyPatternWindows: evaluation.weeklyPatternWindows ?? null,
      weeklyPatternPresence: evaluation.weeklyPatternPresence ?? [],
      weeklyExclusionApplied: evaluation.weeklyExclusionApplied ?? null,
      weeklyExclusionMode: weeklyExclusion?.mode ?? null,
      weeklyExclusionIgnoreUntil: weeklyExclusion?.ignoreUntilLabel ?? null,
      weeklyExclusionId: weeklyExclusion?.id ?? null,
    });
  }

  const perEmployee = summarizePerEmployee(evaluated);
  return { perDay: evaluated, perEmployee };
}
