import type { HHMM } from "@/types/time";
import {
  isHHMM,
  type WeeklyPattern,
  type WeeklyPatternDay,
  type WeeklyPatternDayKey,
  type WeeklyPatternWindow,
} from "@/utils/weeklyPattern";

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

export type DayEvalInput = {
  dateISO: string;
  earliest?: HHMM | null;
  latest?: HHMM | null;
  allTimes?: HHMM[];
  schedule: Schedule;
};

type WeeklyPatternEvaluation = {
  dayKey: WeeklyPatternDayKey;
  definition: WeeklyPatternDay;
  windowSegments: Array<{ start: number; end: number }>;
  workedSegments: Array<{ start: number; end: number }>;
};

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const minToHHMM = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const MINUTES_IN_DAY = 24 * 60;

const DAY_KEYS: WeeklyPatternDayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const toDayKey = (dateISO: string): WeeklyPatternDayKey => {
  const date = new Date(`${dateISO}T00:00:00Z`);
  return DAY_KEYS[date.getUTCDay()];
};

const expandWindowSegments = (window: WeeklyPatternWindow): Array<{ start: number; end: number }> => {
  const start = toMin(window.start);
  const end = toMin(window.end);
  if (end === start) {
    return [];
  }
  if (end > start) {
    return [{ start, end }];
  }
  return [
    { start, end: MINUTES_IN_DAY },
    { start: 0, end },
  ];
};

const pairPunches = (allTimes: HHMM[] | undefined, earliest: number | null, latest: number | null) => {
  const segments: Array<{ start: number; end: number }> = [];
  if (allTimes && allTimes.length >= 2) {
    const minutes = allTimes.map(toMin);
    for (let index = 0; index < minutes.length; index += 2) {
      const start = minutes[index];
      const end = minutes[index + 1];
      if (end == null) {
        if (latest != null && latest > start) {
          segments.push({ start, end: latest });
        }
        break;
      }
      if (end <= start) {
        segments.push({ start, end: MINUTES_IN_DAY });
        segments.push({ start: 0, end });
      } else {
        segments.push({ start, end });
      }
    }
  }
  if (!segments.length && earliest != null && latest != null) {
    const adjustedLatest = latest <= earliest ? latest + MINUTES_IN_DAY : latest;
    if (adjustedLatest > earliest) {
      segments.push({ start: earliest, end: adjustedLatest });
    }
  }
  return segments;
};

const normalizeWorkedSegment = (segment: { start: number; end: number }) => {
  const start = ((segment.start % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const endRaw = ((segment.end % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const end = segment.end - segment.start >= MINUTES_IN_DAY ? start : endRaw;
  return { start, end };
};

function evaluateWeeklyPattern(
  pattern: WeeklyPattern | null | undefined,
  dateISO: string,
  earliestMin: number | null,
  latestMin: number | null,
  allTimes: HHMM[] | undefined
): WeeklyPatternEvaluation | null {
  if (!pattern) return null;
  const key = toDayKey(dateISO);
  const definition = pattern[key];
  if (!definition || !Array.isArray(definition.windows) || !definition.windows.length) {
    return null;
  }

  const windows = definition.windows.filter(
    (window): window is WeeklyPatternWindow =>
      window != null && isHHMM(window.start) && isHHMM(window.end)
  );
  if (!windows.length) return null;

  const windowSegments = windows.flatMap(expandWindowSegments);
  if (!windowSegments.length) return null;

  const punchSegments = pairPunches(allTimes, earliestMin, latestMin);
  if (!punchSegments.length) {
    return {
      dayKey: key,
      definition,
      windowSegments,
      workedSegments: [],
    };
  }

  const workedSegments: Array<{ start: number; end: number }> = [];
  for (const punch of punchSegments) {
    const normalizedPunches = punch.end - punch.start >= MINUTES_IN_DAY
      ? [
          { start: punch.start, end: punch.start + MINUTES_IN_DAY },
          { start: punch.start + MINUTES_IN_DAY, end: punch.end },
        ]
      : [punch];
    for (const segment of normalizedPunches) {
      for (const window of windowSegments) {
        const start = Math.max(segment.start, window.start);
        let end = Math.min(segment.end, window.end);
        if (window.end <= window.start && segment.end > MINUTES_IN_DAY) {
          const shiftedStart = Math.max(segment.start, window.start + MINUTES_IN_DAY);
          const shiftedEnd = Math.min(segment.end, window.end + MINUTES_IN_DAY);
          if (shiftedEnd > shiftedStart) {
            workedSegments.push({ start: shiftedStart, end: shiftedEnd });
          }
        }
        if (end <= start) continue;
        workedSegments.push({ start, end });
      }
    }
  }

  if (!workedSegments.length) {
    return {
      dayKey: key,
      definition,
      windowSegments,
      workedSegments: [],
    };
  }

  const merged: Array<{ start: number; end: number }> = [];
  for (const segment of workedSegments.sort((a, b) => a.start - b.start)) {
    const last = merged[merged.length - 1];
    if (!last || segment.start > last.end) {
      merged.push({ ...segment });
      continue;
    }
    if (segment.end > last.end) {
      last.end = segment.end;
    }
  }

  return {
    dayKey: key,
    definition,
    windowSegments,
    workedSegments: merged,
  };
}

export function evaluateDay(input: DayEvalInput) {
  const e = input.earliest ? toMin(input.earliest) : null;
  const l = input.latest ? toMin(input.latest) : null;

  const breakMin =
    "breakMinutes" in input.schedule && input.schedule.breakMinutes
      ? input.schedule.breakMinutes
      : 60;

  let worked = 0;
  let isLate = false;
  let isUndertime = false;
  let lateMinutes: number | null = null;
  let undertimeMinutes: number | null = null;
  let requiredMinutes: number | null = null;
  let scheduleStart: HHMM | null = null;
  let scheduleEnd: HHMM | null = null;
  let scheduleGraceMinutes: number | null = null;

  switch (input.schedule.type) {
    case "FIXED": {
      const start = toMin(input.schedule.startTime);
      const end = toMin(input.schedule.endTime);
      const grace = input.schedule.graceMinutes ?? 0;
      scheduleStart = input.schedule.startTime;
      scheduleEnd = input.schedule.endTime;
      scheduleGraceMinutes = grace;

      const span = e != null && l != null && l >= e ? l - e : 0;
      worked = Math.max(0, span - breakMin);

      if (e != null) isLate = e > start + grace;
      const required = Math.max(0, end - start - breakMin);
      requiredMinutes = required;
      isUndertime = worked < required;
      if (e != null) {
        lateMinutes = Math.max(0, e - (start + grace));
      }
      undertimeMinutes = Math.max(0, required - worked);
      break;
    }

    case "FLEX": {
      const weekly = evaluateWeeklyPattern(input.schedule.weeklyPattern, input.dateISO, e, l, input.allTimes);
      if (weekly) {
        requiredMinutes = weekly.definition.requiredMinutes;
        const totalWorked = weekly.workedSegments.reduce((sum, segment) => sum + (segment.end - segment.start), 0);
        worked = totalWorked;
        isLate = false;
        isUndertime = totalWorked < (requiredMinutes ?? 0);
        undertimeMinutes = Math.max(0, (requiredMinutes ?? 0) - totalWorked);
        lateMinutes = 0;
        scheduleStart = weekly.definition.windows[0]?.start ?? null;
        const lastWindow = weekly.definition.windows[weekly.definition.windows.length - 1];
        scheduleEnd = lastWindow ? lastWindow.end : null;
        return {
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
          weeklyPattern: {
            dayKey: weekly.dayKey,
            requiredMinutes,
            windows: weekly.definition.windows,
            windowSegments: weekly.windowSegments.map(normalizeWorkedSegment).map(({ start, end }) => ({
              start: minToHHMM(start),
              end: minToHHMM(end),
            })),
            workedSegments: weekly.workedSegments.map(normalizeWorkedSegment).map(({ start, end }) => ({
              start: minToHHMM(start),
              end: minToHHMM(end),
            })),
          },
        };
      }

      const coreS = toMin(input.schedule.coreStart);
      const coreE = toMin(input.schedule.coreEnd);
      const bandS = toMin(input.schedule.bandwidthStart);
      const bandE = toMin(input.schedule.bandwidthEnd);
      const req = input.schedule.requiredDailyMinutes;
      scheduleStart = input.schedule.coreStart;
      scheduleEnd = input.schedule.coreEnd;
      requiredMinutes = req;

      if (e == null || l == null) {
        worked = 0;
        isLate = true;
        isUndertime = true;
        lateMinutes = coreE - coreS;
        undertimeMinutes = req;
        break;
      }

      const effectiveStart = Math.max(e, bandS);
      const effectiveEnd = Math.min(l, bandE);

      if (effectiveEnd <= effectiveStart) {
        worked = 0;
        isLate = true;
        isUndertime = true;
        lateMinutes = coreE - coreS;
        undertimeMinutes = req;
        break;
      }

      const workedRaw = effectiveEnd - effectiveStart;
      worked = Math.max(0, workedRaw - breakMin);

      const overlapStart = Math.max(effectiveStart, coreS);
      const overlapEnd = Math.min(effectiveEnd, coreE);
      const presentInCore = overlapEnd > overlapStart;

      isLate = effectiveStart > coreS || !presentInCore;

      isUndertime = worked < req;
      undertimeMinutes = Math.max(0, req - worked);

      if (isLate) {
        let late = 0;
        if (effectiveStart > coreS) {
          late += effectiveStart - coreS;
        }
        if (!presentInCore) {
          late = Math.max(late, coreE - coreS);
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
      scheduleStart = input.schedule.shiftStart;
      scheduleEnd = input.schedule.shiftEnd;
      scheduleGraceMinutes = grace;

      if (shiftEnd <= shiftStart) shiftEnd += 24 * 60; // overnight

      const span = e != null && l != null && l >= e ? l - e : 0;
      worked = Math.max(0, span - breakMin);

      if (e != null) isLate = e > shiftStart + grace;
      const planned = Math.max(0, shiftEnd - shiftStart - breakMin);
      requiredMinutes = planned;
      isUndertime = worked < planned;
      if (e != null) {
        lateMinutes = Math.max(0, e - (shiftStart + grace));
      }
      undertimeMinutes = Math.max(0, planned - worked);
      break;
    }
  }

  return {
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
    weeklyPattern: null,
  };
}
