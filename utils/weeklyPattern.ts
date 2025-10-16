import type { HHMM } from "@/types/time";

export type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const WEEKDAY_KEYS: WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

export type WeeklyPatternWindow = { start: HHMM; end: HHMM };

export type WeeklyPatternDay = {
  windows: WeeklyPatternWindow[];
  requiredMinutes: number;
};

export type WeeklyPattern = Partial<Record<WeekdayKey, WeeklyPatternDay>>;

export type ExpandedWindow = {
  start: number;
  end: number;
};

const clampMinutes = (value: number) => Math.max(0, Math.min(24 * 60, value));

export const toMinutes = (value: string): number => {
  const [h, m] = value.split(":").map(Number);
  const total = (h % 24) * 60 + (m % 60);
  return clampMinutes(total);
};

export const minutesToHHMM = (value: number): HHMM => {
  const normalized = ((value % (24 * 60)) + (24 * 60)) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` as HHMM;
};

export const expandWindow = (window: WeeklyPatternWindow): ExpandedWindow[] => {
  const start = toMinutes(window.start);
  const end = toMinutes(window.end);
  if (start === end) {
    return [];
  }
  if (end > start) {
    return [{ start, end }];
  }
  return [
    { start, end: 24 * 60 },
    { start: 0, end },
  ];
};

export const expandWindows = (windows: WeeklyPatternWindow[]): ExpandedWindow[] => {
  const segments: ExpandedWindow[] = [];
  for (const window of windows) {
    segments.push(...expandWindow(window));
  }
  return segments;
};

export const HHMM_REGEX = /^\d{2}:\d{2}$/;

export const sanitizeWeeklyPattern = (raw: unknown): WeeklyPattern | null => {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const pattern: WeeklyPattern = {};
  for (const key of WEEKDAY_KEYS) {
    const dayRaw = record[key];
    if (!dayRaw || typeof dayRaw !== "object") continue;
    const dayObj = dayRaw as Record<string, unknown>;
    const windowsRaw = Array.isArray(dayObj.windows) ? dayObj.windows : [];
    const windows: WeeklyPatternWindow[] = [];
    for (const windowRaw of windowsRaw) {
      if (!windowRaw || typeof windowRaw !== "object") continue;
      const windowObj = windowRaw as Record<string, unknown>;
      const start = typeof windowObj.start === "string" ? windowObj.start : "";
      const end = typeof windowObj.end === "string" ? windowObj.end : "";
      if (!HHMM_REGEX.test(start) || !HHMM_REGEX.test(end)) continue;
      windows.push({ start: start as HHMM, end: end as HHMM });
    }
    const requiredValue = Number(dayObj.requiredMinutes ?? 0);
    const requiredMinutes = Number.isFinite(requiredValue) ? requiredValue : 0;
    if (!windows.length && requiredMinutes <= 0) continue;
    pattern[key] = { windows, requiredMinutes };
  }
  return Object.keys(pattern).length ? pattern : null;
};

export const validateWeeklyPatternDay = (
  day: WeeklyPatternDay | null | undefined
): string | null => {
  if (!day) return null;
  const { windows, requiredMinutes } = day;
  if (!windows.length) {
    if (requiredMinutes > 0) {
      return "Add at least one window to enforce required minutes.";
    }
    return null;
  }
  if (requiredMinutes < 0) {
    return "Required minutes must be zero or greater.";
  }
  const segments: ExpandedWindow[] = [];
  for (const window of windows) {
    if (!window.start || !window.end) {
      return "Start and end are required.";
    }
    const expanded = expandWindow(window);
    if (!expanded.length) {
      return "Start and end must not be the same.";
    }
    segments.push(...expanded);
  }
  segments.sort((a, b) => a.start - b.start || a.end - b.end);
  for (let i = 1; i < segments.length; i += 1) {
    const prev = segments[i - 1];
    const curr = segments[i];
    if (curr.start < prev.end) {
      return "Windows for this day overlap.";
    }
  }
  return null;
};

export const hasWeeklyPattern = (pattern: WeeklyPattern | null | undefined): boolean => {
  if (!pattern) return false;
  return WEEKDAY_KEYS.some((key) => {
    const day = pattern[key];
    return Boolean(day && day.windows?.length);
  });
};

export type TimelineSegment = {
  start: number;
  end: number;
};

export const normalizeTimelineSegments = (segments: TimelineSegment[]): TimelineSegment[] => {
  const normalized: TimelineSegment[] = [];
  for (const segment of segments) {
    if (segment.end <= segment.start) {
      normalized.push({ start: segment.start, end: 24 * 60 });
      normalized.push({ start: 0, end: segment.end });
    } else {
      normalized.push({ start: segment.start, end: segment.end });
    }
  }
  return normalized
    .map((segment) => ({
      start: clampMinutes(segment.start),
      end: clampMinutes(segment.end),
    }))
    .filter((segment) => segment.end > segment.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
};

export const WEEKLY_PATTERN_HINT =
  "If set, presence is counted only within these hours. Day is floating; no core lateness. Undertime if net minutes < required.";
