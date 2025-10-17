import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  getScheduleMapsForMonth,
  resolveScheduleForDate,
  normalizeSchedule,
  DEFAULT_SCHEDULE,
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
import type { WeeklyPatternWindow } from "@/utils/weeklyPattern";
import { normalizeBiometricToken } from "@/utils/normalizeBiometricToken";
import {
  createBiometricsSession,
  type AttendanceEvaluationRow,
} from "@/lib/biometricsSessionStore";

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

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { entries } = Payload.parse(json);

    if (!entries.length) {
      return NextResponse.json({ perDay: [], perEmployee: [] });
    }

    const normalizedEntries = entries.map((entry) => ({
      ...entry,
      employeeToken: entry.employeeToken.trim(),
      employeeId: entry.employeeId.trim(),
    }));

    const tokens = new Set<string>();
    const rawTokens = new Set<string>();
    const resolvedIds = new Map<string, string>();
    for (const entry of normalizedEntries) {
      const normalizedToken = normalizeBiometricToken(entry.employeeToken || entry.employeeId);
      if (normalizedToken) {
        tokens.add(normalizedToken);
        if (entry.resolvedEmployeeId) {
          resolvedIds.set(normalizedToken, entry.resolvedEmployeeId);
        }
      }
      const rawToken = (entry.employeeToken || entry.employeeId || "").trim();
      if (rawToken) rawTokens.add(rawToken);
    }

    const identityMapModel = (prisma as typeof prisma & {
      biometricsIdentityMap?: typeof prisma.biometricsIdentityMap;
    }).biometricsIdentityMap;

    const manualMappings = new Map<string, string>();
    if (identityMapModel && (tokens.size || rawTokens.size)) {
      const lookupTokens = new Set<string>([...tokens, ...rawTokens]);
      const stored = await identityMapModel.findMany({
        where: { token: { in: Array.from(lookupTokens) } },
        select: { token: true, employeeId: true },
      });
      for (const mapping of stored) {
        const normalizedToken = normalizeBiometricToken(mapping.token);
        if (!normalizedToken) continue;
        manualMappings.set(normalizedToken, mapping.employeeId);
      }
    }

    const unresolvedTokens = Array.from(tokens).filter(
      (token) => !manualMappings.has(token) && !resolvedIds.has(token)
    );

    const candidateEmployees: { id: string; employeeNo: string | null }[] = [];
    if (unresolvedTokens.length) {
      const CHUNK_SIZE = 200;
      for (let i = 0; i < unresolvedTokens.length; i += CHUNK_SIZE) {
        const slice = unresolvedTokens.slice(i, i + CHUNK_SIZE);
        const orConditions = slice.map((token) => ({ employeeNo: { startsWith: token } }));
        if (!orConditions.length) continue;
        const batch = await prisma.employee.findMany({
          where: { OR: orConditions },
          select: { id: true, employeeNo: true },
        });
        candidateEmployees.push(...batch);
      }
    }

    const autoMappings = new Map<string, string>();
    for (const candidate of candidateEmployees) {
      const token = normalizeBiometricToken(firstEmployeeNoToken(candidate.employeeNo));
      if (!token) continue;
      if (!autoMappings.has(token)) {
        autoMappings.set(token, candidate.id);
      }
    }

    const tokenToEmployeeId = new Map<string, string | null>();
    const mappedEmployeeIds = new Set<string>();
    for (const token of tokens) {
      const employeeId =
        manualMappings.get(token) ?? resolvedIds.get(token) ?? autoMappings.get(token) ?? null;
      tokenToEmployeeId.set(token, employeeId);
      if (employeeId) mappedEmployeeIds.add(employeeId);
    }

    const sortedDates = entries
      .map((row) => row.dateISO)
      .sort((a, b) => a.localeCompare(b));
    const firstDate = sortedDates[0];
    const lastDate = sortedDates[sortedDates.length - 1];

    const from = new Date(`${firstDate}T00:00:00.000Z`);
    const to = new Date(`${lastDate}T23:59:59.999Z`);

    const maps = await getScheduleMapsForMonth(Array.from(mappedEmployeeIds), { from, to });

    const evaluationEntries: AttendanceEvaluationRow[] = normalizedEntries.map((row) => ({
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      resolvedEmployeeId: row.resolvedEmployeeId ?? null,
      officeId: row.officeId ?? null,
      officeName: row.officeName ?? null,
      employeeToken: row.employeeToken,
      dateISO: row.dateISO,
      day: row.day,
      earliest: row.earliest ?? null,
      latest: row.latest ?? null,
      allTimes: row.allTimes,
      punches: row.punches ?? [],
      sourceFiles: row.sourceFiles ?? [],
    }));

    const evaluatedPerDay: EvaluatedDay[] = normalizedEntries.map((row) => {
      const normalizedToken = normalizeBiometricToken(row.employeeToken || row.employeeId);
      const mappedEmployeeId = normalizedToken ? tokenToEmployeeId.get(normalizedToken) ?? null : null;

      const scheduleRecord = mappedEmployeeId
        ? resolveScheduleForDate(mappedEmployeeId, row.dateISO, maps)
        : { ...DEFAULT_SCHEDULE, source: "NOMAPPING" as ScheduleSource };
      const normalized = normalizeSchedule(scheduleRecord);
      const earliest = (row.earliest ?? null) as HHMM | null;
      const latest = (row.latest ?? null) as HHMM | null;
      const normalizedAllTimes = normalizePunchTimes(row.allTimes);

      const weeklyExclusion = mappedEmployeeId
        ? findWeeklyExclusionForDate(
            maps.weeklyExclusionsByEmployee.get(mappedEmployeeId),
            row.dateISO
          )
        : null;

      const evaluation = evaluateDay({
        dateISO: row.dateISO,
        earliest,
        latest,
        allTimes: normalizedAllTimes,
        schedule: normalized,
        weeklyExclusion: weeklyExclusion
          ? {
              mode: weeklyExclusion.mode,
              ignoreUntilMinutes: weeklyExclusion.ignoreUntilMinutes,
            }
          : null,
      });

      const identityStatus = mappedEmployeeId ? "matched" : "unmatched";

      return {
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        resolvedEmployeeId: row.resolvedEmployeeId ?? mappedEmployeeId ?? null,
        officeId: row.officeId ?? null,
        officeName: row.officeName ?? null,
        day: row.day,
        earliest: row.earliest ?? null,
        latest: row.latest ?? null,
        allTimes: normalizedAllTimes,
        dateISO: row.dateISO,
        internalEmployeeId: mappedEmployeeId,
        status: evaluation.status,
        isLate: evaluation.isLate,
        isUndertime: evaluation.isUndertime,
        workedHHMM: evaluation.workedHHMM,
        workedMinutes: evaluation.workedMinutes,
        scheduleType: normalized.type,
        scheduleSource: scheduleRecord.source,
        punches: row.punches ?? [],
        sourceFiles: row.sourceFiles ?? [],
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
        identityStatus,
      };
    });

    const perEmployee = summarizePerEmployee(evaluatedPerDay);

    const sessionId = createBiometricsSession({
      entries: evaluationEntries,
      perDay: evaluatedPerDay,
      perEmployee,
      tokenToEmployeeId,
    });

    return NextResponse.json({ perDay: evaluatedPerDay, perEmployee, sessionId });
  } catch (error) {
    console.error("Failed to evaluate attendance", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to evaluate attendance";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

