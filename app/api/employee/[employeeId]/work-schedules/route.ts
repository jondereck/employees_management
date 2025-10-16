import { NextResponse } from "next/server";
import { ScheduleType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { toWorkScheduleDto } from "@/lib/schedules";
import {
  normalizeWeeklyPatternInput,
  weeklyPatternInputSchema,
} from "@/lib/weeklyPatternInput";

const scheduleSchema = z.object({
  type: z.nativeEnum(ScheduleType),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  graceMinutes: z.coerce.number().int().min(0).max(180).optional(),
  coreStart: z.string().optional(),
  coreEnd: z.string().optional(),
  bandwidthStart: z.string().optional(),
  bandwidthEnd: z.string().optional(),
  requiredDailyMinutes: z.coerce.number().int().min(0).max(1440).optional(),
  shiftStart: z.string().optional(),
  shiftEnd: z.string().optional(),
  breakMinutes: z.coerce.number().int().min(0).max(720).default(60),
  timezone: z.string().optional(),
  effectiveFrom: z.string().min(1, "Effective from date is required"),
  effectiveTo: z.string().optional().nullable(),
  weeklyPattern: weeklyPatternInputSchema,
}).superRefine((data, ctx) => {
  if (data.type === ScheduleType.FIXED) {
    if (!data.startTime || !data.endTime) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Start and end times are required for fixed schedules", path: ["startTime"] });
    }
  }
  if (data.type === ScheduleType.FLEX) {
    const required = ["coreStart", "coreEnd", "bandwidthStart", "bandwidthEnd", "requiredDailyMinutes"] as const;
    for (const key of required) {
      if (!data[key]) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "All flex schedule fields are required", path: [key] });
      }
    }
  }
  if (data.type === ScheduleType.SHIFT) {
  if (!data.shiftStart || !data.shiftEnd) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Shift start and end are required", path: ["shiftStart"] });
    }
  }
});

type ScheduleInput = z.infer<typeof scheduleSchema>;

export async function POST(request: Request, { params }: { params: { employeeId: string } }) {
  try {
    const json = await request.json();
    const payload = scheduleSchema.parse(json) as ScheduleInput;
    const weeklyPattern = normalizeWeeklyPatternInput(payload.weeklyPattern);

    const data: Prisma.WorkScheduleUncheckedCreateInput = {
      employeeId: params.employeeId,
      type: payload.type,
      startTime: payload.startTime ?? null,
      endTime: payload.endTime ?? null,
      graceMinutes: payload.graceMinutes ?? null,
      coreStart: payload.coreStart ?? null,
      coreEnd: payload.coreEnd ?? null,
      bandwidthStart: payload.bandwidthStart ?? null,
      bandwidthEnd: payload.bandwidthEnd ?? null,
      requiredDailyMinutes: payload.requiredDailyMinutes ?? null,
      shiftStart: payload.shiftStart ?? null,
      shiftEnd: payload.shiftEnd ?? null,
      breakMinutes: payload.breakMinutes ?? 60,
      timezone: payload.timezone ?? "Asia/Manila",
      effectiveFrom: new Date(payload.effectiveFrom),
      effectiveTo: payload.effectiveTo ? new Date(payload.effectiveTo) : null,
      weeklyPattern,
    };
    const schedule = await prisma.workSchedule.create({ data });

    return NextResponse.json(toWorkScheduleDto(schedule));
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unable to save schedule.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
