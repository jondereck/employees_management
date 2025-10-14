import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  getScheduleMapsForMonth,
  resolveScheduleForDate,
  normalizeSchedule,
  type ScheduleSource,
} from "@/lib/schedules";
import { firstEmployeeNoToken } from "@/lib/employeeNo";
import { evaluateDay, type HHMM } from "@/utils/evaluateDay";

type EvaluatedDay = {
  employeeId: string;
  employeeName: string;
  day: number;
  earliest: string | null | undefined;
  latest: string | null | undefined;
  allTimes?: string[];
  dateISO: string;
  internalEmployeeId: string | null;
  isLate: boolean;
  isUndertime: boolean;
  workedHHMM: string;
  scheduleType: string;
  scheduleSource: ScheduleSource;
};

const hhmmRegex = /^\d{1,2}:\d{2}$/;

const Row = z.object({
  employeeId: z.string().min(1),
  employeeName: z.string().min(1),
  day: z.number().int().min(1).max(31),
  earliest: z.string().regex(hhmmRegex).nullable().optional(),
  latest: z.string().regex(hhmmRegex).nullable().optional(),
  allTimes: z.array(z.string().regex(hhmmRegex)).optional(),
});

const Payload = z.object({
  monthISO: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  perDay: z.array(Row),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { monthISO, perDay } = Payload.parse(json);

    const bioIds = Array.from(new Set(perDay.map((row) => row.employeeId)));

    const candidates: { id: string; employeeNo: string | null }[] = [];
    const CHUNK_SIZE = 200;
    for (let i = 0; i < bioIds.length; i += CHUNK_SIZE) {
      const slice = bioIds.slice(i, i + CHUNK_SIZE);
      const orConditions = slice.map((id) => ({ employeeNo: { startsWith: id } }));
      if (!orConditions.length) continue;
      const batch = await prisma.employee.findMany({
        where: { OR: orConditions },
        select: { id: true, employeeNo: true },
      });
      candidates.push(...batch);
    }

    const bioToInternal = new Map<string, string>();
    for (const candidate of candidates) {
      const token = firstEmployeeNoToken(candidate.employeeNo);
      if (token && !bioToInternal.has(token)) {
        bioToInternal.set(token, candidate.id);
      }
    }

    const from = new Date(`${monthISO}-01T00:00:00.000Z`);
    const nextMonth = new Date(from);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    const to = new Date(nextMonth.getTime() - 1);

    const internalIds = Array.from(new Set(bioToInternal.values()));
    const maps = await getScheduleMapsForMonth(internalIds, { from, to });

    const evaluatedPerDay: EvaluatedDay[] = perDay.map((row) => {
      const dateISO = `${monthISO}-${String(row.day).padStart(2, "0")}`;
      const internalEmployeeId = bioToInternal.get(row.employeeId) ?? null;
      const scheduleRecord = resolveScheduleForDate(internalEmployeeId, dateISO, maps);
      const normalized = normalizeSchedule(scheduleRecord);
      const earliest = (row.earliest ?? null) as HHMM | null;
      const latest = (row.latest ?? null) as HHMM | null;
      const allTimes = (row.allTimes ?? []) as HHMM[];

      const evaluation = evaluateDay({
        dateISO,
        earliest,
        latest,
        allTimes,
        schedule: normalized,
      });

      return {
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        day: row.day,
        earliest: row.earliest ?? null,
        latest: row.latest ?? null,
        allTimes: row.allTimes ?? [],
        dateISO,
        internalEmployeeId,
        isLate: evaluation.isLate,
        isUndertime: evaluation.isUndertime,
        workedHHMM: evaluation.workedHHMM,
        scheduleType: normalized.type,
        scheduleSource: scheduleRecord.source,
      };
    });

    const perEmployee = summarizePerEmployee(evaluatedPerDay);

    return NextResponse.json({ perDay: evaluatedPerDay, perEmployee });
  } catch (error) {
    console.error("Failed to evaluate attendance", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to evaluate attendance";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type Aggregate = {
  employeeId: string;
  employeeName: string;
  daysWithLogs: number;
  lateDays: number;
  undertimeDays: number;
  scheduleTypes: Set<string>;
  scheduleSourceSet: Set<ScheduleSource>;
};

function summarizePerEmployee(rows: EvaluatedDay[]) {
  const map = new Map<string, Aggregate>();

  for (const row of rows) {
    const key = `${row.employeeId}||${row.employeeName}`;
    if (!map.has(key)) {
      map.set(key, {
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        daysWithLogs: 0,
        lateDays: 0,
        undertimeDays: 0,
        scheduleTypes: new Set(),
        scheduleSourceSet: new Set(),
      });
    }

    const agg = map.get(key)!;
    const hasLogs = Boolean(row.earliest || row.latest || (row.allTimes?.length ?? 0) > 0);
    if (hasLogs) {
      agg.daysWithLogs += 1;
      if (row.isLate) agg.lateDays += 1;
      if (row.isUndertime) agg.undertimeDays += 1;
    }

    if (row.scheduleType) {
      agg.scheduleTypes.add(row.scheduleType);
    }
    if (row.scheduleSource) {
      agg.scheduleSourceSet.add(row.scheduleSource);
    }
  }

  return Array.from(map.values()).map((entry) => ({
    employeeId: entry.employeeId,
    employeeName: entry.employeeName,
    daysWithLogs: entry.daysWithLogs,
    lateDays: entry.lateDays,
    undertimeDays: entry.undertimeDays,
    lateRate: entry.daysWithLogs ? +((entry.lateDays / entry.daysWithLogs) * 100).toFixed(1) : 0,
    undertimeRate: entry.daysWithLogs ? +((entry.undertimeDays / entry.daysWithLogs) * 100).toFixed(1) : 0,
    scheduleTypes: Array.from(entry.scheduleTypes).sort(),
    scheduleSource: pickSource(Array.from(entry.scheduleSourceSet)),
  }));
}

const SOURCE_PRIORITY: ScheduleSource[] = ["EXCEPTION", "WORKSCHEDULE", "DEFAULT", "NOMAPPING"];

function pickSource(sources: ScheduleSource[]) {
  if (!sources.length) return "DEFAULT" as ScheduleSource;
  return sources.sort((a, b) => SOURCE_PRIORITY.indexOf(a) - SOURCE_PRIORITY.indexOf(b))[0] ?? "DEFAULT";
}
