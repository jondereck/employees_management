import type { OvertimePolicy } from "@/types/attendance";
import type {
  HHMM,
  ScheduleFixed,
  ScheduleFlex,
  ScheduleShift,
  MinuteInterval,
} from "@/utils/evaluateDay";

const MINUTES_PER_DAY = 24 * 60;
const ND_START = 22 * 60;
const ND_END = 6 * 60;

type Interval = [number, number];

type AnySchedule = (ScheduleFixed | ScheduleFlex | ScheduleShift) & { type: string };

export type HolidayKind = "none" | "restday" | "holiday";

export type OvertimeComputation = {
  OT_pre: number;
  OT_post: number;
  OT_restday: number;
  OT_holiday: number;
  OT_total: number;
  ND_minutes: number;
};

const clampInterval = (start: number, end: number): Interval | null => {
  const s = Math.max(0, start);
  const e = Math.max(0, end);
  if (e <= s) return null;
  return [s, e];
};

const mergeIntervals = (intervals: Interval[]): Interval[] => {
  if (!intervals.length) return [];
  const sorted = [...intervals].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: Interval[] = [];
  let [currentStart, currentEnd] = sorted[0];
  for (let i = 1; i < sorted.length; i += 1) {
    const [start, end] = sorted[i];
    if (start <= currentEnd) {
      currentEnd = Math.max(currentEnd, end);
    } else {
      merged.push([currentStart, currentEnd]);
      currentStart = start;
      currentEnd = end;
    }
  }
  merged.push([currentStart, currentEnd]);
  return merged;
};

const sumIntervals = (intervals: Interval[]): number =>
  intervals.reduce((total, [start, end]) => total + Math.max(0, end - start), 0);

const clipIntervals = (intervals: Interval[], range: Interval): Interval[] => {
  if (range[1] <= range[0]) return [];
  const clipped: Interval[] = [];
  for (const [start, end] of intervals) {
    const s = Math.max(start, range[0]);
    const e = Math.min(end, range[1]);
    if (e > s) {
      clipped.push([s, e]);
    }
  }
  return clipped;
};

const subtractIntervals = (base: Interval[], toSubtract: Interval[]): Interval[] => {
  if (!base.length) return [];
  if (!toSubtract.length) return mergeIntervals(base);
  const result: Interval[] = [];
  for (const [start, end] of base) {
    let segments: Interval[] = [[start, end]];
    for (const [subStart, subEnd] of toSubtract) {
      if (subEnd <= subStart) continue;
      const next: Interval[] = [];
      for (const [segStart, segEnd] of segments) {
        if (subEnd <= segStart || subStart >= segEnd) {
          next.push([segStart, segEnd]);
          continue;
        }
        if (subStart > segStart) {
          next.push([segStart, Math.max(segStart, subStart)]);
        }
        if (subEnd < segEnd) {
          next.push([Math.min(subEnd, segEnd), segEnd]);
        }
      }
      segments = next;
      if (!segments.length) break;
    }
    result.push(...segments);
  }
  return mergeIntervals(result);
};

const extendForReference = (intervals: Interval[], reference: number): Interval[] => {
  if (!intervals.length) return [];
  const extended: Interval[] = [];
  for (const [start, end] of intervals) {
    const midpoint = (start + end) / 2;
    const shiftedMidpoint = midpoint + MINUTES_PER_DAY;
    const distOriginal = Math.abs(midpoint - reference);
    const distShifted = Math.abs(shiftedMidpoint - reference);
    if (distShifted < distOriginal) {
      extended.push([start + MINUTES_PER_DAY, end + MINUTES_PER_DAY]);
    } else {
      extended.push([start, end]);
    }
  }
  return mergeIntervals(extended);
};

const minutesOverlap = (a: Interval, b: Interval): number => {
  const start = Math.max(a[0], b[0]);
  const end = Math.min(a[1], b[1]);
  return Math.max(0, end - start);
};

const minutesInNightWindow = (intervals: Interval[]): number => {
  let total = 0;
  for (const interval of intervals) {
    let cursor = interval[0];
    const end = interval[1];
    while (cursor < end) {
      const dayIndex = Math.floor(cursor / MINUTES_PER_DAY);
      const dayStart = dayIndex * MINUTES_PER_DAY;
      const sliceEnd = Math.min(end, dayStart + MINUTES_PER_DAY);
      const local: Interval = [cursor - dayStart, sliceEnd - dayStart];
      total += minutesOverlap(local, [ND_START, MINUTES_PER_DAY]);
      total += minutesOverlap(local, [0, ND_END]);
      cursor = sliceEnd;
    }
  }
  return total;
};

const roundMinutes = (minutes: number, mode: OvertimePolicy["rounding"]): number => {
  if (!Number.isFinite(minutes)) return 0;
  if (mode === "none") return Math.max(0, Math.round(minutes));
  const step = mode === "nearest15" ? 15 : 30;
  return Math.max(0, Math.round(minutes / step) * step);
};

const applyMinBlock = (minutes: number, minBlock: number): number => {
  if (minBlock <= 0) return Math.max(0, minutes);
  return minutes >= minBlock ? Math.max(0, minutes) : 0;
};

const toMinutes = (value: HHMM): number => {
  const [hours, minutes] = value.split(":").map(Number);
  const normalizedHours = Number.isFinite(hours) ? hours % 24 : 0;
  const normalizedMinutes = Number.isFinite(minutes) ? minutes % 60 : 0;
  return normalizedHours * 60 + normalizedMinutes;
};

const takeTail = (segments: Interval[], minutes: number): Interval[] => {
  if (minutes <= 0) return [];
  const result: Interval[] = [];
  let remaining = minutes;
  for (let i = segments.length - 1; i >= 0 && remaining > 0; i -= 1) {
    const [start, end] = segments[i];
    const length = Math.max(0, end - start);
    if (!length) continue;
    const take = Math.min(length, remaining);
    result.unshift([end - take, end]);
    remaining -= take;
  }
  return mergeIntervals(result);
};

const sanitizePresence = (presence: MinuteInterval[]): Interval[] => {
  const normalized: Interval[] = [];
  for (const segment of presence) {
    const interval = clampInterval(segment.start, segment.end);
    if (interval) normalized.push(interval);
  }
  return mergeIntervals(normalized);
};

const zeroResult: OvertimeComputation = {
  OT_pre: 0,
  OT_post: 0,
  OT_restday: 0,
  OT_holiday: 0,
  OT_total: 0,
  ND_minutes: 0,
};

const combineSegments = (segments: Interval[][]): Interval[] =>
  mergeIntervals(segments.flatMap((group) => group));

const maybeClearSegments = (segments: Interval[], roundedMinutes: number): Interval[] =>
  roundedMinutes > 0 ? segments : [];

export type ComputeOvertimeInput = {
  schedule: AnySchedule;
  presence: MinuteInterval[];
  policy: OvertimePolicy;
  holiday: HolidayKind;
};

const computeRestOrHoliday = (
  presence: Interval[],
  policy: OvertimePolicy,
  bucket: "restday" | "holiday"
): OvertimeComputation => {
  const totalRaw = sumIntervals(presence);
  const thresholded = applyMinBlock(totalRaw, policy.minBlockMin);
  const rounded = roundMinutes(thresholded, policy.rounding);
  if (rounded <= 0) {
    return { ...zeroResult };
  }
  const nd = policy.nightDiffEnabled ? minutesInNightWindow(presence) : 0;
  if (bucket === "holiday") {
    return { ...zeroResult, OT_holiday: rounded, OT_total: rounded, ND_minutes: nd };
  }
  return { ...zeroResult, OT_restday: rounded, OT_total: rounded, ND_minutes: nd };
};

const computeFlexOvertime = (
  schedule: ScheduleFlex,
  presence: Interval[],
  policy: OvertimePolicy
): { minutes: number; segments: Interval[] } => {
  if (!presence.length) return { minutes: 0, segments: [] };
  const bandwidthStart = toMinutes(schedule.bandwidthStart);
  let bandwidthEnd = toMinutes(schedule.bandwidthEnd);
  if (bandwidthEnd <= bandwidthStart) {
    bandwidthEnd += MINUTES_PER_DAY;
  }

  const extendedPresence = extendForReference(presence, bandwidthStart);
  const bandRange: Interval = [bandwidthStart, bandwidthEnd];
  const inBand = mergeIntervals(clipIntervals(extendedPresence, bandRange));
  const outBand = subtractIntervals(extendedPresence, [bandRange]);
  const outBandMinutes = sumIntervals(outBand);
  const totalPresence = sumIntervals(extendedPresence);

  if (policy.flexMode === "strict") {
    return { minutes: outBandMinutes, segments: outBand };
  }

  const overflow = Math.max(0, totalPresence - schedule.requiredDailyMinutes);
  const additionalInside = Math.max(0, overflow - outBandMinutes);
  if (additionalInside <= 0) {
    return { minutes: outBandMinutes, segments: outBand };
  }

  const tailSegments = takeTail(inBand, additionalInside);
  const segments = mergeIntervals([...outBand, ...tailSegments]);
  const minutes = sumIntervals(segments);
  return { minutes, segments };
};

const computeFixedOrShiftOvertime = (
  schedule: ScheduleFixed | ScheduleShift,
  presence: Interval[],
  policy: OvertimePolicy
): { pre: { minutes: number; segments: Interval[] }; post: { minutes: number; segments: Interval[] } } => {
  if (!presence.length) {
    return {
      pre: { minutes: 0, segments: [] },
      post: { minutes: 0, segments: [] },
    };
  }

  const start = schedule.type === "FIXED" ? toMinutes(schedule.startTime) : toMinutes(schedule.shiftStart);
  let end = schedule.type === "FIXED" ? toMinutes(schedule.endTime) : toMinutes(schedule.shiftEnd);
  if (end <= start) {
    end += MINUTES_PER_DAY;
  }
  const extendedPresence = extendForReference(presence, start);
  const preRange: Interval = [start - MINUTES_PER_DAY, start];
  const postRange: Interval = [end + policy.graceAfterEndMin, start + MINUTES_PER_DAY];

  const preSegments = policy.countPreShift
    ? mergeIntervals(clipIntervals(extendedPresence, preRange))
    : [];
  const postSegments = mergeIntervals(clipIntervals(extendedPresence, postRange));

  const preMinutes = sumIntervals(preSegments);
  const postMinutes = sumIntervals(postSegments);

  return {
    pre: { minutes: preMinutes, segments: preSegments },
    post: { minutes: postMinutes, segments: postSegments },
  };
};

export const computeOvertimeForDay = (input: ComputeOvertimeInput): OvertimeComputation => {
  const presence = sanitizePresence(input.presence);
  if (!presence.length) {
    return { ...zeroResult };
  }

  const { policy } = input;

  if (input.holiday === "holiday") {
    return computeRestOrHoliday(presence, policy, "holiday");
  }

  if (input.holiday === "restday") {
    return computeRestOrHoliday(presence, policy, "restday");
  }

  let otPreMinutes = 0;
  let otPostMinutes = 0;
  let otGeneralMinutes = 0;
  let preSegments: Interval[] = [];
  let postSegments: Interval[] = [];
  let generalSegments: Interval[] = [];

  if (input.schedule.type === "FLEX") {
    const { minutes, segments } = computeFlexOvertime(input.schedule, presence, policy);
    otGeneralMinutes = minutes;
    generalSegments = segments;
  } else if (input.schedule.type === "FIXED" || input.schedule.type === "SHIFT") {
    const { pre, post } = computeFixedOrShiftOvertime(input.schedule, presence, policy);
    otPreMinutes = pre.minutes;
    otPostMinutes = post.minutes;
    preSegments = pre.segments;
    postSegments = post.segments;
  }

  const preThresholded = applyMinBlock(otPreMinutes, policy.minBlockMin);
  const postThresholded = applyMinBlock(otPostMinutes, policy.minBlockMin);
  const generalThresholded = applyMinBlock(otGeneralMinutes, policy.minBlockMin);

  const preRounded = roundMinutes(preThresholded, policy.rounding);
  const postRounded = roundMinutes(postThresholded, policy.rounding);
  const generalRounded = roundMinutes(generalThresholded, policy.rounding);

  const otSegments = combineSegments([
    maybeClearSegments(preSegments, preRounded),
    maybeClearSegments(postSegments, postRounded),
    maybeClearSegments(generalSegments, generalRounded),
  ]);

  let otTotal = preRounded + postRounded + generalRounded;

  if (
    policy.mealDeductMin &&
    policy.mealDeductMin > 0 &&
    policy.mealTriggerMin &&
    policy.mealTriggerMin > 0 &&
    otTotal >= policy.mealTriggerMin
  ) {
    otTotal = Math.max(0, otTotal - policy.mealDeductMin);
  }

  const ndMinutes = policy.nightDiffEnabled ? minutesInNightWindow(otSegments) : 0;

  return {
    OT_pre: preRounded,
    OT_post: postRounded,
    OT_restday: 0,
    OT_holiday: 0,
    OT_total: otTotal,
    ND_minutes: ndMinutes,
  };
};
