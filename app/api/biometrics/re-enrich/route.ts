import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getScheduleMapsForMonth, resolveScheduleForDate, normalizeSchedule } from "@/lib/schedules";
import { findWeeklyExclusionForDate } from "@/lib/weeklyExclusions";
import {
  getBiometricsSession,
  touchBiometricsSession,
  updateSessionTokenData,
} from "@/lib/biometricsSessionStore";
import type { AttendanceEvaluationRow } from "@/lib/biometricsSessionStore";
import { evaluateDay, normalizePunchTimes, type HHMM } from "@/utils/evaluateDay";
import type { PerDayRow, PerEmployeeRow } from "@/utils/parseBioAttendance";
import { summarizePerEmployee } from "@/utils/parseBioAttendance";
import { normalizeBiometricToken } from "@/utils/normalizeBiometricToken";
import { formatEmployeeName } from "@/utils/formatEmployeeName";

const Payload = z.object({
  sessionId: z.string().uuid(),
  token: z.string().min(1),
  employeeId: z.string().min(1),
});

const buildPerDayKey = (row: { employeeToken?: string | null; dateISO: string }) =>
  `${normalizeBiometricToken(row.employeeToken || "")}:${row.dateISO}`;

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { sessionId, token, employeeId } = Payload.parse(json);

    const normalizedToken = normalizeBiometricToken(token);
    if (!normalizedToken) {
      return NextResponse.json({ error: "Token cannot be empty." }, { status: 400 });
    }

    const session = getBiometricsSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const entryIndexes = session.entryIndexesByToken.get(normalizedToken) ?? [];
    const perDayIndexes = session.perDayIndexesByToken.get(normalizedToken) ?? [];

    if (!entryIndexes.length || !perDayIndexes.length) {
      return NextResponse.json({ error: "Token is not part of the session." }, { status: 404 });
    }

    touchBiometricsSession(sessionId);

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

    const officeName = employee.offices?.name?.trim() || "(Unassigned)";
    const officeId = employee.offices?.id ?? null;
    const displayName = formatEmployeeName(employee);

    const affectedEntries = entryIndexes.map((index) => session.entries[index]);
    const affectedPerDay = perDayIndexes.map((index) => session.perDay[index]);

    const uniqueDates = Array.from(new Set(affectedEntries.map((entry) => entry.dateISO))).sort();
    const firstDate = uniqueDates[0];
    const lastDate = uniqueDates[uniqueDates.length - 1];

    const from = new Date(`${firstDate}T00:00:00.000Z`);
    const to = new Date(`${lastDate}T23:59:59.999Z`);

    const maps = await getScheduleMapsForMonth([employeeId], { from, to });

    const updatedPerDay: PerDayRow[] = [];
    const updatedEntries: AttendanceEvaluationRow[] = [];

    for (let i = 0; i < affectedEntries.length; i += 1) {
      const entry = affectedEntries[i];
      const baseRow = affectedPerDay[i];
      const normalizedAllTimes = normalizePunchTimes(entry.allTimes);
      const scheduleRecord = resolveScheduleForDate(employeeId, entry.dateISO, maps);
      const normalizedSchedule = normalizeSchedule(scheduleRecord);
      const weeklyExclusion = findWeeklyExclusionForDate(
        maps.weeklyExclusionsByEmployee.get(employeeId),
        entry.dateISO
      );

      const evaluation = evaluateDay({
        dateISO: entry.dateISO,
        earliest: (entry.earliest ?? null) as HHMM | null,
        latest: (entry.latest ?? null) as HHMM | null,
        allTimes: normalizedAllTimes,
        schedule: normalizedSchedule,
        weeklyExclusion: weeklyExclusion
          ? {
              mode: weeklyExclusion.mode,
              ignoreUntilMinutes: weeklyExclusion.ignoreUntilMinutes,
            }
          : null,
      });

      const perDayRow: PerDayRow = {
        ...baseRow,
        employeeId: entry.employeeId,
        employeeName: displayName,
        resolvedEmployeeId: employeeId,
        officeId,
        officeName,
        earliest: entry.earliest ?? null,
        latest: entry.latest ?? null,
        allTimes: normalizedAllTimes,
        status: evaluation.status,
        isLate: evaluation.isLate,
        isUndertime: evaluation.isUndertime,
        workedHHMM: evaluation.workedHHMM,
        workedMinutes: evaluation.workedMinutes,
        scheduleType: normalizedSchedule.type,
        scheduleSource: scheduleRecord.source,
        punches: entry.punches ?? [],
        sourceFiles: entry.sourceFiles ?? [],
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

      updatedPerDay.push(perDayRow);

      updatedEntries.push({
        employeeId: entry.employeeId,
        employeeName: displayName,
        resolvedEmployeeId: employeeId,
        officeId,
        officeName,
        employeeToken: entry.employeeToken,
        dateISO: entry.dateISO,
        day: entry.day,
        earliest: entry.earliest ?? null,
        latest: entry.latest ?? null,
        allTimes: entry.allTimes,
        punches: entry.punches ?? [],
        sourceFiles: entry.sourceFiles ?? [],
      });
    }

    const perEmployee = summarizePerEmployee(updatedPerDay);
    const summaryRow: PerEmployeeRow | null = perEmployee.length ? perEmployee[0]! : null;

    updateSessionTokenData(sessionId, normalizedToken, {
      entries: updatedEntries,
      perDay: updatedPerDay,
      perEmployee: summaryRow,
      resolvedEmployeeId: employeeId,
    });

    const perDayMap = new Map<string, PerDayRow>();
    for (const row of updatedPerDay) {
      perDayMap.set(buildPerDayKey(row), row);
    }

    return NextResponse.json({
      sessionId,
      token: normalizedToken,
      identity: {
        status: "matched" as const,
        employeeId: employee.id,
        employeeName: displayName,
        officeId,
        officeName,
      },
      perEmployee: summaryRow,
      perDay: updatedPerDay.map((row) => perDayMap.get(buildPerDayKey(row)) ?? row),
    });
  } catch (error) {
    console.error("Failed to re-enrich biometrics data", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unable to re-enrich biometrics data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

