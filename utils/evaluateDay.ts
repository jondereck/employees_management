import {
  expandWindows,
  minutesToHHMM,
  normalizeTimelineSegments,
  type WeekdayKey,
  type WeeklyPattern,
  type WeeklyPatternDay,
  type WeeklyPatternWindow,
} from "@/utils/weeklyPattern";
import type { HHMM } from "@/types/time";

export type { HHMM };

export type WeeklyExclusionMode = "EXCUSED" | "IGNORE_LATE_UNTIL";

export type ScheduleFixed = {
  type: "FIXED";
  startTime: HHMM;
  endTime: HHMM;
  breakMinutes?: number;
  graceMinutes?: number;
};
export type ScheduleFlex = {
  type: "FLEX";
  coreStart: HHMM;
  coreEnd: HHMM;
  bandwidthStart: HHMM;
  bandwidthEnd: HHMM;
  requiredDailyMinutes: number;
  breakMinutes?: number;
  graceMinutes?: number;
  weeklyPattern?: WeeklyPattern | null;
};
export type ScheduleShift = {
  type: "SHIFT";
  shiftStart: HHMM;
  shiftEnd: HHMM;
  breakMinutes?: number;
  graceMinutes?: number;
};

export type Schedule = ScheduleFixed | ScheduleFlex | ScheduleShift;

export type DayEvaluationStatus = "evaluated" | "no_punch" | "excused";

export type DayEvalInput = {
  dateISO: string;
  earliest?: HHMM | null;
  latest?: HHMM | null;
  allTimes?: HHMM[];
  schedule: Schedule;
  weeklyExclusion?: {
    mode: WeeklyExclusionMode;
    ignoreUntilMinutes: number | null;
  } | null;
};

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const minToHHMM = (n: number): HHMM => minutesToHHMM(n);

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const MINUTES_IN_DAY = 24 * 60;

export type MinuteInterval = { start: number; end: number };

const WEEKDAY_TABLE: WeekdayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const toWeekdayKey = (iso: string): WeekdayKey => {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const index = date.getUTCDay();
  return WEEKDAY_TABLE[index] ?? "mon";
};

const sumIntervals = (segments: MinuteInterval[]) =>
  segments.reduce((total, segment) => total + Math.max(0, segment.end - segment.start), 0);

const derivePresenceSegments = (
  times: HHMM[] | undefined,
  earliest: number | null,
  latest: number | null
): MinuteInterval[] => {
  const rawSegments: MinuteInterval[] = [];
  if (times && times.length >= 2) {
    for (let i = 0; i < times.length - 1; i += 2) {
      const start = toMin(times[i]);
      const end = toMin(times[i + 1]);
      if (end > start) {
        rawSegments.push({ start, end });
      } else if (end < start) {
        rawSegments.push({ start, end: MINUTES_IN_DAY });
        rawSegments.push({ start: 0, end });
      }
    }
  }
  if (!rawSegments.length && earliest != null && latest != null) {
    if (latest > earliest) {
      rawSegments.push({ start: earliest, end: latest });
    } else if (latest < earliest) {
      rawSegments.push({ start: earliest, end: MINUTES_IN_DAY });
      rawSegments.push({ start: 0, end: latest });
    }
  }
  return normalizeTimelineSegments(rawSegments);
};

const clampToWindows = (presence: MinuteInterval[], windows: MinuteInterval[]): MinuteInterval[] => {
  const clamped: MinuteInterval[] = [];
  const sortedWindows = [...windows].sort((a, b) => a.start - b.start || a.end - b.end);
  for (const segment of presence) {
    for (const window of sortedWindows) {
      if (window.end <= segment.start) continue;
      if (window.start >= segment.end) break;
      const start = Math.max(segment.start, window.start);
      const end = Math.min(segment.end, window.end);
      if (end > start) {
        clamped.push({ start, end });
      }
    }
  }
  return clamped;
};

const toHHMMSegments = (segments: MinuteInterval[]): { start: HHMM; end: HHMM }[] =>
  segments.map((segment) => ({ start: minToHHMM(segment.start), end: minToHHMM(segment.end) }));

const isValidTime = (value: unknown): value is HHMM =>
  typeof value === "string" && /^\d{1,2}:\d{2}$/.test(value.trim());

export const normalizePunchTimes = (
  times?: Array<HHMM | string | null | undefined>
): HHMM[] => {
  if (!Array.isArray(times)) return [];
  return times
    .map((time) => (typeof time === "string" ? time.trim() : ""))
    .filter((time): time is HHMM => isValidTime(time));
};

export function evaluateDay(input: DayEvalInput) {
  const normalizedTimes = normalizePunchTimes(input.allTimes);

  const e = input.earliest && isValidTime(input.earliest) ? toMin(input.earliest) : null;
  const l = input.latest && isValidTime(input.latest) ? toMin(input.latest) : null;
  const presenceSegments = derivePresenceSegments(normalizedTimes, e, l);

  const breakMin =
    "breakMinutes" in input.schedule && input.schedule.breakMinutes
      ? input.schedule.breakMinutes
      : 60;

  const weeklyExclusion = input.weeklyExclusion ?? null;
  let weeklyExclusionApplied: { mode: WeeklyExclusionMode; ignoreUntil: string | null } | null = null;

  if (weeklyExclusion) {
    weeklyExclusionApplied = {
      mode: weeklyExclusion.mode,
      ignoreUntil:
        weeklyExclusion.ignoreUntilMinutes != null
          ? minToHHMM(weeklyExclusion.ignoreUntilMinutes)
          : null,
    };
    if (weeklyExclusion.mode === "EXCUSED") {
      return {
        status: "excused" as DayEvaluationStatus,
        workedMinutes: 0,
        workedHHMM: minToHHMM(0),
        isLate: false,
        isUndertime: false,
        lateMinutes: 0,
        undertimeMinutes: 0,
        requiredMinutes: null,
        scheduleStart: null,
        scheduleEnd: null,
        scheduleGraceMinutes: null,
        weeklyPatternApplied: false,
        weeklyPatternWindows: null,
        weeklyPatternPresence: [],
        weeklyExclusionApplied,
      };
    }
  }

  let worked = 0;
  let isLate = false;
  let isUndertime = false;
  let lateMinutes: number | null = null;
  let undertimeMinutes: number | null = null;
  let requiredMinutes: number | null = null;
  let scheduleStart: HHMM | null = null;
  let scheduleEnd: HHMM | null = null;
  let scheduleGraceMinutes: number | null = null;
  let weeklyPatternApplied = false;
  let weeklyPatternWindows: WeeklyPatternWindow[] | null = null;
  let weeklyPatternPresence: { start: HHMM; end: HHMM }[] = [];
  let status: DayEvaluationStatus = "evaluated";

  const noPunchInput = !normalizedTimes.length && e == null && l == null;
  if (noPunchInput) {
    status = "no_punch";
  }

  switch (input.schedule.type) {
    case "FIXED": {
      const start = toMin(input.schedule.startTime);
      const end = toMin(input.schedule.endTime);
      const grace = input.schedule.graceMinutes ?? 0;
      const lateStart =
        weeklyExclusion?.mode === "IGNORE_LATE_UNTIL" && weeklyExclusion.ignoreUntilMinutes != null
          ? Math.max(start, weeklyExclusion.ignoreUntilMinutes)
          : start;
      scheduleStart = minToHHMM(lateStart);
      scheduleEnd = input.schedule.endTime;
      scheduleGraceMinutes = grace;

      const span = e != null && l != null && l >= e ? l - e : 0;
      worked = Math.max(0, span - breakMin);

      if (e != null) isLate = e > lateStart + grace;
      const required = Math.max(0, end - start - breakMin);
      requiredMinutes = required;
      isUndertime = worked < required;
      if (e != null) {
        lateMinutes = Math.max(0, e - (lateStart + grace));
      }
      undertimeMinutes = Math.max(0, required - worked);
      break;
    }

    case "FLEX": {
      const coreS = toMin(input.schedule.coreStart);
      const coreE = toMin(input.schedule.coreEnd);
      const bandS = toMin(input.schedule.bandwidthStart);
      const bandE = toMin(input.schedule.bandwidthEnd);
      const defaultRequired = input.schedule.requiredDailyMinutes;
      const grace = input.schedule.graceMinutes ?? 0;
      const coreLateStartBase =
        weeklyExclusion?.mode === "IGNORE_LATE_UNTIL" && weeklyExclusion.ignoreUntilMinutes != null
          ? Math.max(coreS, weeklyExclusion.ignoreUntilMinutes)
          : coreS;
      scheduleStart = minToHHMM(coreLateStartBase);
      scheduleEnd = input.schedule.coreEnd;
      requiredMinutes = defaultRequired;
      scheduleGraceMinutes = grace;

      const dayKey = toWeekdayKey(input.dateISO);
      const weeklyDay: WeeklyPatternDay | undefined = input.schedule.weeklyPattern
        ? input.schedule.weeklyPattern[dayKey]
        : undefined;

      const hasWeeklyPattern = Boolean(weeklyDay && weeklyDay.windows.length);

      if (hasWeeklyPattern && weeklyDay) {
        const required = Math.max(0, weeklyDay.requiredMinutes ?? 0);
        requiredMinutes = required;
        weeklyPatternApplied = true;
        weeklyPatternWindows = weeklyDay.windows;

        const windowSegments = expandWindows(weeklyDay.windows);
        const clampedSegments = clampToWindows(presenceSegments, windowSegments);
        weeklyPatternPresence = toHHMMSegments(clampedSegments);

        worked = sumIntervals(clampedSegments);
        isUndertime = worked < required;
        undertimeMinutes = Math.max(0, required - worked);

        const hasCore = coreE > coreS;
        if (hasCore) {
          const earliestWindowStart = Math.min(
            ...weeklyDay.windows.map((window) => toMin(window.start))
          );
          const coreLateStart =
            weeklyExclusion?.mode === "IGNORE_LATE_UNTIL" && weeklyExclusion.ignoreUntilMinutes != null
              ? Math.max(earliestWindowStart, weeklyExclusion.ignoreUntilMinutes)
              : earliestWindowStart;
          scheduleStart = minToHHMM(coreLateStart);

          const rawCandidates: number[] = [];
          if (normalizedTimes.length) {
            for (const time of normalizedTimes) {
              if (time) rawCandidates.push(toMin(time));
            }
          }
          if (e != null) rawCandidates.push(e);
          const firstPunchRaw = rawCandidates.length ? Math.min(...rawCandidates) : null;
          if (firstPunchRaw != null) {
            const earliestWindow = weeklyDay.windows.find(
              (window) => toMin(window.start) === earliestWindowStart
            );
            const earliestWindowEnd = earliestWindow ? toMin(earliestWindow.end) : null;
            let adjustedFirstPunch = firstPunchRaw;
            if (
              earliestWindowEnd != null &&
              earliestWindowEnd < earliestWindowStart &&
              adjustedFirstPunch <= earliestWindowEnd
            ) {
              adjustedFirstPunch += MINUTES_IN_DAY;
            }
            const threshold = coreLateStart + grace;
            isLate = adjustedFirstPunch > threshold;
            lateMinutes = isLate ? Math.max(0, adjustedFirstPunch - threshold) : 0;
          } else {
            isLate = false;
            lateMinutes = 0;
          }
        } else {
          isLate = false;
          lateMinutes = 0;
        }
        break;
      }

      // Fallback to bandwidth-based evaluation when no weekly pattern is set
      if (e == null || l == null) {
        worked = 0;
        const hasCore = coreE > coreS;
        isLate = hasCore;
        isUndertime = true;
        lateMinutes = hasCore ? coreE - coreS : 0;
        undertimeMinutes = defaultRequired;
        break;
      }

      const effectiveStart = Math.max(e, bandS);
      const effectiveEnd = Math.min(l, bandE);

      if (effectiveEnd <= effectiveStart) {
        worked = 0;
        const hasCore = coreE > coreS;
        isLate = hasCore;
        isUndertime = true;
        lateMinutes = hasCore ? coreE - coreS : 0;
        undertimeMinutes = defaultRequired;
        break;
      }

      const workedRaw = effectiveEnd - effectiveStart;
      worked = Math.max(0, workedRaw - breakMin);

      const coreStartForLate =
        weeklyExclusion?.mode === "IGNORE_LATE_UNTIL" && weeklyExclusion.ignoreUntilMinutes != null
          ? Math.max(coreS, weeklyExclusion.ignoreUntilMinutes)
          : coreS;
      scheduleStart = minToHHMM(coreStartForLate);

      const overlapStart = Math.max(effectiveStart, coreS);
      const overlapEnd = Math.min(effectiveEnd, coreE);
      const overlapStartForLate = Math.max(effectiveStart, coreStartForLate);
      const presentInCore = overlapEnd > overlapStart;
      const presentInCoreForLate = overlapEnd > overlapStartForLate;

      const hasCore = coreE > coreS;
      isLate = hasCore ? effectiveStart > coreStartForLate || !presentInCoreForLate : false;

      isUndertime = worked < defaultRequired;
      undertimeMinutes = Math.max(0, defaultRequired - worked);

      if (isLate) {
        let late = 0;
        if (effectiveStart > coreStartForLate) {
          late += effectiveStart - coreStartForLate;
        }
        if (!presentInCoreForLate) {
          late = Math.max(late, coreE - coreStartForLate);
        }
        lateMinutes = late;
      } else {
        lateMinutes = 0;
      }
      break;
    }

    case "SHIFT": {
      let shiftStart = toMin(input.schedule.shiftStart);
      let shiftEnd   = toMin(input.schedule.shiftEnd);
      const grace = input.schedule.graceMinutes ?? 0;
      const lateStart =
        weeklyExclusion?.mode === "IGNORE_LATE_UNTIL" && weeklyExclusion.ignoreUntilMinutes != null
          ? Math.max(shiftStart, weeklyExclusion.ignoreUntilMinutes)
          : shiftStart;
      scheduleStart = minToHHMM(lateStart);
      scheduleEnd = input.schedule.shiftEnd;
      scheduleGraceMinutes = grace;

      if (shiftEnd <= shiftStart) shiftEnd += 24 * 60; // overnight

      const span = e != null && l != null && l >= e ? l - e : 0;
      worked = Math.max(0, span - breakMin);

      if (e != null) isLate = e > lateStart + grace;
      const planned = Math.max(0, shiftEnd - shiftStart - breakMin);
      requiredMinutes = planned;
      isUndertime = worked < planned;
      if (e != null) {
        lateMinutes = Math.max(0, e - (lateStart + grace));
      }
      undertimeMinutes = Math.max(0, planned - worked);
      break;
    }
  }

  if (status === "no_punch") {
    isLate = false;
    isUndertime = false;
    lateMinutes = 0;
    undertimeMinutes = 0;
    worked = 0;
    requiredMinutes = null;
  }

  return {
    status,
    workedMinutes: worked,
    workedHHMM: minToHHMM(worked),
    isLate,
    isUndertime,
    lateMinutes,
    undertimeMinutes,
    requiredMinutes,
    scheduleStart,
    scheduleEnd,
    scheduleGraceMinutes,
    weeklyPatternApplied,
    weeklyPatternWindows,
    weeklyPatternPresence,
    weeklyExclusionApplied,
    presenceSegments,
  };
}
