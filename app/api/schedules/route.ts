import { NextResponse } from "next/server";
import { Prisma, ScheduleType } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { ensureWeeklyPatternColumn } from "@/lib/ensureWeeklyPatternColumn";
import { toWorkScheduleDto } from "@/lib/schedules";
import {
  normalizeWeeklyPatternInput,
  weeklyPatternInputSchema,
} from "@/lib/weeklyPatternInput";

const createScheduleSchema = z.object({
  employeeId: z.string().min(1),
  type: z.nativeEnum(ScheduleType),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  graceMinutes: z.coerce.number().int().min(0).max(180).optional(),
  coreStart: z.string().optional().nullable(),
  coreEnd: z.string().optional().nullable(),
  bandwidthStart: z.string().optional().nullable(),
  bandwidthEnd: z.string().optional().nullable(),
  requiredDailyMinutes: z.coerce.number().int().min(0).max(1440).optional(),
  shiftStart: z.string().optional().nullable(),
  shiftEnd: z.string().optional().nullable(),
  breakMinutes: z.coerce.number().int().min(0).max(720).optional(),
  effectiveFrom: z.string().min(1),
  effectiveTo: z.string().optional().nullable(),
  weeklyPattern: weeklyPatternInputSchema,
});

export async function POST(request: Request) {
  try {
    const payload = createScheduleSchema.parse(await request.json());

    await ensureWeeklyPatternColumn(prisma);

    const weeklyPattern = normalizeWeeklyPatternInput(payload.weeklyPattern);

    const data: Prisma.WorkScheduleUncheckedCreateInput = {
      employeeId: payload.employeeId,
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
      effectiveFrom: new Date(payload.effectiveFrom),
      effectiveTo: payload.effectiveTo ? new Date(payload.effectiveTo) : null,
    };

    if (weeklyPattern) {
      data.weeklyPattern = weeklyPattern;
    } else if (payload.weeklyPattern !== undefined) {
      data.weeklyPattern = Prisma.DbNull;
    }

    const schedule = await prisma.workSchedule.create({ data });

    return NextResponse.json(toWorkScheduleDto(schedule));
  } catch (error) {
    console.error("Failed to create schedule", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to create schedule";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
