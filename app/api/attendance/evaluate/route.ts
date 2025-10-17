import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  getScheduleMapsForMonth,
  resolveScheduleForDate,
  normalizeSchedule,
  type ScheduleSource,
} from "@/lib/schedules";
import { findWeeklyExclusionForDate } from "@/lib/weeklyExclusions";
import { firstEmployeeNoToken } from "@/lib/employeeNo";
import {
  evaluateDay,
  normalizePunchTimes,
  type DayEvaluationStatus,
  type HHMM,
} from "@/utils/evaluateDay";
import { summarizePerEmployee } from "@/utils/parseBioAttendance";
import type { PerEmployeeRow } from "@/utils/parseBioAttendance";
import { normalizeBiometricToken } from "@/utils/biometricsShared";
import type { WeeklyPatternWindow } from "@/utils/weeklyPattern";

type EvaluatedDay = {
  employeeId: string;
  employeeName: string;
  resolvedEmployeeId?: string | null;
  officeId?: string | null;
  officeName?: string | null;
  day: number;
  earliest: string | null;
  latest: string | null;
  allTimes: string[];
  dateISO: string;
  internalEmployeeId: string | null;
  status: DayEvaluationStatus;
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
  employeeToken: string;
  lateMinutes?: number | null;
  undertimeMinutes?: number | null;
  requiredMinutes?: number | null;
  scheduleStart?: string | null;
  scheduleEnd?: string | null;
  scheduleGraceMinutes?: number | null;
  weeklyPatternApplied?: boolean;
  weeklyPatternWindows?: WeeklyPatternWindow[] | null;
  weeklyPatternPresence: { start: string; end: string }[];
  weeklyExclusionApplied?: { mode: string; ignoreUntil: string | null } | null;
  weeklyExclusionMode?: string | null;
  weeklyExclusionIgnoreUntil?: string | null;
  weeklyExclusionId?: string | null;
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

export type AttendanceRow = z.infer<typeof Row>;
export const AttendanceRowSchema = Row;

type AttendanceEvaluationResult = {
  perDay: EvaluatedDay[];
  perEmployee: PerEmployeeRow[];
  manualMappings: string[];
};

const collectEmployeesWithSchedule = (
  maps: Awaited<ReturnType<typeof getScheduleMapsForMonth>>,
  window: { from: Date; to: Date }
) => {
  const presence = new Map<string, boolean>();
  for (const [employeeId, schedules] of maps.schedulesByEmployee.entries()) {
    const hasActive = schedules.some((schedule) => {
      const effectiveFrom = schedule.effectiveFrom;
      const effectiveTo = schedule.effectiveTo;
      return effectiveFrom <= window.to && (!effectiveTo || effectiveTo >= window.from);
    });
    if (hasActive) {
      presence.set(employeeId, true);
    }
  }
  for (const [key] of maps.exceptionsByEmployeeDate.entries()) {
    const [employeeId, dateKey] = key.split("::");
    if (!employeeId || !dateKey) continue;
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    if (date >= window.from && date <= window.to) {
      presence.set(employeeId, true);
    }
  }
  return presence;
};

export async function evaluateAttendance(
  entries: AttendanceRow[]
): Promise<AttendanceEvaluationResult> {
  if (!entries.length) {
    return { perDay: [], perEmployee: [], manualMappings: [] };
  }

  const sanitizedEntries = entries.map((row) => ({
    ...row,
    employeeId: row.employeeId.trim(),
    employeeToken: row.employeeToken.trim(),
    employeeName: row.employeeName.trim(),
  }));

  const normalizedTokenLookup = new Map<string, string>();
  for (const row of sanitizedEntries) {
    const normalized = normalizeBiometricToken(row.employeeToken);
    if (!normalized || normalizedTokenLookup.has(normalized)) continue;
    normalizedTokenLookup.set(normalized, row.employeeToken);
  }

  const lookupTokens = Array.from(new Set(normalizedTokenLookup.values()));

  const candidates: { id: string; employeeNo: string | null }[] = [];
  const CHUNK_SIZE = 200;
  for (let i = 0; i < lookupTokens.length; i += CHUNK_SIZE) {
    const slice = lookupTokens.slice(i, i + CHUNK_SIZE);
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
    const normalized = normalizeBiometricToken(token);
    if (normalized && !bioToInternal.has(normalized)) {
      bioToInternal.set(normalized, candidate.id);
    }
  }

  const identityMapModel = (prisma as typeof prisma & {
    biometricsIdentityMap?: typeof prisma.biometricsIdentityMap;
  }).biometricsIdentityMap;

  const manualMappingTokens = new Set<string>();

  if (identityMapModel && lookupTokens.length) {
    const mappings = await identityMapModel.findMany({
      where: { token: { in: lookupTokens } },
      select: { token: true, employeeId: true },
    });
    for (const mapping of mappings) {
      const normalized = normalizeBiometricToken(mapping.token);
      if (!normalized) continue;
      bioToInternal.set(normalized, mapping.employeeId);
      manualMappingTokens.add(mapping.token.trim());
    }
  }

  const sortedDates = sanitizedEntries
    .map((row) => row.dateISO)
    .sort((a, b) => a.localeCompare(b));
  const firstDate = sortedDates[0];
  const lastDate = sortedDates[sortedDates.length - 1];

  const from = new Date(`${firstDate}T00:00:00.000Z`);
  const to = new Date(`${lastDate}T23:59:59.999Z`);

  const internalIds = Array.from(new Set(bioToInternal.values()));
  const maps = await getScheduleMapsForMonth(internalIds, { from, to });
  const schedulePresence = collectEmployeesWithSchedule(maps, { from, to });

  const evaluatedPerDay: EvaluatedDay[] = sanitizedEntries.map((row) => {
    const normalized = normalizeBiometricToken(row.employeeToken);
    const internalEmployeeId = normalized ? bioToInternal.get(normalized) ?? null : null;
    const scheduleRecord = resolveScheduleForDate(internalEmployeeId, row.dateISO, maps);
    const normalizedSchedule = normalizeSchedule(scheduleRecord);
    const earliest = (row.earliest ?? null) as HHMM | null;
    const latest = (row.latest ?? null) as HHMM | null;
    const normalizedAllTimes = normalizePunchTimes(row.allTimes);

    const weeklyExclusion = internalEmployeeId
      ? findWeeklyExclusionForDate(
          maps.weeklyExclusionsByEmployee.get(internalEmployeeId),
          row.dateISO
        )
      : null;

    const evaluation = evaluateDay({
      dateISO: row.dateISO,
      earliest,
      latest,
      allTimes: normalizedAllTimes,
      schedule: normalizedSchedule,
      weeklyExclusion: weeklyExclusion
        ? {
            mode: weeklyExclusion.mode,
            ignoreUntilMinutes: weeklyExclusion.ignoreUntilMinutes,
          }
        : null,
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
      allTimes: normalizedAllTimes,
      dateISO: row.dateISO,
      internalEmployeeId,
      status: evaluation.status,
      isLate: evaluation.isLate,
      isUndertime: evaluation.isUndertime,
      workedHHMM: evaluation.workedHHMM,
      workedMinutes: evaluation.workedMinutes,
      scheduleType: normalizedSchedule.type,
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
      weeklyExclusionApplied: evaluation.weeklyExclusionApplied ?? null,
      weeklyExclusionMode: weeklyExclusion?.mode ?? null,
      weeklyExclusionIgnoreUntil: weeklyExclusion?.ignoreUntilLabel ?? null,
      weeklyExclusionId: weeklyExclusion?.id ?? null,
      identityStatus: internalEmployeeId ? "matched" : "unmatched",
    };
  });

  const perEmployee = summarizePerEmployee(evaluatedPerDay, {
    manualMappingTokens,
    employeeSchedulePresence: schedulePresence,
  });

  return {
    perDay: evaluatedPerDay,
    perEmployee,
    manualMappings: Array.from(manualMappingTokens),
  };
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { entries } = Payload.parse(json);

    const result = await evaluateAttendance(entries);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to evaluate attendance", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to evaluate attendance";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

