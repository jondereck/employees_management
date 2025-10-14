import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { toWorkScheduleDto } from "@/lib/schedules";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const schedule = await prisma.workSchedule.update({
      where: { id: params.id },
      data: {
        type: body.type,
        startTime: body.startTime ?? null,
        endTime: body.endTime ?? null,
        graceMinutes: body.graceMinutes ?? null,
        coreStart: body.coreStart ?? null,
        coreEnd: body.coreEnd ?? null,
        bandwidthStart: body.bandwidthStart ?? null,
        bandwidthEnd: body.bandwidthEnd ?? null,
        requiredDailyMinutes: body.requiredDailyMinutes ?? null,
        shiftStart: body.shiftStart ?? null,
        shiftEnd: body.shiftEnd ?? null,
        breakMinutes: body.breakMinutes ?? 60,
        effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : undefined,
        effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
        timezone: body.timezone ?? undefined,
      },
    });

    return NextResponse.json(toWorkScheduleDto(schedule));
  } catch (error) {
    console.error("Failed to update schedule", error);
    const message = error instanceof Error ? error.message : "Failed to update schedule";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.workSchedule.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete schedule", error);
    const message = error instanceof Error ? error.message : "Failed to delete schedule";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
