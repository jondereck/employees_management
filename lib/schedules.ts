import { addDays, addMonths, startOfDay } from "date-fns";
import { ScheduleException, WorkSchedule } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { Schedule, ScheduleFlex, ScheduleFixed, ScheduleShift } from "@/utils/evaluateDay";

export type ScheduleSource = "EXCEPTION" | "WORKSCHEDULE" | "DEFAULT";

export type ScheduleTypeValue = "FIXED" | "FLEX" | "SHIFT";

export type WorkScheduleDTO = Omit<WorkSchedule, "effectiveFrom" | "effectiveTo"> & {
  effectiveFrom: string;
  effectiveTo: string | null;
};

export type ScheduleExceptionDTO = Omit<ScheduleException, "date"> & {
  date: string;
};

type DefaultSchedule = {
  type: ScheduleTypeValue;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  graceMinutes: number;
  timezone?: string;
  coreStart?: string | null;
  coreEnd?: string | null;
  bandwidthStart?: string | null;
  bandwidthEnd?: string | null;
  requiredDailyMinutes?: number | null;
  shiftStart?: string | null;
  shiftEnd?: string | null;
  source: "DEFAULT";
};

type ScheduleLookupResult =
  | (ScheduleException & { source: "EXCEPTION" })
  | (WorkSchedule & { source: "WORKSCHEDULE" })
  | DefaultSchedule;

const asHHMM = (value: string | null | undefined, fallback: string): string => {
  const trimmed = (value ?? "").trim();
  return trimmed || fallback;
};
export const DEFAULT_SCHEDULE: DefaultSchedule = Object.freeze({
  type: "FIXED",
  startTime: "08:00",
  endTime: "17:00",
  breakMinutes: 60,
  graceMinutes: 0,
  source: "DEFAULT",
});

export async function getScheduleFor(employeeId: string, dateISO: string): Promise<ScheduleLookupResult> {
  try {
    const base = startOfDay(new Date(`${dateISO}T00:00:00Z`));
    const nextDay = addDays(base, 1);

    const exception = await prisma.scheduleException.findFirst({
      where: {
        employeeId,
        date: {
          gte: base,
          lt: nextDay,
        },
      },
      orderBy: { date: "desc" },
    });

    if (exception) {
      return { ...exception, source: "EXCEPTION" };
    }

    const schedule = await prisma.workSchedule.findFirst({
      where: {
        employeeId,
        effectiveFrom: { lte: nextDay },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: base } }],
      },
      orderBy: { effectiveFrom: "desc" },
    });

    if (schedule) {
      return { ...schedule, source: "WORKSCHEDULE" };
    }
  } catch (error) {
    console.error("Failed to load schedule", { employeeId, dateISO, error });
  }

  return { ...DEFAULT_SCHEDULE };
}

export function normalizeSchedule(record: ScheduleLookupResult): Schedule {
  const type: ScheduleTypeValue = record.type ?? "FIXED";
  const breakMinutes = record.breakMinutes ?? 60;
  const raw: Record<string, unknown> = record as Record<string, unknown>;

  switch (type) {
    case "FLEX": {
      const schedule: ScheduleFlex = {
        type: "FLEX",
        coreStart: asHHMM((raw.coreStart as string | undefined) ?? null, "10:00") as ScheduleFlex["coreStart"],
        coreEnd: asHHMM((raw.coreEnd as string | undefined) ?? null, "15:00") as ScheduleFlex["coreEnd"],
        bandwidthStart: asHHMM((raw.bandwidthStart as string | undefined) ?? null, "06:00") as ScheduleFlex["bandwidthStart"],
        bandwidthEnd: asHHMM((raw.bandwidthEnd as string | undefined) ?? null, "20:00") as ScheduleFlex["bandwidthEnd"],
        requiredDailyMinutes: (raw.requiredDailyMinutes as number | undefined) ?? 480,
        breakMinutes,
      };
      return schedule;
    }
    case "SHIFT": {
      const schedule: ScheduleShift = {
        type: "SHIFT",
        shiftStart: asHHMM((raw.shiftStart as string | undefined) ?? null, "22:00") as ScheduleShift["shiftStart"],
        shiftEnd: asHHMM((raw.shiftEnd as string | undefined) ?? null, "06:00") as ScheduleShift["shiftEnd"],
        breakMinutes,
        graceMinutes: record.graceMinutes ?? 0,
      };
      return schedule;
    }
    case "FIXED":
    default: {
      const schedule: ScheduleFixed = {
        type: "FIXED",
        startTime: asHHMM(record.startTime, "08:00") as ScheduleFixed["startTime"],
        endTime: asHHMM(record.endTime, "17:00") as ScheduleFixed["endTime"],
        breakMinutes,
        graceMinutes: record.graceMinutes ?? 0,
      };
      return schedule;
    }
  }
}

type ScheduleKey = `${string}||${string}`;

const toScheduleKey = (employeeId: string, dateISO: string): ScheduleKey => `${employeeId}||${dateISO}`;

const toDateISO = (value: Date) => value.toISOString().slice(0, 10);

export async function loadNormalizedSchedulesForMonth(
  rows: Array<{ employeeId: string; dateISO: string }>,
  monthISO: string
): Promise<Map<ScheduleKey, Schedule>> {
  const employeeIds = Array.from(new Set(rows.map((row) => row.employeeId).filter(Boolean)));
  if (!employeeIds.length) {
    return new Map();
  }

  const monthStart = startOfDay(new Date(`${monthISO}-01T00:00:00Z`));
  const nextMonthStart = startOfDay(addMonths(monthStart, 1));

  try {
    const [exceptions, schedules] = await prisma.$transaction([
      prisma.scheduleException.findMany({
        where: {
          employeeId: { in: employeeIds },
          date: {
            gte: monthStart,
            lt: nextMonthStart,
          },
        },
        orderBy: { date: "desc" },
      }),
      prisma.workSchedule.findMany({
        where: {
          employeeId: { in: employeeIds },
          effectiveFrom: { lt: nextMonthStart },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: monthStart } }],
        },
        orderBy: { effectiveFrom: "desc" },
      }),
    ]);

    const exceptionMap = new Map<ScheduleKey, ScheduleException & { source: "EXCEPTION" }>();
    for (const exception of exceptions) {
      const key = toScheduleKey(exception.employeeId, toDateISO(exception.date));
      if (!exceptionMap.has(key)) {
        exceptionMap.set(key, { ...exception, source: "EXCEPTION" });
      }
    }

    const scheduleByEmployee = new Map<string, Array<WorkSchedule & { source: "WORKSCHEDULE" }>>();
    for (const schedule of schedules) {
      const list = scheduleByEmployee.get(schedule.employeeId) ?? [];
      list.push({ ...schedule, source: "WORKSCHEDULE" });
      scheduleByEmployee.set(schedule.employeeId, list);
    }

    for (const list of scheduleByEmployee.values()) {
      list.sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime());
    }

    const normalized = new Map<ScheduleKey, Schedule>();

    for (const { employeeId, dateISO } of rows) {
      const key = toScheduleKey(employeeId, dateISO);
      if (normalized.has(key)) {
        continue;
      }

      const exception = exceptionMap.get(key);
      if (exception) {
        normalized.set(key, normalizeSchedule(exception));
        continue;
      }

      const schedulesForEmployee = scheduleByEmployee.get(employeeId) ?? [];
      if (schedulesForEmployee.length) {
        const base = startOfDay(new Date(`${dateISO}T00:00:00Z`));
        const nextDay = addDays(base, 1);
        const match = schedulesForEmployee.find((schedule) => {
          const effectiveFrom = schedule.effectiveFrom;
          const effectiveTo = schedule.effectiveTo;
          return effectiveFrom <= nextDay && (!effectiveTo || effectiveTo >= base);
        });
        if (match) {
          normalized.set(key, normalizeSchedule(match));
          continue;
        }
      }

      normalized.set(key, normalizeSchedule(DEFAULT_SCHEDULE));
    }

    return normalized;
  } catch (error) {
    console.error("Failed to load schedules in bulk", error);
    const fallback = new Map<ScheduleKey, Schedule>();
    for (const { employeeId, dateISO } of rows) {
      const key = toScheduleKey(employeeId, dateISO);
      if (!fallback.has(key)) {
        fallback.set(key, normalizeSchedule(DEFAULT_SCHEDULE));
      }
    }
    return fallback;
  }
}

export const toWorkScheduleDto = (schedule: WorkSchedule): WorkScheduleDTO => ({
  id: schedule.id,
  employeeId: schedule.employeeId,
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
});

export const toScheduleExceptionDto = (exception: ScheduleException): ScheduleExceptionDTO => ({
  id: exception.id,
  employeeId: exception.employeeId,
  date: exception.date.toISOString(),
  type: exception.type,
  startTime: exception.startTime,
  endTime: exception.endTime,
  graceMinutes: exception.graceMinutes,
  coreStart: exception.coreStart,
  coreEnd: exception.coreEnd,
  bandwidthStart: exception.bandwidthStart,
  bandwidthEnd: exception.bandwidthEnd,
  requiredDailyMinutes: exception.requiredDailyMinutes,
  shiftStart: exception.shiftStart,
  shiftEnd: exception.shiftEnd,
  breakMinutes: exception.breakMinutes,
});
