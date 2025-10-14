import { NextResponse } from "next/server";
import { ScheduleType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { toScheduleExceptionDto } from "@/lib/schedules";

const exceptionSchema = z.object({
  type: z.nativeEnum(ScheduleType).optional(),
  date: z.string().optional(),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  graceMinutes: z.coerce.number().int().min(0).max(180).optional().nullable(),
  coreStart: z.string().optional().nullable(),
  coreEnd: z.string().optional().nullable(),
  bandwidthStart: z.string().optional().nullable(),
  bandwidthEnd: z.string().optional().nullable(),
  requiredDailyMinutes: z.coerce.number().int().min(0).max(1440).optional().nullable(),
  shiftStart: z.string().optional().nullable(),
  shiftEnd: z.string().optional().nullable(),
  breakMinutes: z.coerce.number().int().min(0).max(720).optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.type === ScheduleType.FIXED) {
    if (!data.startTime || !data.endTime) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Start and end times are required", path: ["startTime"] });
    }
  }
  if (data.type === ScheduleType.FLEX) {
    const required = ["coreStart", "coreEnd", "bandwidthStart", "bandwidthEnd", "requiredDailyMinutes"] as const;
    for (const key of required) {
      if (!data[key]) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "All flex fields are required", path: [key] });
      }
    }
  }
  if (data.type === ScheduleType.SHIFT) {
  if (!data.shiftStart || !data.shiftEnd) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Shift start and end are required", path: ["shiftStart"] });
    }
  }
});

type ExceptionUpdateInput = z.infer<typeof exceptionSchema>;

export async function PATCH(request: Request, { params }: { params: { employeeId: string; exceptionId: string } }) {
  try {
    const json = await request.json();
    const payload = exceptionSchema.parse(json) as ExceptionUpdateInput;
    const existing = await prisma.scheduleException.findUnique({ where: { id: params.exceptionId } });
    if (!existing || existing.employeeId !== params.employeeId) {
      return NextResponse.json({ error: "Schedule exception not found" }, { status: 404 });
    }

    const data: Prisma.ScheduleExceptionUncheckedUpdateInput = {};
    if (payload.type !== undefined) data.type = payload.type;
    if (payload.date !== undefined) data.date = new Date(payload.date);
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
    if (payload.breakMinutes !== undefined) data.breakMinutes = payload.breakMinutes ?? null;

    const exception = await prisma.scheduleException.update({
      where: { id: params.exceptionId },
      data,
    });

    return NextResponse.json(toScheduleExceptionDto(exception));
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unable to update schedule exception.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { employeeId: string; exceptionId: string } }) {
  try {
    const result = await prisma.scheduleException.deleteMany({
      where: { id: params.exceptionId, employeeId: params.employeeId },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Schedule exception not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Unable to delete schedule exception.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
