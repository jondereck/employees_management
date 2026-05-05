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

type ScheduleNone = { type: "NONE" };

type AnySchedule = ScheduleNone | ((ScheduleFixed | ScheduleFlex | ScheduleShift) & { type: string });

export type HolidayKind = "none" | "restday" | "holiday";

export type OvertimeComputation = {
  OT_pre: number;
  OT_post: number;
  OT_restday: number;
  OT_holiday: number;
  OT_excused: number;
  OT_total: number;
  ND_minutes: number;
  spillover?: OvertimeComputation | null;
  trace?: OvertimeTrace | null;
};

export type OvertimeTrace = {
  scheduleType: string;
  scheduleStart: string | null;
  scheduleEnd: string | null;
  postShiftStart: string | null;
  firstSegmentStart: string | null;
  lastSegmentEnd: string | null;
  rawPreMinutes: number;
  rawPostMinutes: number;
  rawGeneralMinutes: number;
  thresholdedPreMinutes: number;
  thresholdedPostMinutes: number;
  thresholdedGeneralMinutes: number;
  roundedPreMinutes: number;
  roundedPostMinutes: number;
  roundedGeneralMinutes: number;
  mealDeductedMinutes: number;
  mealApplied: boolean;
  nightDiffMinutes: number;
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

const toHHMMLabel = (minutes: number): string => {
  if (minutes === MINUTES_PER_DAY) return "24:00";
  const normalized = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
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
  const merged = mergeIntervals(normalized);
  if (merged.length < 2) return merged;
  const trailingStarts = merged
    .filter(([, end]) => end === MINUTES_PER_DAY)
    .map(([start]) => start);
  const hasStartOfDaySegment = merged.some(([start]) => start === 0);
  if (!trailingStarts.length || !hasStartOfDaySegment) return merged;

  const splitPoint = Math.max(...trailingStarts);
  return mergeIntervals(
    merged.map(([start, end]) =>
      end <= splitPoint ? [start + MINUTES_PER_DAY, end + MINUTES_PER_DAY] : [start, end]
    )
  );
};

const zeroResult: OvertimeComputation = {
  OT_pre: 0,
  OT_post: 0,
  OT_restday: 0,
  OT_holiday: 0,
  OT_excused: 0,
  OT_total: 0,
  ND_minutes: 0,
  spillover: null,
  trace: null,
};

const combineSegments = (segments: Interval[][]): Interval[] =>
  mergeIntervals(segments.flatMap((group) => group));

const maybeClearSegments = (segments: Interval[], roundedMinutes: number): Interval[] =>
  roundedMinutes > 0 ? segments : [];

const splitSegmentsByDay = (segments: Interval[]): { current: Interval[]; next: Interval[] } => {
  const current: Interval[] = [];
  const next: Interval[] = [];

  for (const [start, end] of segments) {
    const currentStart = Math.max(0, start);
    const currentEnd = Math.min(MINUTES_PER_DAY, end);
    if (currentEnd > currentStart) {
      current.push([currentStart, currentEnd]);
    }

    const nextStart = Math.max(MINUTES_PER_DAY, start);
    const nextEnd = Math.min(MINUTES_PER_DAY * 2, end);
    if (nextEnd > nextStart) {
      next.push([nextStart - MINUTES_PER_DAY, nextEnd - MINUTES_PER_DAY]);
    }
  }

  return { current: mergeIntervals(current), next: mergeIntervals(next) };
};

type RawBucketSegments = {
  pre?: Interval[];
  post?: Interval[];
  general?: Interval[];
  restday?: Interval[];
  holiday?: Interval[];
};

type FinalizeBucketsInput = {
  policy: OvertimePolicy;
  scheduleType: string;
  scheduleStart: string | null;
  scheduleEnd: string | null;
  postShiftStart: string | null;
  buckets: RawBucketSegments;
  kind: "regular" | "restday" | "holiday";
};

const getFirstSegmentStart = (segments: Interval[]): string | null =>
  segments.length ? toHHMMLabel(segments[0][0]) : null;

const getLastSegmentEnd = (segments: Interval[]): string | null =>
  segments.length ? toHHMMLabel(segments[segments.length - 1][1]) : null;

const finalizeBuckets = ({
  policy,
  scheduleType,
  scheduleStart,
  scheduleEnd,
  postShiftStart,
  buckets,
  kind,
}: FinalizeBucketsInput): OvertimeComputation => {
  const preSegments = mergeIntervals(buckets.pre ?? []);
  const postSegments = mergeIntervals(buckets.post ?? []);
  const generalSegments = mergeIntervals(buckets.general ?? []);
  const restdaySegments = mergeIntervals(buckets.restday ?? []);
  const holidaySegments = mergeIntervals(buckets.holiday ?? []);

  const rawPreMinutes = sumIntervals(preSegments);
  const rawPostMinutes = sumIntervals(postSegments);
  const rawGeneralMinutes = sumIntervals(generalSegments);
  const rawRestdayMinutes = sumIntervals(restdaySegments);
  const rawHolidayMinutes = sumIntervals(holidaySegments);

  const thresholdedPreMinutes = applyMinBlock(rawPreMinutes, policy.minBlockMin);
  const thresholdedPostMinutes = applyMinBlock(rawPostMinutes, policy.minBlockMin);
  const thresholdedGeneralMinutes = applyMinBlock(rawGeneralMinutes, policy.minBlockMin);
  const thresholdedRestdayMinutes = applyMinBlock(rawRestdayMinutes, policy.minBlockMin);
  const thresholdedHolidayMinutes = applyMinBlock(rawHolidayMinutes, policy.minBlockMin);

  const roundedPreMinutes = roundMinutes(thresholdedPreMinutes, policy.rounding);
  const roundedPostMinutes = roundMinutes(thresholdedPostMinutes, policy.rounding);
  const roundedGeneralMinutes = roundMinutes(thresholdedGeneralMinutes, policy.rounding);
  const roundedRestdayMinutes = roundMinutes(thresholdedRestdayMinutes, policy.rounding);
  const roundedHolidayMinutes = roundMinutes(thresholdedHolidayMinutes, policy.rounding);

  const otSegments = combineSegments([
    maybeClearSegments(preSegments, roundedPreMinutes),
    maybeClearSegments(postSegments, roundedPostMinutes),
    maybeClearSegments(generalSegments, roundedGeneralMinutes),
    maybeClearSegments(restdaySegments, roundedRestdayMinutes),
    maybeClearSegments(holidaySegments, roundedHolidayMinutes),
  ]);

  let otPreMinutes = roundedPreMinutes;
  let otPostMinutes = roundedPostMinutes;
  let otGeneralMinutes = roundedGeneralMinutes;
  let otRestdayMinutes = roundedRestdayMinutes;
  let otHolidayMinutes = roundedHolidayMinutes;

  let otTotal =
    otPreMinutes +
    otPostMinutes +
    otGeneralMinutes +
    otRestdayMinutes +
    otHolidayMinutes;

  let mealDeductedMinutes = 0;
  let mealApplied = false;
  if (
    policy.mealDeductMin &&
    policy.mealDeductMin > 0 &&
    policy.mealTriggerMin &&
    policy.mealTriggerMin > 0 &&
    otTotal >= policy.mealTriggerMin
  ) {
    mealDeductedMinutes = Math.min(policy.mealDeductMin, otTotal);
    otTotal = Math.max(0, otTotal - mealDeductedMinutes);
    mealApplied = mealDeductedMinutes > 0;

    if (mealApplied) {
      if (kind === "restday") {
        otRestdayMinutes = Math.max(0, otRestdayMinutes - mealDeductedMinutes);
      } else if (kind === "holiday") {
        otHolidayMinutes = Math.max(0, otHolidayMinutes - mealDeductedMinutes);
      }
    }
  }

  const nightDiffMinutes = policy.nightDiffEnabled ? minutesInNightWindow(otSegments) : 0;
  const allSegments = combineSegments([
    preSegments,
    postSegments,
    generalSegments,
    restdaySegments,
    holidaySegments,
  ]);

  return {
    OT_pre: otPreMinutes,
    OT_post: otPostMinutes,
    OT_restday: otRestdayMinutes,
    OT_holiday: otHolidayMinutes,
    OT_excused: 0,
    OT_total: otTotal,
    ND_minutes: nightDiffMinutes,
    spillover: null,
    trace: {
      scheduleType,
      scheduleStart,
      scheduleEnd,
      postShiftStart,
      firstSegmentStart: getFirstSegmentStart(allSegments),
      lastSegmentEnd: getLastSegmentEnd(allSegments),
      rawPreMinutes,
      rawPostMinutes,
      rawGeneralMinutes:
        kind === "restday" ? rawRestdayMinutes : kind === "holiday" ? rawHolidayMinutes : rawGeneralMinutes,
      thresholdedPreMinutes,
      thresholdedPostMinutes,
      thresholdedGeneralMinutes:
        kind === "restday"
          ? thresholdedRestdayMinutes
          : kind === "holiday"
          ? thresholdedHolidayMinutes
          : thresholdedGeneralMinutes,
      roundedPreMinutes,
      roundedPostMinutes,
      roundedGeneralMinutes:
        kind === "restday" ? roundedRestdayMinutes : kind === "holiday" ? roundedHolidayMinutes : roundedGeneralMinutes,
      mealDeductedMinutes,
      mealApplied,
      nightDiffMinutes,
    },
  };
};

const splitBucketSegments = (buckets: RawBucketSegments): { current: RawBucketSegments; next: RawBucketSegments } => {
  const current: RawBucketSegments = {};
  const next: RawBucketSegments = {};

  for (const key of ["pre", "post", "general", "restday", "holiday"] as const) {
    const segments = buckets[key];
    if (!segments?.length) continue;
    const split = splitSegmentsByDay(segments);
    if (split.current.length) current[key] = split.current;
    if (split.next.length) next[key] = split.next;
  }

  return { current, next };
};

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
  const split = splitBucketSegments(bucket === "holiday" ? { holiday: presence } : { restday: presence });
  const current = finalizeBuckets({
    policy,
    scheduleType: bucket === "holiday" ? "HOLIDAY" : "RESTDAY",
    scheduleStart: null,
    scheduleEnd: null,
    postShiftStart: null,
    buckets: split.current,
    kind: bucket,
  });
  const spillover = finalizeBuckets({
    policy,
    scheduleType: bucket === "holiday" ? "HOLIDAY" : "RESTDAY",
    scheduleStart: null,
    scheduleEnd: null,
    postShiftStart: null,
    buckets: split.next,
    kind: bucket,
  });
  return {
    ...current,
    spillover: spillover.OT_total > 0 || spillover.ND_minutes > 0 ? spillover : null,
  };
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

  const extendedPresence = presence;
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
  const preRange: Interval = [start - MINUTES_PER_DAY, start];
  const postRange: Interval = [end + policy.graceAfterEndMin, start + MINUTES_PER_DAY];

  const preSegments = policy.countPreShift
    ? mergeIntervals(clipIntervals(presence, preRange))
    : [];
  const postSegments = mergeIntervals(clipIntervals(presence, postRange));

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

  let preSegments: Interval[] = [];
  let postSegments: Interval[] = [];
  let generalSegments: Interval[] = [];
  let scheduleStart: string | null = null;
  let scheduleEnd: string | null = null;
  let postShiftStart: string | null = null;

  if (input.schedule.type === "NONE") {
    generalSegments = presence;
  } else if (input.schedule.type === "FLEX") {
    scheduleStart = input.schedule.bandwidthStart;
    scheduleEnd = input.schedule.bandwidthEnd;
    const { segments } = computeFlexOvertime(input.schedule, presence, policy);
    generalSegments = segments;
  } else if (input.schedule.type === "FIXED" || input.schedule.type === "SHIFT") {
    scheduleStart = input.schedule.type === "FIXED" ? input.schedule.startTime : input.schedule.shiftStart;
    scheduleEnd = input.schedule.type === "FIXED" ? input.schedule.endTime : input.schedule.shiftEnd;
    const rawEnd = input.schedule.type === "FIXED" ? toMinutes(input.schedule.endTime) : toMinutes(input.schedule.shiftEnd);
    postShiftStart = toHHMMLabel(rawEnd + policy.graceAfterEndMin);
    const { pre, post } = computeFixedOrShiftOvertime(input.schedule, presence, policy);
    preSegments = pre.segments;
    postSegments = post.segments;
  }

  const split = splitBucketSegments({ pre: preSegments, post: postSegments, general: generalSegments });
  const current = finalizeBuckets({
    policy,
    scheduleType: input.schedule.type,
    scheduleStart,
    scheduleEnd,
    postShiftStart,
    buckets: split.current,
    kind: "regular",
  });
  const spillover = finalizeBuckets({
    policy,
    scheduleType: input.schedule.type,
    scheduleStart,
    scheduleEnd,
    postShiftStart,
    buckets: split.next,
    kind: "regular",
  });

  return {
    ...current,
    spillover: spillover.OT_total > 0 || spillover.ND_minutes > 0 ? spillover : null,
  };
};
