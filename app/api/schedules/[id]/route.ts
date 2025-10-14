import { NextResponse } from "next/server";
import { Prisma, ScheduleType } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { toWorkScheduleDto } from "@/lib/schedules";

const updateScheduleSchema = z
  .object({
    type: z.nativeEnum(ScheduleType).optional(),
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
    breakMinutes: z.coerce.number().int().min(0).max(720).optional(),
    effectiveFrom: z.string().optional(),
    effectiveTo: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.type === ScheduleType.SHIFT) {
      if (!data.shiftStart || !data.shiftEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Shift start and end are required",
          path: ["shiftStart"],
        });
      }
    }
  });

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const json = await request.json();
    const payload = updateScheduleSchema.parse(json);

    const data: Prisma.WorkScheduleUncheckedUpdateInput = {};
    if (payload.type !== undefined) data.type = payload.type;
    if (payload.startTime !== undefined) data.startTime = payload.startTime ?? null;
    if (payload.endTime !== undefined) data.endTime = payload.endTime ?? null;
    if (payload.graceMinutes !== undefined) data.graceMinutes = payload.graceMinutes ?? null;
    if (payload.coreStart !== undefined) data.coreStart = payload.coreStart ?? null;
    if (payload.coreEnd !== undefined) data.coreEnd = payload.coreEnd ?? null;
    if (payload.bandwidthStart !== undefined) data.bandwidthStart = payload.bandwidthStart ?? null;
    if (payload.bandwidthEnd !== undefined) data.bandwidthEnd = payload.bandwidthEnd ?? null;
    if (payload.requiredDailyMinutes !== undefined) {
      data.requiredDailyMinutes = payload.requiredDailyMinutes ?? null;
    }
    if (payload.shiftStart !== undefined) data.shiftStart = payload.shiftStart ?? null;
    if (payload.shiftEnd !== undefined) data.shiftEnd = payload.shiftEnd ?? null;
    if (payload.breakMinutes !== undefined) data.breakMinutes = payload.breakMinutes;
    if (payload.effectiveFrom !== undefined) {
      data.effectiveFrom = new Date(payload.effectiveFrom);
    }
    if (payload.effectiveTo !== undefined) {
      data.effectiveTo = payload.effectiveTo ? new Date(payload.effectiveTo) : null;
    }

    const schedule = await prisma.workSchedule.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json(toWorkScheduleDto(schedule));
  } catch (error) {
    console.error("Failed to update schedule", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Unable to update schedule";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.workSchedule.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete schedule", error);
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Unable to delete schedule";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
