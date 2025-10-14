import { NextResponse } from "next/server";
import { ScheduleType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { toScheduleExceptionDto } from "@/lib/schedules";

const exceptionSchema = z.object({
  type: z.nativeEnum(ScheduleType),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  graceMinutes: z.coerce.number().int().min(0).max(180).optional(),
  coreStart: z.string().optional().nullable(),
  coreEnd: z.string().optional().nullable(),
  bandwidthStart: z.string().optional(),
  bandwidthEnd: z.string().optional(),
  requiredDailyMinutes: z.coerce.number().int().min(0).max(1440).optional(),
  shiftStart: z.string().optional(),
  shiftEnd: z.string().optional(),
  breakMinutes: z.coerce.number().int().min(0).max(720).optional(),
  requireCore: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.type === ScheduleType.FIXED) {
    if (!data.startTime || !data.endTime) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Start and end times are required", path: ["startTime"] });
    }
  }
  if (data.type === ScheduleType.FLEX && data.requireCore !== false) {
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

type ExceptionInput = z.infer<typeof exceptionSchema>;

export async function POST(request: Request, { params }: { params: { employeeId: string } }) {
  try {
    const json = await request.json();
    const payload = exceptionSchema.parse(json) as ExceptionInput;
    const data: Prisma.ScheduleExceptionUncheckedCreateInput = {
      employeeId: params.employeeId,
      type: payload.type,
      date: new Date(payload.date),
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
      breakMinutes: payload.breakMinutes ?? null,
    };
    const exception = await prisma.scheduleException.create({ data });

    return NextResponse.json(toScheduleExceptionDto(exception));
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unable to save schedule exception.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
