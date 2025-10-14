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
  punches?: Array<{
    time: string;
    minuteOfDay: number;
    source: "original" | "merged";
    files: string[];
  }>;
  sourceFiles?: string[];
  employeeToken?: string;
};

const hhmmRegex = /^\d{1,2}:\d{2}$/;

const Punch = z.object({
  time: z.string().regex(hhmmRegex),
  minuteOfDay: z.number().int().min(0).max(1439),
  source: z.enum(["original", "merged"]),
  files: z.array(z.string()),
});

const Row = z.object({
  employeeId: z.string().min(1),
  employeeName: z.string().min(1),
  employeeToken: z.string().min(1),
  dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  day: z.number().int().min(1).max(31),
  earliest: z.string().regex(hhmmRegex).nullable().optional(),
  latest: z.string().regex(hhmmRegex).nullable().optional(),
  allTimes: z.array(z.string().regex(hhmmRegex)).default([]),
  punches: z.array(Punch).default([]),
  sourceFiles: z.array(z.string()).default([]),
});

const Payload = z.object({
  entries: z.array(Row),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { entries } = Payload.parse(json);

    if (!entries.length) {
      return NextResponse.json({ perDay: [], perEmployee: [] });
    }

    const bioIds = Array.from(new Set(entries.map((row) => row.employeeId)));

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

    const sortedDates = entries
      .map((row) => row.dateISO)
      .sort((a, b) => a.localeCompare(b));
    const firstDate = sortedDates[0];
    const lastDate = sortedDates[sortedDates.length - 1];

    const from = new Date(`${firstDate}T00:00:00.000Z`);
    const to = new Date(`${lastDate}T23:59:59.999Z`);

    const internalIds = Array.from(new Set(bioToInternal.values()));
    const maps = await getScheduleMapsForMonth(internalIds, { from, to });

    const evaluatedPerDay: EvaluatedDay[] = entries.map((row) => {
      const internalEmployeeId = bioToInternal.get(row.employeeId) ?? null;
      const scheduleRecord = resolveScheduleForDate(internalEmployeeId, row.dateISO, maps);
      const normalized = normalizeSchedule(scheduleRecord);
      const earliest = (row.earliest ?? null) as HHMM | null;
      const latest = (row.latest ?? null) as HHMM | null;
      const allTimes = (row.allTimes ?? []) as HHMM[];

      const evaluation = evaluateDay({
        dateISO: row.dateISO,
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
        dateISO: row.dateISO,
        internalEmployeeId,
        isLate: evaluation.isLate,
        isUndertime: evaluation.isUndertime,
        workedHHMM: evaluation.workedHHMM,
        scheduleType: normalized.type,
        scheduleSource: scheduleRecord.source,
        punches: row.punches,
        sourceFiles: row.sourceFiles,
        employeeToken: row.employeeToken,
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
