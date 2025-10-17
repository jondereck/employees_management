import { addDays, startOfDay } from "date-fns";
import { ScheduleException, WorkSchedule } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { Schedule, ScheduleFlex, ScheduleFixed, ScheduleShift } from "@/utils/evaluateDay";
import { sanitizeWeeklyPattern } from "@/utils/weeklyPattern";
import {
  toWeeklyExclusionEvaluation,
  type WeeklyExclusionEvaluation,
} from "@/lib/weeklyExclusions";

export type ScheduleSource = "EXCEPTION" | "WORKSCHEDULE" | "DEFAULT" | "NOMAPPING";

export type NormalizedSchedule = Schedule & { source: ScheduleSource };

export type ScheduleTypeValue = "FIXED" | "FLEX" | "SHIFT";

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
  source: "DEFAULT" | "NOMAPPING";
};

type ScheduleLookupResult =
  | (ScheduleException & { source: "EXCEPTION" })
  | (WorkSchedule & { source: "WORKSCHEDULE" })
  | DefaultSchedule;

const asHHMM = (value: string | null | undefined, fallback: string): string => {
  const trimmed = (value ?? "").trim();
  return trimmed || fallback;
};

const defaultFixed = (): DefaultSchedule => ({
  type: "FIXED",
  startTime: "08:00",
  endTime: "17:00",
  breakMinutes: 60,
  graceMinutes: 0,
  source: "DEFAULT",
});

export const DEFAULT_SCHEDULE: DefaultSchedule = Object.freeze(defaultFixed());

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

const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

export type MonthWindow = { from: Date; to: Date };

export async function getScheduleMapsForMonth(
  internalEmployeeIds: string[],
  window: MonthWindow
) {
  if (!internalEmployeeIds.length) {
    return {
      schedulesByEmployee: new Map<string, WorkSchedule[]>(),
      exceptionsByEmployeeDate: new Map<string, ScheduleException>(),
      weeklyExclusionsByEmployee: new Map<string, WeeklyExclusionEvaluation[]>(),
    };
  }

  const [schedules, exceptions, weeklyExclusions] = await Promise.all([
    prisma.workSchedule.findMany({
      where: {
        employeeId: { in: internalEmployeeIds },
        effectiveFrom: { lte: window.to },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: window.from } }],
      },
      orderBy: [{ employeeId: "asc" }, { effectiveFrom: "desc" }],
    }),
    prisma.scheduleException.findMany({
      where: {
        employeeId: { in: internalEmployeeIds },
        date: { gte: window.from, lte: window.to },
      },
    }),
    prisma.weeklyExclusion.findMany({
      where: {
        employeeId: { in: internalEmployeeIds },
        effectiveFrom: { lte: window.to },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: window.from } }],
      },
      orderBy: [{ employeeId: "asc" }, { effectiveFrom: "desc" }],
    }),
  ]);

  const schedulesByEmployee = new Map<string, WorkSchedule[]>();
  for (const schedule of schedules) {
    const list = schedulesByEmployee.get(schedule.employeeId) ?? [];
    list.push(schedule);
    schedulesByEmployee.set(schedule.employeeId, list);
  }
  for (const list of schedulesByEmployee.values()) {
    list.sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime());
  }

  const exceptionsByEmployeeDate = new Map<string, ScheduleException>();
  for (const exception of exceptions) {
    const key = `${exception.employeeId}::${toDateKey(exception.date)}`;
    exceptionsByEmployeeDate.set(key, exception);
  }

  const weeklyExclusionsByEmployee = new Map<string, WeeklyExclusionEvaluation[]>();
  for (const exclusion of weeklyExclusions) {
    const list = weeklyExclusionsByEmployee.get(exclusion.employeeId) ?? [];
    list.push(toWeeklyExclusionEvaluation(exclusion));
    weeklyExclusionsByEmployee.set(exclusion.employeeId, list);
  }
  for (const list of weeklyExclusionsByEmployee.values()) {
    list.sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime());
  }

  return { schedulesByEmployee, exceptionsByEmployeeDate, weeklyExclusionsByEmployee };
}

export function resolveScheduleForDate(
  internalEmployeeId: string | null,
  dateISO: string,
  maps: {
    schedulesByEmployee: Map<string, WorkSchedule[]>;
    exceptionsByEmployeeDate: Map<string, ScheduleException>;
    weeklyExclusionsByEmployee?: Map<string, WeeklyExclusionEvaluation[]>;
  }
): ScheduleLookupResult {
  if (!internalEmployeeId) {
    return { ...defaultFixed(), source: "NOMAPPING" };
  }

  const exception = maps.exceptionsByEmployeeDate.get(`${internalEmployeeId}::${dateISO}`);
  if (exception) {
    return { ...exception, source: "EXCEPTION" };
  }

  const list = maps.schedulesByEmployee.get(internalEmployeeId) ?? [];
  if (list.length) {
    const dayStart = startOfDay(new Date(`${dateISO}T00:00:00Z`));
    const dayEnd = addDays(dayStart, 1);
    const match = list.find((schedule) => {
      const effectiveFrom = schedule.effectiveFrom;
      const effectiveTo = schedule.effectiveTo;
      return effectiveFrom <= dayEnd && (!effectiveTo || effectiveTo >= dayStart);
    });
    if (match) {
      return { ...match, source: "WORKSCHEDULE" };
    }
  }

  return { ...defaultFixed() };
}

export function normalizeSchedule(record: ScheduleLookupResult): NormalizedSchedule {
  const type: ScheduleTypeValue = record.type ?? "FIXED";
  const breakMinutes = record.breakMinutes ?? 60;
  const raw: Record<string, unknown> = record as Record<string, unknown>;

  switch (type) {
    case "FLEX": {
      const schedule: ScheduleFlex & { source: ScheduleSource } = {
        type: "FLEX",
        coreStart: asHHMM((raw.coreStart as string | undefined) ?? null, "10:00") as ScheduleFlex["coreStart"],
        coreEnd: asHHMM((raw.coreEnd as string | undefined) ?? null, "15:00") as ScheduleFlex["coreEnd"],
        bandwidthStart: asHHMM((raw.bandwidthStart as string | undefined) ?? null, "06:00") as ScheduleFlex["bandwidthStart"],
        bandwidthEnd: asHHMM((raw.bandwidthEnd as string | undefined) ?? null, "20:00") as ScheduleFlex["bandwidthEnd"],
        requiredDailyMinutes: (raw.requiredDailyMinutes as number | undefined) ?? 480,
        breakMinutes,
        source: (record.source ?? "DEFAULT") as ScheduleSource,
      };
      const weeklyPattern = sanitizeWeeklyPattern(raw.weeklyPattern);
      if (weeklyPattern) {
        schedule.weeklyPattern = weeklyPattern;
      }
      return schedule;
    }
    case "SHIFT": {
      const schedule: ScheduleShift & { source: ScheduleSource } = {
        type: "SHIFT",
        shiftStart: asHHMM((raw.shiftStart as string | undefined) ?? null, "22:00") as ScheduleShift["shiftStart"],
        shiftEnd: asHHMM((raw.shiftEnd as string | undefined) ?? null, "06:00") as ScheduleShift["shiftEnd"],
        breakMinutes,
        graceMinutes: record.graceMinutes ?? 0,
        source: (record.source ?? "DEFAULT") as ScheduleSource,
      };
      return schedule;
    }
    case "FIXED":
    default: {
      const schedule: ScheduleFixed & { source: ScheduleSource } = {
        type: "FIXED",
        startTime: asHHMM(record.startTime, "08:00") as ScheduleFixed["startTime"],
        endTime: asHHMM(record.endTime, "17:00") as ScheduleFixed["endTime"],
        breakMinutes,
        graceMinutes: record.graceMinutes ?? 0,
        source: (record.source ?? "DEFAULT") as ScheduleSource,
      };
      return schedule;
    }
  }
}

export const toWorkScheduleDto = (schedule: WorkSchedule) => ({
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
  weeklyPattern: sanitizeWeeklyPattern(schedule.weeklyPattern),
  shiftStart: schedule.shiftStart,
  shiftEnd: schedule.shiftEnd,
  breakMinutes: schedule.breakMinutes,
  timezone: schedule.timezone,
  effectiveFrom: schedule.effectiveFrom.toISOString(),
  effectiveTo: schedule.effectiveTo ? schedule.effectiveTo.toISOString() : null,
});

export type WorkScheduleDTO = ReturnType<typeof toWorkScheduleDto>;

export const toScheduleExceptionDto = (exception: ScheduleException) => ({
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

export type ScheduleExceptionDTO = ReturnType<typeof toScheduleExceptionDto>;
