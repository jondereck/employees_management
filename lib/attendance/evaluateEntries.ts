import { prisma } from "@/lib/prisma";
import {
  getScheduleMapsForMonth,
  resolveScheduleForDate,
  normalizeSchedule,
} from "@/lib/schedules";
import { findWeeklyExclusionForDate } from "@/lib/weeklyExclusions";
import {
  computeOvertimeForDay,
  type OvertimeComputation,
  type OvertimeTrace,
} from "@/lib/attendance/overtime";
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
import type { EvaluationOptions, OvertimePolicy, WorkSchedule } from "@/types/attendance";
import type { ManualExclusion } from "@/types/manual-exclusion";

const MINUTES_IN_DAY = 24 * 60;
const formatMinutesLabel = (value: number) => {
  const safe = Math.max(0, Math.round(value));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
};

const nextDateISO = (dateISO: string) => {
  const date = new Date(`${dateISO}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

const isNextCalendarDate = (previousDateISO: string, currentDateISO: string) =>
  nextDateISO(previousDateISO) === currentDateISO;

const appendNotes = (existing: string[] | undefined, additions: Array<string | null | undefined>) => {
  const merged = [...(existing ?? [])];
  for (const entry of additions) {
    const value = entry?.trim();
    if (!value || merged.includes(value)) continue;
    merged.push(value);
  }
  return merged.length ? merged : undefined;
};

const buildOvertimeTraceNote = (trace: OvertimeTrace | null | undefined) => {
  if (!trace) return null;
  const scheduleLabel =
    trace.scheduleStart && trace.scheduleEnd
      ? `${trace.scheduleStart}-${trace.scheduleEnd}`
      : trace.scheduleType;
  const postStart = trace.postShiftStart ? `, OT starts ${trace.postShiftStart}` : "";
  const rawTotal = trace.rawPreMinutes + trace.rawPostMinutes + trace.rawGeneralMinutes;
  const roundedTotal =
    trace.roundedPreMinutes + trace.roundedPostMinutes + trace.roundedGeneralMinutes;
  const mealLabel = trace.mealApplied
    ? `, meal -${formatMinutesLabel(trace.mealDeductedMinutes)}`
    : "";
  return `OT trace: schedule ${scheduleLabel}${postStart}, raw ${formatMinutesLabel(rawTotal)}, rounded ${formatMinutesLabel(roundedTotal)}${mealLabel}, ND ${formatMinutesLabel(trace.nightDiffMinutes)}.`;
};

const spilloverRowKey = (row: {
  employeeId: string;
  employeeToken: string;
  employeeName: string;
  dateISO: string;
}) => `${row.employeeToken || row.employeeId || row.employeeName}||${row.employeeName}||${row.dateISO}`;
const parseHHMM = (value: HHMM | string | null | undefined): number | null => {
  if (!value) return null;
  const [hoursStr, minutesStr] = value.split(":");
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

const normalizeSortedTimes = (times: Array<HHMM | string | null | undefined>): HHMM[] =>
  normalizePunchTimes(times).sort((left, right) => {
    const leftMinutes = parseHHMM(left) ?? 0;
    const rightMinutes = parseHHMM(right) ?? 0;
    return leftMinutes - rightMinutes || left.localeCompare(right);
  });

const sortPunches = (punches: DayPunch[]): DayPunch[] =>
  [...punches].sort((left, right) => left.minuteOfDay - right.minuteOfDay || left.time.localeCompare(right.time));

const HHMM_PATTERN = /^(?:[01]?\d|2[0-3]):[0-5]\d$/;

const normalizeWorkSchedule = (schedule: WorkSchedule | undefined): WorkSchedule | null => {
  if (!schedule) return null;
  const startTime = schedule.startTime.trim();
  const endTime = schedule.endTime.trim();
  if (!HHMM_PATTERN.test(startTime) || !HHMM_PATTERN.test(endTime)) {
    return null;
  }
  const validWorkingDays = Array.from(new Set(schedule.workingDays ?? [1, 2, 3, 4, 5]))
    .filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((a, b) => a - b);
  return {
    startTime: startTime as HHMM,
    endTime: endTime as HHMM,
    workingDays: validWorkingDays.length ? validWorkingDays : [1, 2, 3, 4, 5],
  };
};

const resolveCarryoverSchedule = (
  scheduleRecord: ReturnType<typeof resolveScheduleForDate>,
  defaultWorkSchedule: WorkSchedule | null
) => {
  const normalizedBase = normalizeSchedule(scheduleRecord);
  const scheduleSource = normalizedBase.source ?? scheduleRecord.source ?? "DEFAULT";
  const isDefaultSchedule = scheduleSource === "DEFAULT" || scheduleSource === "NOMAPPING";
  return isDefaultSchedule && normalizedBase.type === "FIXED" && defaultWorkSchedule
    ? {
        ...normalizedBase,
        startTime: defaultWorkSchedule.startTime,
        endTime: defaultWorkSchedule.endTime,
        workingDays: defaultWorkSchedule.workingDays,
      }
    : normalizedBase;
};

const getScheduleEndMinutes = (
  schedule: ReturnType<typeof resolveCarryoverSchedule>
): number | null => {
  if (schedule.type === "FIXED") {
    const start = parseHHMM(schedule.startTime);
    const end = parseHHMM(schedule.endTime);
    if (start == null || end == null || end <= start) return null;
    return end;
  }
  if (schedule.type === "SHIFT") {
    const start = parseHHMM(schedule.shiftStart);
    const end = parseHHMM(schedule.shiftEnd);
    if (start == null || end == null || end <= start) return null;
    return end;
  }
  if (schedule.type === "FLEX") {
    const start = parseHHMM(schedule.bandwidthStart);
    const end = parseHHMM(schedule.bandwidthEnd);
    if (start == null || end == null || end <= start) return null;
    return end;
  }
  return null;
};

const rebuildEvaluationEntry = (
  row: CarryoverEvaluationEntry,
  allTimes: HHMM[],
  punches: DayPunch[]
): CarryoverEvaluationEntry => ({
  ...row,
  earliest: allTimes[0] ?? null,
  latest: allTimes.length ? allTimes[allTimes.length - 1] : null,
  allTimes,
  punches,
});

type CarryoverRowContext = {
  row: CarryoverEvaluationEntry;
  resolvedEmployeeId: string | null;
  officeId: string | null;
};

const makeCarryoverOverrideKey = (employeeToken: string, sourceDateISO: string) =>
  `${normalizeBiometricToken(employeeToken)}::${sourceDateISO}`;

export const stitchOvernightCarryoverEntries = (
  rows: CarryoverRowContext[],
  options: {
    cutoffMinutes: number;
    getScheduleEndMinutes: (context: CarryoverRowContext) => number | null;
    manualOverrideKeys?: Set<string>;
  }
): CarryoverEvaluationEntry[] => {
  if (rows.length < 2 || (options.cutoffMinutes <= 0 && !(options.manualOverrideKeys?.size))) {
    return rows.map((entry) => entry.row);
  }

  const cloned: CarryoverRowContext[] = rows.map((entry) => ({
    row: {
      ...entry.row,
      allTimes: [...entry.row.allTimes],
      punches: [...entry.row.punches],
      sourceFiles: [...entry.row.sourceFiles],
      preEvaluationNotes: entry.row.preEvaluationNotes ? [...entry.row.preEvaluationNotes] : undefined,
    },
    resolvedEmployeeId: entry.resolvedEmployeeId,
    officeId: entry.officeId,
  }));

  for (let index = 1; index < cloned.length; index += 1) {
    const previous = cloned[index - 1];
    const current = cloned[index];

    if (
      previous.row.employeeId !== current.row.employeeId ||
      previous.row.employeeToken !== current.row.employeeToken ||
      !isNextCalendarDate(previous.row.dateISO, current.row.dateISO)
    ) {
      continue;
    }

    const previousTimes = normalizeSortedTimes(previous.row.allTimes);
    const currentTimes = normalizeSortedTimes(current.row.allTimes);
    if (!previousTimes.length || !currentTimes.length || previousTimes.length % 2 === 0) {
      continue;
    }

    const isForcedCarryover = (options.manualOverrideKeys ?? new Set<string>()).has(
      makeCarryoverOverrideKey(current.row.employeeToken, current.row.dateISO)
    );

    const scheduledEndMinutes = options.getScheduleEndMinutes(previous);
    const previousLastPunchMinutes = parseHHMM(previousTimes[previousTimes.length - 1]);
    if (
      !isForcedCarryover &&
      (scheduledEndMinutes == null ||
        previousLastPunchMinutes == null ||
        previousLastPunchMinutes < scheduledEndMinutes)
    ) {
      continue;
    }

    const leadingEligibleCount = currentTimes.findIndex((time) => {
      const minutes = parseHHMM(time);
      return !isForcedCarryover && (minutes == null || minutes >= options.cutoffMinutes);
    });
    const maxLeadingCount = isForcedCarryover
      ? Math.min(1, currentTimes.length)
      : leadingEligibleCount === -1
      ? currentTimes.length
      : leadingEligibleCount;
    if (maxLeadingCount <= 0) {
      continue;
    }

    let transferCount = 0;
    for (let candidate = 1; candidate <= maxLeadingCount; candidate += 1) {
      const previousWouldBeEven = (previousTimes.length + candidate) % 2 === 0;
      const currentWouldBeEven = (currentTimes.length - candidate) % 2 === 0;
      if (previousWouldBeEven && currentWouldBeEven) {
        transferCount = candidate;
        break;
      }
    }
    if (transferCount <= 0) {
      if (isForcedCarryover) {
        transferCount = 1;
      } else {
        transferCount = 1;
      }
    }
    if (transferCount <= 0) {
      continue;
    }

    const previousPunches = sortPunches(previous.row.punches);
    const currentPunches = sortPunches(current.row.punches);
    if (previousPunches.length && currentPunches.length < transferCount) {
      continue;
    }

    const movedTimes = currentTimes.slice(0, transferCount);
    const nextPreviousTimes = [...previousTimes, ...movedTimes];
    const nextCurrentTimes = currentTimes.slice(transferCount);
    const movedPunches = currentPunches.length ? currentPunches.slice(0, transferCount) : [];
    const nextPreviousPunches = previousPunches.length ? [...previousPunches, ...movedPunches] : previous.row.punches;
    const nextCurrentPunches = currentPunches.length ? currentPunches.slice(transferCount) : current.row.punches;

    previous.row = rebuildEvaluationEntry(
      previous.row,
      nextPreviousTimes,
      nextPreviousPunches
    );
    current.row = rebuildEvaluationEntry(current.row, nextCurrentTimes, nextCurrentPunches);

    previous.row.preEvaluationNotes = appendNotes(previous.row.preEvaluationNotes, [
      isForcedCarryover
        ? `Manually carried ${transferCount} overnight punch${transferCount === 1 ? "" : "es"} from ${current.row.dateISO}.`
        : `Included ${transferCount} overnight carryover punch${transferCount === 1 ? "" : "es"} from ${current.row.dateISO}.`,
    ]);
    current.row.preEvaluationNotes = appendNotes(current.row.preEvaluationNotes, [
      isForcedCarryover
        ? `Manually reassigned ${transferCount} overnight punch${transferCount === 1 ? "" : "es"} to ${previous.row.dateISO}.`
        : `Reassigned ${transferCount} overnight carryover punch${transferCount === 1 ? "" : "es"} to ${previous.row.dateISO}.`,
      nextCurrentTimes.length % 2 === 1
        ? "Carryover left this day with an incomplete punch sequence."
        : null,
    ]);
  }

  return cloned.map((entry) => entry.row);
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
  rounding: "none",
  graceAfterEndMin: 60,
  overnightCarryoverCutoffMin: 360,
  countPreShift: false,
  minBlockMin: 120,
  mealDeductMin: 60,
  mealTriggerMin: 240,
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

  const carryoverCutoffValue = Number(policy?.overnightCarryoverCutoffMin);
  const overnightCarryoverCutoffMin =
    Number.isFinite(carryoverCutoffValue) && carryoverCutoffValue >= 0
      ? Math.round(carryoverCutoffValue)
      : DEFAULT_OVERTIME_POLICY.overnightCarryoverCutoffMin;

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
    overnightCarryoverCutoffMin,
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

export type ManualCarryoverOverride = {
  employeeToken: string;
  sourceDateISO: string;
};

type ManualScopePriority = "employees" | "offices" | "all";
type CarryoverEvaluationEntry = EvaluationEntry & { preEvaluationNotes?: string[] };

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
    return `Local Holiday`;
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

const normalizeManualCarryovers = (
  overrides: ManualCarryoverOverride[] | undefined | null
): ManualCarryoverOverride[] => {
  if (!Array.isArray(overrides)) return [];
  const seen = new Set<string>();
  const cleaned: ManualCarryoverOverride[] = [];
  for (const override of overrides) {
    const employeeToken = normalizeBiometricToken(override?.employeeToken ?? "");
    const sourceDateISO = typeof override?.sourceDateISO === "string" ? override.sourceDateISO.trim() : "";
    if (!employeeToken || !/^\d{4}-\d{2}-\d{2}$/.test(sourceDateISO)) continue;
    const key = makeCarryoverOverrideKey(employeeToken, sourceDateISO);
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push({ employeeToken, sourceDateISO });
  }
  return cleaned;
};

export async function evaluateAttendanceEntries(
  entries: EvaluationEntry[],
  options?: {
    manualExclusions?: ManualExclusion[];
    evaluationOptions?: EvaluationOptions;
    manualCarryovers?: ManualCarryoverOverride[];
  }
): Promise<EvaluationResult> {
  if (!entries.length) {
    return { perDay: [], perEmployee: [] };
  }

  const manualExclusions = normalizeManualExclusions(options?.manualExclusions);
  const manualCarryovers = normalizeManualCarryovers(options?.manualCarryovers);
  const overtimePolicy = normalizeOvertimePolicy(options?.evaluationOptions?.overtime);
  const defaultWorkSchedule = normalizeWorkSchedule(options?.evaluationOptions?.workSchedule);

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
          employeeType: { select: { name: true } },
        },
      })
    : [];

  const employeeMetaById = new Map<
    string,
    {
      employeeNo: string | null;
      isHead: boolean;
      officeId: string | null;
      officeName: string | null;
      employeeType: string | null;
    }
  >();

  for (const detail of employeeDetails) {
    employeeMetaById.set(detail.id, {
      employeeNo: detail.employeeNo || null,
      isHead: detail.isHead,
      officeId: detail.officeId || detail.offices?.id || null,
      officeName: detail.offices?.name?.trim() || null,
      employeeType: detail.employeeType?.name?.trim() || null,
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

  const carryoverReadyEntries = entries
    .map((row) => {
      const internalEmployeeId = resolveInternalId(row, bioToInternal);
      const resolvedEmployeeId = internalEmployeeId ?? row.resolvedEmployeeId ?? null;
      const details = resolvedEmployeeId ? employeeMetaById.get(resolvedEmployeeId) ?? null : null;
      return {
        row: { ...row },
        resolvedEmployeeId,
        officeId: details?.officeId ?? row.officeId ?? null,
      };
    })
    .sort((left, right) => {
      const employeeCompare =
        left.row.employeeToken.localeCompare(right.row.employeeToken) ||
        left.row.employeeId.localeCompare(right.row.employeeId) ||
        left.row.employeeName.localeCompare(right.row.employeeName);
      if (employeeCompare !== 0) return employeeCompare;
      return left.row.dateISO.localeCompare(right.row.dateISO);
    });

  const stitchedEntries = stitchOvernightCarryoverEntries(carryoverReadyEntries, {
    cutoffMinutes: overtimePolicy.overnightCarryoverCutoffMin,
    manualOverrideKeys: new Set(
      manualCarryovers.map((override) =>
        makeCarryoverOverrideKey(override.employeeToken, override.sourceDateISO)
      )
    ),
    getScheduleEndMinutes: (entry) => {
      if (!entry.resolvedEmployeeId && !entry.officeId) return null;
      const scheduleRecord = resolveScheduleForDate(
        entry.resolvedEmployeeId,
        entry.officeId,
        entry.row.dateISO,
        maps
      );
      const schedule = resolveCarryoverSchedule(scheduleRecord, defaultWorkSchedule);
      return getScheduleEndMinutes(schedule);
    },
  });

  const evaluatedPerDay: PerDayRow[] = [];
  const overnightSpillovers: Array<{
    sourceDateISO: string;
    targetDateISO: string;
    row: Pick<
      PerDayRow,
      | "employeeId"
      | "employeeName"
      | "employeeToken"
      | "resolvedEmployeeId"
      | "officeId"
      | "officeName"
      | "employeeNo"
      | "isHead"
      | "sourceFiles"
      | "identityStatus"
      | "employeeType"
      | "scheduleType"
      | "scheduleSource"
    >;
    overtime: OvertimeComputation;
  }> = [];
  const weeklyPatternByEmployee = new Map<string, boolean>();

  for (const row of stitchedEntries) {
    const internalEmployeeId = resolveInternalId(row, bioToInternal);
    const resolvedEmployeeId = internalEmployeeId ?? row.resolvedEmployeeId ?? null;
    const details = resolvedEmployeeId ? employeeMetaById.get(resolvedEmployeeId) ?? null : null;
    const officeId = details?.officeId ?? row.officeId ?? null;
    const officeName = details?.officeName ?? row.officeName ?? null;
    const employeeType = details?.employeeType ?? null;
    const scheduleRecord = resolveScheduleForDate(internalEmployeeId, officeId, row.dateISO, maps);
    const normalized = resolveCarryoverSchedule(scheduleRecord, defaultWorkSchedule);
    const scheduleSource = normalized.source ?? scheduleRecord.source ?? "DEFAULT";
    const isDefaultSchedule = scheduleSource === "DEFAULT" || scheduleSource === "NOMAPPING";
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

    const exception = internalEmployeeId
      ? maps.exceptionsByEmployeeDate.get(`${internalEmployeeId}::${row.dateISO}`) ?? null
      : null;
    const exceptionInfo = exception as { type?: string | null; code?: string | null } | null;
    let presenceMinutes = evaluation.workedMinutes ?? 0;
    if (normalized.type === "SHIFT") {
      presenceMinutes = computeShiftPresenceMinutes(normalized, earliest, latest, normalizedAllTimes);
    }
    const clampedPresence = Math.max(0, presenceMinutes);
    const isFallbackFixedSchedule = isDefaultSchedule && normalized.type === "FIXED";
    const dayOfWeek = new Date(`${row.dateISO}T00:00:00Z`).getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const defaultWorkingDays = [1, 2, 3, 4, 5];
    const configuredWorkingDays =
      normalized.type === "FIXED"
        ? Array.from(new Set(("workingDays" in normalized ? normalized.workingDays : defaultWorkingDays) ?? defaultWorkingDays))
            .filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6)
        : defaultWorkingDays;
    const isWorkingDay = configuredWorkingDays.includes(dayOfWeek);

    let requiredMinutes = evaluation.requiredMinutes ?? 0;
    let isLate = evaluation.isLate;
    let isUndertime = evaluation.isUndertime;
    let lateMinutesValue: number | null = evaluation.lateMinutes ?? null;
    let undertimeMinutesValue: number | null = evaluation.undertimeMinutes ?? null;

    if (isFallbackFixedSchedule && !isWorkingDay) {
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
    const hasCompletePunchPair = row.punches.length >= 2;
    const hasIncompletePunch = hasAnyPunches && !hasCompletePunchPair;
    const isRequiredWorkingDay = isScheduled || (normalized.type === "FIXED" && isWorkingDay);
    const absent = excused ? false : isRequiredWorkingDay && !hasAnyPunches;

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
    } else if (isWeekend) {
      statusLabel = "Weekend";
    } else if (normalized.type === "FIXED" && !isWorkingDay) {
      statusLabel = "Off";
    } else if (absent) {
      statusLabel = "Absent";
    } else if (hasIncompletePunch) {
      statusLabel = "Incomplete";
    } else if (hasCompletePunchPair) {
      statusLabel = "Present";
    } else {
      statusLabel = "Present";
    }

    const evaluationStatus: DayEvaluationStatus = excused ? "excused" : (evaluation.status as DayEvaluationStatus);

    const presenceSegments = evaluation.presenceSegments ?? [];
    // Determine OT bucket from actual day classification, not raw required minutes.
    // Fixed schedules can still produce requiredMinutes on weekends, but those days
    // should be treated as rest day OT when work is rendered.
    const holidayKind = isHoliday ? "holiday" : isRequiredWorkingDay ? "none" : "restday";
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
    const dayNotes = [...(row.preEvaluationNotes ?? [])];

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
          spillover: manualOvertime.spillover
            ? {
                ...manualOvertime.spillover,
                OT_pre: 0,
                OT_post: 0,
                OT_restday: 0,
                OT_holiday: 0,
                OT_excused: manualOvertime.spillover.OT_total,
              }
            : null,
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

    const overtimeTraceNote = buildOvertimeTraceNote(overtime.trace);
    if ((overtime.OT_total > 0 || overtime.ND_minutes > 0) && overtimeTraceNote) {
      dayNotes.push(overtimeTraceNote);
    }
    if (overtime.spillover && (overtime.spillover.OT_total > 0 || overtime.spillover.ND_minutes > 0)) {
      const targetDateISO = nextDateISO(row.dateISO);
      dayNotes.push(`Overnight OT spillover credited to ${targetDateISO}.`);
      overnightSpillovers.push({
        sourceDateISO: row.dateISO,
        targetDateISO,
        row: {
          employeeId: row.employeeId,
          employeeName: row.employeeName,
          employeeToken: row.employeeToken,
          resolvedEmployeeId,
          officeId,
          officeName,
          employeeNo: details?.employeeNo ?? null,
          isHead: details ? details.isHead : null,
          sourceFiles: row.sourceFiles,
          identityStatus: resolvedEmployeeId ? "matched" : "unmatched",
          employeeType,
          scheduleType: normalized.type,
          scheduleSource: scheduleRecord.source,
        },
        overtime: overtime.spillover,
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
      employeeType,
      notes: dayNotes.length ? dayNotes : undefined,
      overtimeTrace: overtime.trace ?? null,
    };

    evaluatedPerDay.push(perDay);
  }

  const perDayIndexByKey = new Map<string, number>();
  for (let index = 0; index < evaluatedPerDay.length; index += 1) {
    perDayIndexByKey.set(spilloverRowKey(evaluatedPerDay[index]), index);
  }

  for (const spillover of overnightSpillovers) {
    const key = spilloverRowKey({
      employeeId: spillover.row.employeeId,
      employeeToken: spillover.row.employeeToken,
      employeeName: spillover.row.employeeName,
      dateISO: spillover.targetDateISO,
    });
    const targetIndex = perDayIndexByKey.get(key);
    const spilloverTraceNote = buildOvertimeTraceNote(spillover.overtime.trace);
    const spilloverNotes = [
      `Overnight OT spillover from ${spillover.sourceDateISO}.`,
      spilloverTraceNote,
    ];

    if (targetIndex != null) {
      const target = evaluatedPerDay[targetIndex];
      target.OT_pre = Number(target.OT_pre ?? 0) + Number(spillover.overtime.OT_pre ?? 0);
      target.OT_post = Number(target.OT_post ?? 0) + Number(spillover.overtime.OT_post ?? 0);
      target.OT_restday = Number(target.OT_restday ?? 0) + Number(spillover.overtime.OT_restday ?? 0);
      target.OT_holiday = Number(target.OT_holiday ?? 0) + Number(spillover.overtime.OT_holiday ?? 0);
      target.OT_excused = Number(target.OT_excused ?? 0) + Number(spillover.overtime.OT_excused ?? 0);
      target.OT_total = Number(target.OT_total ?? 0) + Number(spillover.overtime.OT_total ?? 0);
      target.ND_minutes = Number(target.ND_minutes ?? 0) + Number(spillover.overtime.ND_minutes ?? 0);
      target.notes = appendNotes(target.notes, spilloverNotes);
      continue;
    }

    const syntheticRow: PerDayRow = {
      employeeId: spillover.row.employeeId,
      employeeName: spillover.row.employeeName,
      employeeToken: spillover.row.employeeToken,
      resolvedEmployeeId: spillover.row.resolvedEmployeeId ?? null,
      officeId: spillover.row.officeId ?? null,
      officeName: spillover.row.officeName ?? null,
      employeeNo: spillover.row.employeeNo ?? null,
      isHead: spillover.row.isHead ?? null,
      dateISO: spillover.targetDateISO,
      day: Number(spillover.targetDateISO.slice(-2)),
      earliest: spillover.overtime.trace?.firstSegmentStart ?? null,
      latest: spillover.overtime.trace?.lastSegmentEnd ?? null,
      allTimes: [],
      punches: [],
      sourceFiles: spillover.row.sourceFiles,
      composedFromDayOnly: false,
      status: "OT spillover",
      evaluationStatus: "no_punch",
      isLate: false,
      isUndertime: false,
      workedHHMM: null,
      workedMinutes: 0,
      presenceMinutes: 0,
      OT_pre: spillover.overtime.OT_pre,
      OT_post: spillover.overtime.OT_post,
      OT_restday: spillover.overtime.OT_restday,
      OT_holiday: spillover.overtime.OT_holiday,
      OT_excused: spillover.overtime.OT_excused,
      OT_total: spillover.overtime.OT_total,
      ND_minutes: spillover.overtime.ND_minutes,
      absent: false,
      scheduleType: spillover.row.scheduleType,
      scheduleSource: spillover.row.scheduleSource,
      lateMinutes: null,
      undertimeMinutes: null,
      requiredMinutes: null,
      scheduleStart: null,
      scheduleEnd: null,
      scheduleGraceMinutes: null,
      weeklyPatternApplied: false,
      weeklyPatternWindows: null,
      weeklyPatternPresence: [],
      weeklyExclusionApplied: null,
      weeklyExclusionMode: null,
      weeklyExclusionIgnoreUntil: null,
      weeklyExclusionId: null,
      identityStatus: spillover.row.identityStatus,
      employeeType: spillover.row.employeeType ?? null,
      notes: appendNotes(undefined, spilloverNotes),
      overtimeTrace: spillover.overtime.trace ?? null,
      excludeFromSummaryCounts: true,
      spilloverFromDateISO: spillover.sourceDateISO,
    };
    perDayIndexByKey.set(key, evaluatedPerDay.length);
    evaluatedPerDay.push(syntheticRow);
  }

  const chronological = sortPerDayRows(evaluatedPerDay);
  const schedulePresence = buildSchedulePresenceMap(maps, window, weeklyPatternByEmployee);

  const perEmployee = summarizePerEmployee(chronological, {
    mappingByToken,
    schedulePresenceByEmployee: schedulePresence,
  });

  return { perDay: chronological, perEmployee };
}
