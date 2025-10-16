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
import { summarizePerEmployee } from "@/utils/parseBioAttendance";
import type { WeeklyPatternWindow } from "@/utils/weeklyPattern";

type EvaluatedDay = {
  employeeId: string;
  employeeName: string;
  resolvedEmployeeId?: string | null;
  officeId?: string | null;
  officeName?: string | null;
  day: number;
  earliest: string | null | undefined;
  latest: string | null | undefined;
  allTimes?: string[];
  dateISO: string;
  internalEmployeeId: string | null;
  isLate: boolean;
  isUndertime: boolean;
  workedHHMM: string;
  workedMinutes: number;
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
  lateMinutes?: number | null;
  undertimeMinutes?: number | null;
  requiredMinutes?: number | null;
  scheduleStart?: string | null;
  scheduleEnd?: string | null;
  scheduleGraceMinutes?: number | null;
  weeklyPatternApplied?: boolean;
  weeklyPatternWindows?: WeeklyPatternWindow[] | null;
  weeklyPatternPresence?: { start: string; end: string }[];
  identityStatus?: "matched" | "unmatched" | "ambiguous";
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
  resolvedEmployeeId: z.string().min(1).nullable().optional(),
  officeId: z.string().min(1).nullable().optional(),
  officeName: z.string().min(1).nullable().optional(),
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
        resolvedEmployeeId: row.resolvedEmployeeId ?? null,
        officeId: row.officeId ?? null,
        officeName: row.officeName ?? null,
        day: row.day,
        earliest: row.earliest ?? null,
        latest: row.latest ?? null,
        allTimes: row.allTimes ?? [],
        dateISO: row.dateISO,
        internalEmployeeId,
        isLate: evaluation.isLate,
        isUndertime: evaluation.isUndertime,
        workedHHMM: evaluation.workedHHMM,
        workedMinutes: evaluation.workedMinutes,
        scheduleType: normalized.type,
        scheduleSource: scheduleRecord.source,
        punches: row.punches,
        sourceFiles: row.sourceFiles,
        employeeToken: row.employeeToken,
        lateMinutes: evaluation.lateMinutes ?? null,
        undertimeMinutes: evaluation.undertimeMinutes ?? null,
        requiredMinutes: evaluation.requiredMinutes ?? null,
        scheduleStart: evaluation.scheduleStart ?? null,
        scheduleEnd: evaluation.scheduleEnd ?? null,
        scheduleGraceMinutes: evaluation.scheduleGraceMinutes ?? null,
        weeklyPatternApplied: evaluation.weeklyPatternApplied ?? false,
        weeklyPatternWindows: evaluation.weeklyPatternWindows ?? null,
        weeklyPatternPresence: evaluation.weeklyPatternPresence ?? [],
        identityStatus: internalEmployeeId ? "matched" : "unmatched",
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

