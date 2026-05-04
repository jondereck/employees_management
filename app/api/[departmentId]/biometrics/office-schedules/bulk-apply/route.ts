import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@clerk/nextjs";

import { prisma } from "@/lib/prisma";
import { toWorkScheduleDto } from "@/lib/schedules";
import {
  timekeepingOfficeScheduleSchema,
  toScheduleWriteData,
} from "@/lib/timekeepingScheduleInput";

export const runtime = "nodejs";

const payloadSchema = z.union([
  z.object({
    officeId: z.string().min(1),
    scheduleId: z.string().min(1),
  }),
  timekeepingOfficeScheduleSchema,
]);

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
    const department = await prisma.department.findFirst({
      where: { id: departmentId, userId },
      select: { id: true },
    });
    if (!department) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const payload = payloadSchema.parse(await request.json());
    const office = await prisma.offices.findFirst({
      where: { id: payload.officeId, departmentId },
      select: { id: true },
    });
    if (!office) {
      return NextResponse.json({ error: "Office not found" }, { status: 404 });
    }

    if ("scheduleId" in payload && payload.scheduleId) {
      const schedule = await prisma.officeWorkSchedule.findFirst({
        where: { id: payload.scheduleId, departmentId, officeId: payload.officeId },
        select: {
          id: true,
          type: true,
          startTime: true,
          endTime: true,
          graceMinutes: true,
          coreStart: true,
          coreEnd: true,
          bandwidthStart: true,
          bandwidthEnd: true,
          requiredDailyMinutes: true,
          shiftStart: true,
          shiftEnd: true,
          breakMinutes: true,
          timezone: true,
          effectiveFrom: true,
          effectiveTo: true,
          weeklyPattern: true,
        },
      });
      if (!schedule) {
        return NextResponse.json({ error: "Office schedule not found" }, { status: 404 });
      }

      // Re-map the DB schedule into the same payload shape used by toScheduleWriteData.
      const baseData = toScheduleWriteData({
        ...schedule,
        effectiveFrom: schedule.effectiveFrom.toISOString(),
        effectiveTo: schedule.effectiveTo ? schedule.effectiveTo.toISOString() : null,
        officeId: payload.officeId,
      } as any);

      const data = {
        ...baseData,
        weeklyPattern:
          "weeklyPattern" in baseData
            ? baseData.weeklyPattern === null
              ? Prisma.DbNull
              : (baseData.weeklyPattern as Prisma.InputJsonValue)
            : undefined,
      };

      const employees = await prisma.employee.findMany({
        where: { departmentId, officeId: payload.officeId, isArchived: false },
        select: { id: true },
        orderBy: { lastName: "asc" },
      });

      const written = await prisma.$transaction(async (tx) => {
        const records = [];
        for (const employee of employees) {
          const existing = await tx.workSchedule.findFirst({
            where: {
              employeeId: employee.id,
              effectiveFrom: data.effectiveFrom,
            },
            orderBy: { effectiveFrom: "desc" },
          });

          if (existing) {
            records.push(await tx.workSchedule.update({
              where: { id: existing.id },
              data,
            }));
            continue;
          }

          records.push(await tx.workSchedule.create({
            data: {
              ...data,
              employeeId: employee.id,
            },
          }));
        }
        return records;
      });

      return NextResponse.json({
        count: written.length,
        items: written.slice(0, 25).map(toWorkScheduleDto),
      });
    }

    const schedulePayload = payload as z.infer<typeof timekeepingOfficeScheduleSchema>;

    const employees = await prisma.employee.findMany({
      where: { departmentId, officeId: payload.officeId, isArchived: false },
      select: { id: true },
      orderBy: { lastName: "asc" },
    });

    const baseData = toScheduleWriteData(schedulePayload);
    const data = {
      ...baseData,
      weeklyPattern:
        "weeklyPattern" in baseData
          ? baseData.weeklyPattern === null
            ? Prisma.DbNull
            : (baseData.weeklyPattern as Prisma.InputJsonValue)
          : undefined,
    };

    const written = await prisma.$transaction(async (tx) => {
      const records = [];
      for (const employee of employees) {
        const existing = await tx.workSchedule.findFirst({
          where: {
            employeeId: employee.id,
            effectiveFrom: data.effectiveFrom,
          },
          orderBy: { effectiveFrom: "desc" },
        });

        if (existing) {
          records.push(await tx.workSchedule.update({
            where: { id: existing.id },
            data,
          }));
          continue;
        }

        records.push(await tx.workSchedule.create({
          data: {
            ...data,
            employeeId: employee.id,
          },
        }));
      }
      return records;
    });

    return NextResponse.json({
      count: written.length,
      items: written.slice(0, 25).map(toWorkScheduleDto),
    });
  } catch (error) {
    console.error("Failed to bulk apply office schedule", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unable to bulk apply office schedule.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
