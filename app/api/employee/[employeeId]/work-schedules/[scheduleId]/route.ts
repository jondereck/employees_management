import { NextResponse } from "next/server";
import { ScheduleType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { toWorkScheduleDto } from "@/lib/schedules";

const scheduleSchema = z.object({
  type: z.nativeEnum(ScheduleType).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  graceMinutes: z.coerce.number().int().min(0).max(180).optional().nullable(),
  coreStart: z.string().optional().nullable(),
  coreEnd: z.string().optional().nullable(),
  bandwidthStart: z.string().optional().nullable(),
  bandwidthEnd: z.string().optional().nullable(),
  requiredDailyMinutes: z.coerce.number().int().min(0).max(1440).optional().nullable(),
  shiftStart: z.string().optional().nullable(),
  shiftEnd: z.string().optional().nullable(),
  breakMinutes: z.coerce.number().int().min(0).max(720).optional(),
  timezone: z.string().optional(),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional().nullable(),
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

type ScheduleUpdateInput = z.infer<typeof scheduleSchema>;

export async function PATCH(request: Request, { params }: { params: { employeeId: string; scheduleId: string } }) {
  try {
    const json = await request.json();
    const payload = scheduleSchema.parse(json) as ScheduleUpdateInput;
    const existing = await prisma.workSchedule.findUnique({ where: { id: params.scheduleId } });
    if (!existing || existing.employeeId !== params.employeeId) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    const data: Prisma.WorkScheduleUncheckedUpdateInput = {};
    if (payload.type !== undefined) data.type = payload.type;
    if (payload.startTime !== undefined) data.startTime = payload.startTime ?? null;
    if (payload.endTime !== undefined) data.endTime = payload.endTime ?? null;
    if (payload.graceMinutes !== undefined) data.graceMinutes = payload.graceMinutes ?? null;
    if (payload.coreStart !== undefined) data.coreStart = payload.coreStart ?? null;
    if (payload.coreEnd !== undefined) data.coreEnd = payload.coreEnd ?? null;
    if (payload.bandwidthStart !== undefined) data.bandwidthStart = payload.bandwidthStart ?? null;
    if (payload.bandwidthEnd !== undefined) data.bandwidthEnd = payload.bandwidthEnd ?? null;
    if (payload.requiredDailyMinutes !== undefined)
      data.requiredDailyMinutes = payload.requiredDailyMinutes ?? null;
    if (payload.shiftStart !== undefined) data.shiftStart = payload.shiftStart ?? null;
    if (payload.shiftEnd !== undefined) data.shiftEnd = payload.shiftEnd ?? null;
    if (payload.breakMinutes !== undefined) data.breakMinutes = payload.breakMinutes;
    if (payload.timezone !== undefined) data.timezone = payload.timezone;
    if (payload.effectiveFrom !== undefined) data.effectiveFrom = new Date(payload.effectiveFrom);
    if (payload.effectiveTo !== undefined) {
      data.effectiveTo = payload.effectiveTo ? new Date(payload.effectiveTo) : null;
    }

    const schedule = await prisma.workSchedule.update({
      where: { id: params.scheduleId },
      data,
    });

    return NextResponse.json(toWorkScheduleDto(schedule));
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unable to update schedule.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { employeeId: string; scheduleId: string } }) {
  try {
    const result = await prisma.workSchedule.deleteMany({
      where: { id: params.scheduleId, employeeId: params.employeeId },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Unable to delete schedule.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
