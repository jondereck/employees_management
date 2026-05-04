import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@clerk/nextjs";

import { prisma } from "@/lib/prisma";
import { applyOfficeScheduleToEmployees } from "@/lib/applyOfficeScheduleToEmployees";
import { sanitizeWeeklyPattern } from "@/utils/weeklyPattern";
import {
  timekeepingOfficeScheduleSchema,
  toScheduleWriteData,
} from "@/lib/timekeepingScheduleInput";

export const runtime = "nodejs";

const querySchema = z.object({
  officeId: z.string().min(1).optional(),
});

const upsertSchema = timekeepingOfficeScheduleSchema;

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
  excludeId?: string;
}) {
  const from = input.effectiveFrom;
  const to = input.effectiveTo ?? FAR_FUTURE;

  const overlap = await prisma.officeWorkSchedule.findFirst({
    where: {
      departmentId: input.departmentId,
      officeId: input.officeId,
      ...(input.excludeId ? { NOT: { id: input.excludeId } } : {}),
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

export async function GET(
  request: Request,
  { params }: { params: { departmentId: string } }
) {
  const departmentId = params.departmentId?.trim();
  if (!departmentId) {
    return NextResponse.json({ error: "Department ID is required" }, { status: 400 });
  }

  const url = new URL(request.url);
  const query = querySchema.parse({
    officeId: url.searchParams.get("officeId") ?? undefined,
  });

  const [schedules, offices] = await Promise.all([
    prisma.officeWorkSchedule.findMany({
    where: {
      departmentId,
      ...(query.officeId ? { officeId: query.officeId } : {}),
    },
    include: { office: { select: { name: true } } },
    orderBy: [{ office: { name: "asc" } }, { effectiveFrom: "desc" }],
    }),
    prisma.offices.findMany({
      where: { departmentId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({
    items: schedules.map(toOfficeScheduleDto),
    offices,
  });
}

export async function POST(
  request: Request,
  { params }: { params: { departmentId: string } }
) {
  const departmentId = params.departmentId?.trim();
  if (!departmentId) {
    return NextResponse.json({ error: "Department ID is required" }, { status: 400 });
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

    const payload = upsertSchema.parse(await request.json());

    const office = await prisma.offices.findFirst({
      where: { id: payload.officeId, departmentId },
      select: { id: true },
    });
    if (!office) {
      return NextResponse.json({ error: "Office not found" }, { status: 404 });
    }

    const baseData = toScheduleWriteData(payload);
    const data = {
      ...baseData,
      weeklyPattern:
        "weeklyPattern" in baseData
          ? baseData.weeklyPattern === null
            ? Prisma.DbNull
            : (baseData.weeklyPattern as Prisma.InputJsonValue)
          : undefined,
    };

    if (data.effectiveTo && data.effectiveTo < data.effectiveFrom) {
      return NextResponse.json(
        { error: "Effective to must be after effective from." },
        { status: 400 }
      );
    }

    if (payload.id) {
      const existing = await prisma.officeWorkSchedule.findFirst({
        where: { id: payload.id, departmentId, officeId: payload.officeId },
        select: { id: true },
      });
      if (!existing) {
        return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
      }
    }

    const overlapId = await assertNoOfficeScheduleOverlap({
      departmentId,
      officeId: payload.officeId,
      effectiveFrom: data.effectiveFrom,
      effectiveTo: data.effectiveTo ?? null,
      excludeId: payload.id ?? undefined,
    });
    if (overlapId) {
      return NextResponse.json(
        { error: "Schedule overlaps an existing entry for this office." },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const schedule = payload.id
        ? await tx.officeWorkSchedule.update({
            where: { id: payload.id },
            data,
            include: { office: { select: { name: true } } },
          })
        : await tx.officeWorkSchedule.create({
            data: {
              ...data,
              departmentId,
              officeId: payload.officeId,
            },
            include: { office: { select: { name: true } } },
          });

      const appliedCount = await applyOfficeScheduleToEmployees(tx, {
        departmentId,
        officeId: payload.officeId,
        schedule: data,
      });

      return { schedule, appliedCount };
    });

    return NextResponse.json({
      ...toOfficeScheduleDto(result.schedule),
      appliedCount: result.appliedCount,
    });
  } catch (error) {
    console.error("Failed to save office schedule", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unable to save office schedule.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
