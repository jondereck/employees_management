import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@clerk/nextjs";

import { prisma } from "@/lib/prisma";
import {
  applyOfficeScheduleToEmployees,
  type OfficeAppliedScheduleWriteData,
} from "@/lib/applyOfficeScheduleToEmployees";
import { sanitizeWeeklyPattern } from "@/utils/weeklyPattern";
import {
  timekeepingScheduleBaseSchema,
  toScheduleWriteData,
} from "@/lib/timekeepingScheduleInput";

export const runtime = "nodejs";

const patchSchema = timekeepingScheduleBaseSchema.partial().extend({
  officeId: z.string().min(1).optional(),
});

const FAR_FUTURE = new Date("9999-12-31T23:59:59.999Z");

async function requireDepartmentOwner(userId: string, departmentId: string) {
  const department = await prisma.department.findFirst({
    where: { id: departmentId, userId },
    select: { id: true },
  });
  return Boolean(department);
}

async function assertNoOfficeScheduleOverlap(input: {
  departmentId: string;
  officeId: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  excludeId: string;
}) {
  const from = input.effectiveFrom;
  const to = input.effectiveTo ?? FAR_FUTURE;

  const overlap = await prisma.officeWorkSchedule.findFirst({
    where: {
      departmentId: input.departmentId,
      officeId: input.officeId,
      NOT: { id: input.excludeId },
      effectiveFrom: { lte: to },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
    },
    select: { id: true },
  });

  return overlap ? overlap.id : null;
}

const toOfficeScheduleDto = (schedule: {
  id: string;
  departmentId: string;
  officeId: string;
  type: string;
  startTime: string | null;
  endTime: string | null;
  graceMinutes: number | null;
  coreStart: string | null;
  coreEnd: string | null;
  bandwidthStart: string | null;
  bandwidthEnd: string | null;
  requiredDailyMinutes: number | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  breakMinutes: number;
  timezone: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  weeklyPattern: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  office?: { name: string } | null;
}) => ({
  id: schedule.id,
  departmentId: schedule.departmentId,
  officeId: schedule.officeId,
  officeName: schedule.office?.name ?? null,
  type: schedule.type,
  startTime: schedule.startTime,
  endTime: schedule.endTime,
  graceMinutes: schedule.graceMinutes,
  coreStart: schedule.coreStart,
  coreEnd: schedule.coreEnd,
  bandwidthStart: schedule.bandwidthStart,
  bandwidthEnd: schedule.bandwidthEnd,
  requiredDailyMinutes: schedule.requiredDailyMinutes,
  shiftStart: schedule.shiftStart,
  shiftEnd: schedule.shiftEnd,
  breakMinutes: schedule.breakMinutes,
  timezone: schedule.timezone,
  effectiveFrom: schedule.effectiveFrom.toISOString(),
  effectiveTo: schedule.effectiveTo ? schedule.effectiveTo.toISOString() : null,
  weeklyPattern: sanitizeWeeklyPattern(schedule.weeklyPattern),
  createdAt: schedule.createdAt.toISOString(),
  updatedAt: schedule.updatedAt.toISOString(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { departmentId: string; scheduleId: string } }
) {
  const departmentId = params.departmentId?.trim();
  if (!departmentId) {
    return NextResponse.json({ error: "Department ID is required" }, { status: 400 });
  }
  const scheduleId = params.scheduleId?.trim();
  if (!scheduleId) {
    return NextResponse.json({ error: "Schedule ID is required" }, { status: 400 });
  }

  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    const allowed = await requireDepartmentOwner(userId, departmentId);
    if (!allowed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const existing = await prisma.officeWorkSchedule.findFirst({
      where: { id: scheduleId, departmentId },
      include: { office: { select: { name: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    const patch = patchSchema.parse(await request.json());

    const resolvedOfficeId = (patch.officeId ?? existing.officeId).trim();
    if (!resolvedOfficeId) {
      return NextResponse.json({ error: "Office ID is required" }, { status: 400 });
    }

    const baseInput = {
      ...existing,
      ...patch,
      id: scheduleId,
      officeId: resolvedOfficeId,
      effectiveFrom: patch.effectiveFrom ?? existing.effectiveFrom.toISOString(),
      effectiveTo: patch.effectiveTo ?? (existing.effectiveTo ? existing.effectiveTo.toISOString() : null),
    };

    const baseData = toScheduleWriteData(baseInput as any);
    const data: Prisma.OfficeWorkScheduleUncheckedUpdateInput = {
      ...baseData,
      officeId: resolvedOfficeId,
      weeklyPattern:
        "weeklyPattern" in baseData
          ? baseData.weeklyPattern === null
            ? Prisma.DbNull
            : (baseData.weeklyPattern as Prisma.InputJsonValue)
          : undefined,
    };
    const effectiveFrom = baseData.effectiveFrom;
    const effectiveTo = baseData.effectiveTo ?? null;

    if (effectiveTo && effectiveTo < effectiveFrom) {
      return NextResponse.json(
        { error: "Effective to must be after effective from." },
        { status: 400 }
      );
    }

    const overlapId = await assertNoOfficeScheduleOverlap({
      departmentId,
      officeId: resolvedOfficeId,
      effectiveFrom,
      effectiveTo,
      excludeId: scheduleId,
    });
    if (overlapId) {
      return NextResponse.json(
        { error: "Schedule overlaps an existing entry for this office." },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.officeWorkSchedule.update({
        where: { id: scheduleId },
        data,
        include: { office: { select: { name: true } } },
      });

      const appliedCount = await applyOfficeScheduleToEmployees(tx, {
        departmentId,
        officeId: resolvedOfficeId,
        schedule: {
          ...data,
          effectiveFrom,
          effectiveTo,
        } as OfficeAppliedScheduleWriteData,
      });

      return { updated, appliedCount };
    });

    return NextResponse.json({
      ...toOfficeScheduleDto(result.updated),
      appliedCount: result.appliedCount,
    });
  } catch (error) {
    console.error("Failed to update office schedule", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unable to update office schedule.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { departmentId: string; scheduleId: string } }
) {
  const departmentId = params.departmentId?.trim();
  if (!departmentId) {
    return NextResponse.json({ error: "Department ID is required" }, { status: 400 });
  }
  const scheduleId = params.scheduleId?.trim();
  if (!scheduleId) {
    return NextResponse.json({ error: "Schedule ID is required" }, { status: 400 });
  }

  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    const allowed = await requireDepartmentOwner(userId, departmentId);
    if (!allowed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const existing = await prisma.officeWorkSchedule.findFirst({
      where: { id: scheduleId, departmentId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    await prisma.officeWorkSchedule.delete({ where: { id: scheduleId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete office schedule", error);
    const message = error instanceof Error ? error.message : "Unable to delete office schedule.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
