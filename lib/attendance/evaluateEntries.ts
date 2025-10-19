import { prisma } from "@/lib/prisma";
import {
  getScheduleMapsForMonth,
  resolveScheduleForDate,
  normalizeSchedule,
} from "@/lib/schedules";
import { findWeeklyExclusionForDate } from "@/lib/weeklyExclusions";
import { firstEmployeeNoToken } from "@/lib/employeeNo";
import {
  evaluateDay,
  normalizePunchTimes,
  type DayEvaluationStatus,
  type HHMM,
} from "@/utils/evaluateDay";
import {
  summarizePerEmployee,
  sortPerDayRows,
  type DayPunch,
  type PerDayRow,
  type PerEmployeeRow,
} from "@/utils/parseBioAttendance";
import { normalizeBiometricToken } from "@/utils/biometricsShared";

const MINUTES_IN_DAY = 24 * 60;
const parseHHMM = (value: HHMM | string | null | undefined): number | null => {
  if (!value) return null;
  const [hoursStr, minutesStr] = value.split(":");
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

const computeShiftPresenceMinutes = (
  schedule: { shiftStart: HHMM; shiftEnd: HHMM; breakMinutes?: number | null },
  earliest: HHMM | null,
  latest: HHMM | null,
  times: HHMM[]
): number => {
  const shiftStart = parseHHMM(schedule.shiftStart);
  let shiftEnd = parseHHMM(schedule.shiftEnd);
  if (shiftStart == null || shiftEnd == null) return 0;

  const isOvernight = shiftEnd <= shiftStart;
  if (isOvernight) {
    shiftEnd += MINUTES_IN_DAY;
  }

  const firstCandidate = earliest ?? (times.length ? times[0] : null);
  const lastCandidate = latest ?? (times.length ? times[times.length - 1] : null);
  if (!firstCandidate || !lastCandidate) return 0;

  let start = parseHHMM(firstCandidate);
  let end = parseHHMM(lastCandidate);
  if (start == null || end == null) return 0;

  if (end < start) {
    end += MINUTES_IN_DAY;
  }
  if (isOvernight && start < shiftStart) {
    start += MINUTES_IN_DAY;
    if (end <= start) {
      end += MINUTES_IN_DAY;
    }
  }

  const clampedStart = Math.max(start, shiftStart);
  const clampedEnd = Math.min(end, shiftEnd);
  if (clampedEnd <= clampedStart) {
    return 0;
  }

  const presence = clampedEnd - clampedStart;
  const breakMinutes = schedule.breakMinutes ?? 0;
  return Math.max(0, presence - breakMinutes);
};

export type EvaluationEntry = {
  employeeId: string;
  employeeName: string;
  employeeToken: string;
  resolvedEmployeeId: string | null;
  officeId: string | null;
  officeName: string | null;
  dateISO: string;
  day: number;
  earliest: string | null;
  latest: string | null;
  allTimes: string[];
  punches: DayPunch[];
  sourceFiles: string[];
  composedFromDayOnly: boolean;
};

export type EvaluationResult = {
  perDay: PerDayRow[];
  perEmployee: PerEmployeeRow[];
};

const identityMapModel = (prisma as typeof prisma & {
  biometricsIdentityMap?: typeof prisma.biometricsIdentityMap;
}).biometricsIdentityMap;

const toEvaluationWindow = (dates: string[]) => {
  const sorted = dates.slice().sort((a, b) => a.localeCompare(b));
  const firstDate = sorted[0];
  const lastDate = sorted[sorted.length - 1];
  const from = new Date(`${firstDate}T00:00:00.000Z`);
  const to = new Date(`${lastDate}T23:59:59.999Z`);
  return { from, to };
};

const resolveInternalId = (
  row: EvaluationEntry,
  bioToInternal: Map<string, string>
): string | null => {
  if (row.resolvedEmployeeId) return row.resolvedEmployeeId;
  return bioToInternal.get(row.employeeId) ?? null;
};

const buildSchedulePresenceMap = (
  maps: Awaited<ReturnType<typeof getScheduleMapsForMonth>>,
  window: { from: Date; to: Date },
  weeklyPatternByEmployee: Map<string, boolean>
) => {
  const presence = new Map<string, boolean>();

  for (const [employeeId, schedules] of maps.schedulesByEmployee.entries()) {
    const hasSchedule = schedules.some((schedule) => {
      const effectiveFrom = schedule.effectiveFrom;
      const effectiveTo = schedule.effectiveTo;
      return effectiveFrom <= window.to && (!effectiveTo || effectiveTo >= window.from);
    });
    if (hasSchedule) {
      presence.set(employeeId, true);
    }
  }

  for (const key of maps.exceptionsByEmployeeDate.keys()) {
    const [employeeId] = key.split("::");
    if (employeeId) {
      presence.set(employeeId, true);
    }
  }

  for (const [employeeId, hasWeekly] of weeklyPatternByEmployee.entries()) {
    if (hasWeekly) {
      presence.set(employeeId, true);
    }
  }

  return presence;
};

const buildMappingByToken = (
  entries: EvaluationEntry[],
  bioToInternal: Map<string, string>,
  manualMappings: Array<{ token: string; employeeId: string }>
) => {
  const mapping = new Map<string, string>();

  for (const mappingEntry of manualMappings) {
    const normalized = normalizeBiometricToken(mappingEntry.token);
    if (normalized) {
      mapping.set(normalized, mappingEntry.employeeId);
    }
  }

  for (const entry of entries) {
    const normalized = normalizeBiometricToken(entry.employeeToken);
    if (!normalized) continue;
    if (entry.resolvedEmployeeId) {
      if (!mapping.has(normalized)) {
        mapping.set(normalized, entry.resolvedEmployeeId);
      }
      continue;
    }
    const internal = bioToInternal.get(entry.employeeId);
    if (internal && !mapping.has(normalized)) {
      mapping.set(normalized, internal);
    }
  }

  return mapping;
};

export async function evaluateAttendanceEntries(entries: EvaluationEntry[]): Promise<EvaluationResult> {
  if (!entries.length) {
    return { perDay: [], perEmployee: [] };
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

  const window = toEvaluationWindow(entries.map((row) => row.dateISO));

  const internalIds = new Set<string>();
  for (const entry of entries) {
    const internal = resolveInternalId(entry, bioToInternal);
    if (internal) {
      internalIds.add(internal);
    }
  }

  const employeeDetails = internalIds.size
    ? await prisma.employee.findMany({
        where: { id: { in: Array.from(internalIds) } },
        select: {
          id: true,
          employeeNo: true,
          isHead: true,
          officeId: true,
          offices: { select: { id: true, name: true } },
        },
      })
    : [];

  const employeeMetaById = new Map<
    string,
    { employeeNo: string | null; isHead: boolean; officeId: string | null; officeName: string | null }
  >();

  for (const detail of employeeDetails) {
    employeeMetaById.set(detail.id, {
      employeeNo: detail.employeeNo || null,
      isHead: detail.isHead,
      officeId: detail.officeId || detail.offices?.id || null,
      officeName: detail.offices?.name?.trim() || null,
    });
  }

  const maps = await getScheduleMapsForMonth(Array.from(internalIds), window);

  const tokenList = entries.map((row) => row.employeeToken.trim()).filter(Boolean);
  const manualMappings = identityMapModel
    ? await identityMapModel.findMany({
        where: { token: { in: tokenList } },
        select: { token: true, employeeId: true },
      })
    : [];

  if (!identityMapModel) {
    console.warn(
      "Biometrics identity map model is unavailable. Manual mappings will be ignored until migrations are applied."
    );
  }

  const mappingByToken = buildMappingByToken(entries, bioToInternal, manualMappings);

  const evaluatedPerDay: PerDayRow[] = [];
  const weeklyPatternByEmployee = new Map<string, boolean>();

  for (const row of entries) {
    const internalEmployeeId = resolveInternalId(row, bioToInternal);
    const scheduleRecord = resolveScheduleForDate(internalEmployeeId, row.dateISO, maps);
    const normalized = normalizeSchedule(scheduleRecord);
    const earliest = (row.earliest ?? null) as HHMM | null;
    const latest = (row.latest ?? null) as HHMM | null;
    const normalizedAllTimes = normalizePunchTimes(row.allTimes);

    const weeklyExclusion = internalEmployeeId
      ? findWeeklyExclusionForDate(maps.weeklyExclusionsByEmployee.get(internalEmployeeId), row.dateISO)
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

    if (evaluation.weeklyPatternApplied && internalEmployeeId) {
      weeklyPatternByEmployee.set(internalEmployeeId, true);
    }

    const resolvedEmployeeId = internalEmployeeId ?? row.resolvedEmployeeId ?? null;

    const details = resolvedEmployeeId ? employeeMetaById.get(resolvedEmployeeId) ?? null : null;
    const officeId = details?.officeId ?? row.officeId ?? null;
    const officeName = details?.officeName ?? row.officeName ?? null;

    const exception = internalEmployeeId
      ? maps.exceptionsByEmployeeDate.get(`${internalEmployeeId}::${row.dateISO}`) ?? null
      : null;
    const exceptionInfo = exception as { type?: string | null; code?: string | null } | null;
    let presenceMinutes = evaluation.workedMinutes ?? 0;
    if (normalized.type === "SHIFT") {
      presenceMinutes = computeShiftPresenceMinutes(normalized, earliest, latest, normalizedAllTimes);
    }
    const clampedPresence = Math.max(0, presenceMinutes);
    const scheduleSource = normalized.source ?? scheduleRecord.source ?? "DEFAULT";
    const isDefaultSchedule = scheduleSource === "DEFAULT" || scheduleSource === "NOMAPPING";
    const isFallbackFixedSchedule = isDefaultSchedule && normalized.type === "FIXED";
    const dayOfWeek = new Date(`${row.dateISO}T00:00:00Z`).getUTCDay();
    const isDefaultWorkday = dayOfWeek >= 1 && dayOfWeek <= 5;

    let requiredMinutes = evaluation.requiredMinutes ?? 0;
    let isLate = evaluation.isLate;
    let isUndertime = evaluation.isUndertime;
    let lateMinutesValue = evaluation.lateMinutes ?? null;
    let undertimeMinutesValue = evaluation.undertimeMinutes ?? null;

    if (isFallbackFixedSchedule && !isDefaultWorkday) {
      requiredMinutes = 0;
      isLate = false;
      isUndertime = false;
      lateMinutesValue = null;
      undertimeMinutesValue = null;
    }

    const isScheduled = requiredMinutes > 0;
    const isExcused =
      (exceptionInfo?.type ?? null) === "HOLIDAY" ||
      ["OB", "CTO", "LEAVE"].includes((exceptionInfo?.code ?? "").toUpperCase());
    const hasAnyPunches = row.punches.length > 0;
    const absent = isScheduled && !isExcused && !hasAnyPunches;
    const statusLabel = absent ? "Absent" : "Present";

    const perDay: PerDayRow = {
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      employeeToken: row.employeeToken,
      resolvedEmployeeId,
      officeId,
      officeName,
      employeeNo: details?.employeeNo ?? null,
      isHead: details ? details.isHead : null,
      dateISO: row.dateISO,
      day: row.day,
      earliest: row.earliest,
      latest: row.latest,
      allTimes: normalizedAllTimes,
      punches: row.punches,
      sourceFiles: row.sourceFiles,
      composedFromDayOnly: row.composedFromDayOnly ?? false,
      status: statusLabel,
      evaluationStatus: evaluation.status as DayEvaluationStatus,
      isLate,
      isUndertime,
      workedHHMM: evaluation.workedHHMM,
      workedMinutes: evaluation.workedMinutes,
      presenceMinutes: clampedPresence,
      absent,
      scheduleType: normalized.type,
      scheduleSource: scheduleRecord.source,
      lateMinutes: lateMinutesValue,
      undertimeMinutes: undertimeMinutesValue,
      requiredMinutes: requiredMinutes ?? null,
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
      identityStatus: resolvedEmployeeId ? "matched" : "unmatched",
    };

    evaluatedPerDay.push(perDay);
  }

  const chronological = sortPerDayRows(evaluatedPerDay);
  const schedulePresence = buildSchedulePresenceMap(maps, window, weeklyPatternByEmployee);

  const perEmployee = summarizePerEmployee(chronological, {
    mappingByToken,
    schedulePresenceByEmployee: schedulePresence,
  });

  return { perDay: chronological, perEmployee };
}

