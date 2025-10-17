import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  getScheduleMapsForMonth,
  normalizeSchedule,
  resolveScheduleForDate,
} from "@/lib/schedules";
import { findWeeklyExclusionForDate } from "@/lib/weeklyExclusions";
import {
  evaluateDay,
  normalizePunchTimes,
  type HHMM,
} from "@/utils/evaluateDay";
import { summarizePerEmployee } from "@/utils/parseBioAttendance";
import type { WeeklyPatternWindow } from "@/utils/weeklyPattern";
import {
  normalizeBiometricToken,
  resolveBiometricTokenPadLength,
  UNASSIGNED_OFFICE_LABEL,
} from "@/utils/biometricsShared";

const hhmmRegex = /^\d{1,2}:\d{2}$/;

const Punch = z.object({
  time: z.string().regex(hhmmRegex),
  minuteOfDay: z.number().int().min(0).max(1439),
  source: z.enum(["original", "merged"]),
  files: z.array(z.string()),
});

const Entry = z.object({
  employeeId: z.string().min(1),
  employeeToken: z.string().min(1).optional(),
  employeeName: z.string().min(1),
  officeId: z.string().min(1).nullable().optional(),
  officeName: z.string().min(1).nullable().optional(),
  dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  day: z.number().int().min(1).max(31),
  earliest: z.string().regex(hhmmRegex).nullable().optional(),
  latest: z.string().regex(hhmmRegex).nullable().optional(),
  allTimes: z.array(z.string().regex(hhmmRegex)).default([]),
  punches: z.array(Punch).default([]),
  sourceFiles: z.array(z.string()).default([]),
});

const Payload = z.object({
  sessionId: z.string().min(1),
  token: z.string().min(1),
  employeeId: z.string().min(1),
  entries: z.array(Entry),
});

const formatEmployeeName = (employee: {
  lastName: string;
  firstName: string;
  middleName: string | null;
  suffix: string | null;
}): string => {
  const last = employee.lastName?.trim();
  const first = employee.firstName?.trim();
  const middle = employee.middleName?.trim();
  const suffix = employee.suffix?.trim();

  const middleInitial = middle
    ? middle
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => `${part.charAt(0).toUpperCase()}.`)
        .join(" ")
    : "";

  const pieces = [last, ", ", first];
  if (middleInitial) pieces.push(" ", middleInitial);
  if (suffix) pieces.push(" ", suffix);
  const formatted = pieces.filter(Boolean).join("");
  return formatted || first || last || "Unnamed";
};

type ReEnrichedDay = {
  employeeId: string;
  employeeToken: string;
  employeeName: string;
  resolvedEmployeeId: string;
  officeId: string | null;
  officeName: string | null;
  day: number;
  earliest: string | null;
  latest: string | null;
  allTimes: string[];
  dateISO: string;
  internalEmployeeId: string;
  status: ReturnType<typeof evaluateDay>["status"];
  isLate: boolean;
  isUndertime: boolean;
  workedHHMM: string;
  workedMinutes: number;
  scheduleType: string;
  scheduleSource: string;
  punches: Array<{
    time: string;
    minuteOfDay: number;
    source: "original" | "merged";
    files: string[];
  }>;
  sourceFiles: string[];
  lateMinutes: number | null;
  undertimeMinutes: number | null;
  requiredMinutes: number | null;
  scheduleStart: string | null;
  scheduleEnd: string | null;
  scheduleGraceMinutes: number | null;
  weeklyPatternApplied: boolean;
  weeklyPatternWindows: WeeklyPatternWindow[] | null;
  weeklyPatternPresence: { start: string; end: string }[];
  weeklyExclusionApplied: { mode: string; ignoreUntil: string | null } | null;
  weeklyExclusionMode: string | null;
  weeklyExclusionIgnoreUntil: string | null;
  weeklyExclusionId: string | null;
  identityStatus: "matched";
};

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { sessionId, token, employeeId, entries } = Payload.parse(json);

    if (!entries.length) {
      return NextResponse.json({
        token,
        sessionId,
        perDay: [] as ReEnrichedDay[],
        perEmployee: null,
      });
    }

    const padLength = resolveBiometricTokenPadLength();
    const normalizedToken = normalizeBiometricToken(token, padLength);
    if (!normalizedToken) {
      return NextResponse.json({ error: "Token cannot be empty." }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        employeeNo: true,
        firstName: true,
        lastName: true,
        middleName: true,
        suffix: true,
        offices: { select: { id: true, name: true } },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    }

    const employeeName = formatEmployeeName(employee);
    const officeId = employee.offices?.id ?? null;
    const officeName = employee.offices?.name?.trim() || UNASSIGNED_OFFICE_LABEL;

    const sortedDates = entries
      .map((row) => row.dateISO)
      .sort((a, b) => a.localeCompare(b));
    const firstDate = sortedDates[0];
    const lastDate = sortedDates[sortedDates.length - 1];

    const from = new Date(`${firstDate}T00:00:00.000Z`);
    const to = new Date(`${lastDate}T23:59:59.999Z`);

    const maps = await getScheduleMapsForMonth([employee.id], { from, to });

    const evaluatedPerDay: ReEnrichedDay[] = entries.map((row) => {
      const normalizedAllTimes = normalizePunchTimes(row.allTimes);
      const scheduleRecord = resolveScheduleForDate(employee.id, row.dateISO, maps);
      const normalizedSchedule = normalizeSchedule(scheduleRecord);
      const earliest = (row.earliest ?? null) as HHMM | null;
      const latest = (row.latest ?? null) as HHMM | null;

      const weeklyExclusion = findWeeklyExclusionForDate(
        maps.weeklyExclusionsByEmployee.get(employee.id),
        row.dateISO
      );

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

      const resolvedEmployeeId = employee.id;
      const displayEmployeeId = employee.employeeNo?.trim() || row.employeeId;

      return {
        employeeId: displayEmployeeId,
        employeeToken: row.employeeToken ?? row.employeeId,
        employeeName,
        resolvedEmployeeId,
        officeId,
        officeName,
        day: row.day,
        earliest: row.earliest ?? null,
        latest: row.latest ?? null,
        allTimes: normalizedAllTimes,
        dateISO: row.dateISO,
        internalEmployeeId: employee.id,
        status: evaluation.status,
        isLate: evaluation.isLate,
        isUndertime: evaluation.isUndertime,
        workedHHMM: evaluation.workedHHMM,
        workedMinutes: evaluation.workedMinutes,
        scheduleType: normalizedSchedule.type,
        scheduleSource: scheduleRecord.source,
        punches: row.punches,
        sourceFiles: row.sourceFiles,
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
        identityStatus: "matched",
      };
    });

    const perEmployee = summarizePerEmployee(evaluatedPerDay);
    const summaryRow = perEmployee.length ? perEmployee[0] : null;

    return NextResponse.json({
      token: normalizedToken,
      sessionId,
      perDay: evaluatedPerDay,
      perEmployee: summaryRow,
      identity: {
        employeeId: employee.id,
        employeeName,
        officeId,
        officeName,
        employeeNo: employee.employeeNo?.trim() ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to re-enrich biometrics rows", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unable to re-enrich biometrics rows.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

