import { prisma } from "@/lib/prisma";
import {
  getScheduleMapsForMonth,
  resolveScheduleForDate,
  normalizeSchedule,
} from "@/lib/schedules";
import { findWeeklyExclusionForDate } from "@/lib/weeklyExclusions";
import { computeOvertimeForDay, type OvertimeComputation } from "@/lib/attendance/overtime";
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
import type { EvaluationOptions, OvertimePolicy } from "@/types/attendance";
import type { ManualExclusion } from "@/types/manual-exclusion";

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

const DEFAULT_OVERTIME_POLICY: OvertimePolicy = {
  rounding: "nearest15",
  graceAfterEndMin: 0,
  countPreShift: false,
  minBlockMin: 30,
  mealDeductMin: 60,
  mealTriggerMin: 300,
  nightDiffEnabled: false,
  flexMode: "strict",
  overtimeOnExcused: true,
};

const normalizeOvertimePolicy = (policy?: OvertimePolicy | null): OvertimePolicy => {
  const rounding =
    policy?.rounding === "nearest30" || policy?.rounding === "nearest15" || policy?.rounding === "none"
      ? policy.rounding
      : DEFAULT_OVERTIME_POLICY.rounding;
  const flexMode = policy?.flexMode === "soft" ? "soft" : "strict";

  const graceValue = Number(policy?.graceAfterEndMin);
  const graceAfterEndMin = Number.isFinite(graceValue) && graceValue >= 0 ? Math.round(graceValue) : DEFAULT_OVERTIME_POLICY.graceAfterEndMin;

  const minBlockValue = Number(policy?.minBlockMin);
  const minBlockMin = Number.isFinite(minBlockValue) && minBlockValue >= 0 ? Math.round(minBlockValue) : DEFAULT_OVERTIME_POLICY.minBlockMin;

  const mealDeductRaw = policy?.mealDeductMin;
  const mealDeductValue = Number(mealDeductRaw);
  let mealDeductMin: number | undefined;
  if (mealDeductRaw === undefined) {
    mealDeductMin = DEFAULT_OVERTIME_POLICY.mealDeductMin;
  } else if (Number.isFinite(mealDeductValue) && mealDeductValue > 0) {
    mealDeductMin = Math.round(mealDeductValue);
  } else {
    mealDeductMin = undefined;
  }

  const mealTriggerRaw = policy?.mealTriggerMin;
  const mealTriggerValue = Number(mealTriggerRaw);
  let mealTriggerMin: number | undefined;
  if (mealTriggerRaw === undefined) {
    mealTriggerMin = DEFAULT_OVERTIME_POLICY.mealTriggerMin;
  } else if (Number.isFinite(mealTriggerValue) && mealTriggerValue > 0) {
    mealTriggerMin = Math.round(mealTriggerValue);
  } else {
    mealTriggerMin = undefined;
  }

  const countPreShift = Boolean(policy?.countPreShift);
  const nightDiffEnabled = Boolean(policy?.nightDiffEnabled);
  const overtimeOnExcused = policy?.overtimeOnExcused === false ? false : true;

  return {
    rounding,
    graceAfterEndMin,
    countPreShift,
    minBlockMin,
    mealDeductMin,
    mealTriggerMin,
    nightDiffEnabled,
    flexMode,
    overtimeOnExcused,
  } satisfies OvertimePolicy;
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

type ManualScopePriority = "employees" | "offices" | "all";

const MANUAL_SCOPE_PRIORITY: Record<ManualScopePriority, number> = {
  employees: 3,
  offices: 2,
  all: 1,
};

const isManualScope = (value: string | undefined | null): value is string =>
  typeof value === "string" && value.length > 0;

const normalizeManualExclusions = (exclusions: ManualExclusion[] | undefined | null) => {
  if (!Array.isArray(exclusions)) return [] as ManualExclusion[];
  const cleaned: ManualExclusion[] = [];
  for (const exclusion of exclusions) {
    if (!exclusion || typeof exclusion !== "object") continue;
    const { id, dates, scope } = exclusion;
    if (typeof id !== "string" || !id) continue;
    if (scope !== "all" && scope !== "offices" && scope !== "employees") continue;
    const validDates = Array.isArray(dates)
      ? Array.from(
          new Set(
            dates
              .filter((date): date is string => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date))
              .sort((a, b) => a.localeCompare(b))
          )
        )
      : [];
    if (!validDates.length) continue;
    const officeIds = Array.isArray(exclusion.officeIds)
      ? Array.from(
          new Set(
            exclusion.officeIds.filter((value): value is string => typeof value === "string" && value.length > 0)
          )
        )
      : undefined;
    const employeeIds = Array.isArray(exclusion.employeeIds)
      ? Array.from(
          new Set(
            exclusion.employeeIds.filter((value): value is string => typeof value === "string" && value.length > 0)
          )
        )
      : undefined;
    const reason = exclusion.reason;
    if (
      reason !== "SUSPENSION" &&
      reason !== "OFFICE_CLOSURE" &&
      reason !== "CALAMITY" &&
      reason !== "TRAINING" &&
      reason !== "LEAVE" &&
      reason !== "LOCAL_HOLIDAY" &&
      reason !== "OTHER"
    ) {
      continue;
    }
    const note = typeof exclusion.note === "string" && exclusion.note.trim().length ? exclusion.note.trim() : undefined;
    const otEligible =
      typeof (exclusion as ManualExclusion).otEligible === "boolean"
        ? (exclusion as ManualExclusion).otEligible
        : undefined;
    cleaned.push({
      id,
      dates: validDates,
      scope,
      officeIds,
      employeeIds,
      reason,
      note,
      otEligible,
    });
  }
  return cleaned;
};

const isManuallyExcused = (
  dateIso: string,
  employee: { id?: string | null; officeId?: string | null },
  exclusions: ManualExclusion[]
): ManualExclusion | undefined => {
  let match: { exclusion: ManualExclusion; priority: number } | null = null;
  const employeeId = isManualScope(employee.id) ? employee.id : null;
  const officeId = isManualScope(employee.officeId) ? employee.officeId : null;
  for (const exclusion of exclusions) {
    if (!exclusion.dates.includes(dateIso)) continue;
    if (exclusion.scope === "employees") {
      if (!employeeId) continue;
      if (!exclusion.employeeIds?.includes(employeeId)) continue;
      const priority = MANUAL_SCOPE_PRIORITY.employees;
      if (!match || priority > match.priority) {
        match = { exclusion, priority };
      }
      continue;
    }
    if (exclusion.scope === "offices") {
      if (!officeId) continue;
      if (!exclusion.officeIds?.includes(officeId)) continue;
      const priority = MANUAL_SCOPE_PRIORITY.offices;
      if (!match || priority > match.priority) {
        match = { exclusion, priority };
      }
      continue;
    }
    if (exclusion.scope === "all") {
      const priority = MANUAL_SCOPE_PRIORITY.all;
      if (!match || priority > match.priority) {
        match = { exclusion, priority };
      }
    }
  }
  return match?.exclusion;
};

const toTitleCase = (value: string) =>
  value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatManualLabel = (manual: ManualExclusion): string => {
  if (manual.reason === "LOCAL_HOLIDAY") {
    const detail = manual.note && manual.note.length ? ` (${manual.note})` : "";
    return `Local Holiday${detail}`;
  }
  if (manual.reason === "LEAVE") {
    return manual.note && manual.note.length ? `Leave - ${manual.note}` : "Leave";
  }
  const base = toTitleCase(manual.reason);
  if (manual.note && manual.note.length) {
    return `${base} - ${manual.note}`;
  }
  return base;
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

export async function evaluateAttendanceEntries(
  entries: EvaluationEntry[],
  options?: { manualExclusions?: ManualExclusion[]; evaluationOptions?: EvaluationOptions }
): Promise<EvaluationResult> {
  if (!entries.length) {
    return { perDay: [], perEmployee: [] };
  }

  const manualExclusions = normalizeManualExclusions(options?.manualExclusions);
  const overtimePolicy = normalizeOvertimePolicy(options?.evaluationOptions?.overtime);

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
    let lateMinutesValue: number | null = evaluation.lateMinutes ?? null;
    let undertimeMinutesValue: number | null = evaluation.undertimeMinutes ?? null;

    if (isFallbackFixedSchedule && !isDefaultWorkday) {
      requiredMinutes = 0;
      isLate = false;
      isUndertime = false;
      lateMinutesValue = null;
      undertimeMinutesValue = null;
    }

    const manualExclusion = isManuallyExcused(
      row.dateISO,
      { id: resolvedEmployeeId, officeId },
      manualExclusions
    );
    const nationalHoliday = (exceptionInfo?.type ?? null) === "HOLIDAY";
    const manualExcused = Boolean(manualExclusion);
    const isHoliday = nationalHoliday;
    const excused = manualExcused || isHoliday;

    if (excused) {
      isLate = false;
      isUndertime = false;
      lateMinutesValue = 0;
      undertimeMinutesValue = 0;
    }

    const isScheduled = requiredMinutes > 0;
    const hasAnyPunches = row.punches.length > 0;
    const absent = excused ? false : isScheduled && !hasAnyPunches;

    let statusLabel: string;
    if (excused) {
      if (isHoliday) {
        statusLabel = "Holiday";
      } else if (manualExclusion) {
        const label = formatManualLabel(manualExclusion);
        statusLabel = `Excused - ${label}`;
      } else {
        statusLabel = "Holiday";
      }
    } else {
      statusLabel = absent ? "Absent" : "Present";
    }

    const evaluationStatus: DayEvaluationStatus = excused ? "excused" : (evaluation.status as DayEvaluationStatus);

    const presenceSegments = evaluation.presenceSegments ?? [];
    const holidayKind = isHoliday ? "holiday" : requiredMinutes > 0 ? "none" : "restday";
    const manualOtEligible = (manualExclusion?.otEligible ?? overtimePolicy.overtimeOnExcused) === true;
    const mergedPresenceMinutes = presenceSegments.reduce(
      (total, segment) => total + Math.max(0, segment.end - segment.start),
      0
    );
    const hasPresence = mergedPresenceMinutes > 0;
    const emptyOvertime: OvertimeComputation = {
      OT_pre: 0,
      OT_post: 0,
      OT_restday: 0,
      OT_holiday: 0,
      OT_excused: 0,
      OT_total: 0,
      ND_minutes: 0,
    };
    let overtime: OvertimeComputation = emptyOvertime;
    const dayNotes: string[] = [];

    if (manualExcused) {
      if (isHoliday) {
        overtime = computeOvertimeForDay({
          schedule: normalized,
          presence: presenceSegments,
          policy: overtimePolicy,
          holiday: "holiday",
        });
      } else if (holidayKind === "restday") {
        overtime = computeOvertimeForDay({
          schedule: normalized,
          presence: presenceSegments,
          policy: overtimePolicy,
          holiday: "restday",
        });
      } else if (manualOtEligible && hasPresence) {
        const manualOvertime = computeOvertimeForDay({
          schedule: { type: "NONE" },
          presence: presenceSegments,
          policy: overtimePolicy,
          holiday: "none",
        });
        overtime = {
          ...manualOvertime,
          OT_pre: 0,
          OT_post: 0,
          OT_restday: 0,
          OT_holiday: 0,
          OT_excused: manualOvertime.OT_total,
        };
        if (manualOvertime.OT_total > 0) {
          dayNotes.push("Excused day with punches → OT credited (Excused)");
        }
      }
    } else {
      overtime = computeOvertimeForDay({
        schedule: normalized,
        presence: presenceSegments,
        policy: overtimePolicy,
        holiday: holidayKind,
      });
    }

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
      evaluationStatus,
      isLate,
      isUndertime,
      workedHHMM: evaluation.workedHHMM,
      workedMinutes: evaluation.workedMinutes,
      presenceMinutes: clampedPresence,
      OT_pre: overtime.OT_pre,
      OT_post: overtime.OT_post,
      OT_restday: overtime.OT_restday,
      OT_holiday: overtime.OT_holiday,
      OT_excused: overtime.OT_excused,
      OT_total: overtime.OT_total,
      ND_minutes: overtime.ND_minutes,
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
      notes: dayNotes.length ? dayNotes : undefined,
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

