import type { HHMM } from "@/types/time";

export type WeeklyPatternDayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type WeeklyPatternWindow = { start: HHMM; end: HHMM };

export type WeeklyPatternDay = { windows: WeeklyPatternWindow[]; requiredMinutes: number };

export type WeeklyPattern = Partial<Record<WeeklyPatternDayKey, WeeklyPatternDay>>;

export const WEEKDAY_ORDER: WeeklyPatternDayKey[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

export const WEEKDAY_LABELS: Record<WeeklyPatternDayKey, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

const HHMM_PATTERN = /^\d{2}:\d{2}$/;

export const isHHMM = (value: unknown): value is HHMM =>
  typeof value === "string" && HHMM_PATTERN.test(value);

const clampMinutes = (value: unknown): number | null => {
  if (!isHHMM(value)) return null;
  const [hours, minutes] = (value as string).split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (hours < 0 || hours > 23) return null;
  if (minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const MINUTES_IN_DAY = 24 * 60;

const toHHMM = (totalMinutes: number): HHMM =>
  `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}` as HHMM;

const sortWindowsInternal = <T extends { start: HHMM; end: HHMM; startMinutes: number; endMinutes: number }>(
  windows: T[]
) => {
  return [...windows].sort((a, b) => {
    const aOffset = a.startMinutes - (a.endMinutes <= a.startMinutes ? MINUTES_IN_DAY : 0);
    const bOffset = b.startMinutes - (b.endMinutes <= b.startMinutes ? MINUTES_IN_DAY : 0);

    if (aOffset === bOffset) {
      const aEnd = a.endMinutes + (a.endMinutes <= a.startMinutes ? MINUTES_IN_DAY : 0);
      const bEnd = b.endMinutes + (b.endMinutes <= b.startMinutes ? MINUTES_IN_DAY : 0);
      return aEnd - bEnd;
    }

    return aOffset - bOffset;
  });
};

export const sortWeeklyPatternWindows = (windows: WeeklyPatternWindow[]): WeeklyPatternWindow[] => {
  const enriched = windows
    .map((window) => {
      const startMinutes = clampMinutes(window.start);
      const endMinutes = clampMinutes(window.end);
      if (startMinutes == null || endMinutes == null) return null;
      return { ...window, startMinutes, endMinutes };
    })
    .filter((window): window is WeeklyPatternWindow & { startMinutes: number; endMinutes: number } => Boolean(window));

  if (!enriched.length) {
    return [];
  }

  return sortWindowsInternal(enriched).map(({ start, end }) => ({ start, end }));
};

const windowsOverlap = (windows: WeeklyPatternWindow[]): boolean => {
  const segments: Array<{ start: number; end: number }> = [];
  for (const window of windows) {
    const start = clampMinutes(window.start);
    const end = clampMinutes(window.end);
    if (start == null || end == null || start === end) {
      return true;
    }
    if (end > start) {
      segments.push({ start, end });
    } else {
      segments.push({ start, end: 24 * 60 });
      segments.push({ start: 0, end });
    }
  }
  segments.sort((a, b) => a.start - b.start || a.end - b.end);
  for (let i = 1; i < segments.length; i += 1) {
    const prev = segments[i - 1];
    const current = segments[i];
    if (current.start < prev.end) {
      return true;
    }
  }
  return false;
};

const sanitizeDay = (value: unknown): WeeklyPatternDay | null => {
  if (!value || typeof value !== "object") return null;
  const windowsRaw = (value as { windows?: unknown }).windows;
  const requiredRaw = (value as { requiredMinutes?: unknown }).requiredMinutes;
  if (!Array.isArray(windowsRaw)) return null;
  const windowsDraft: Array<WeeklyPatternWindow & { startMinutes: number; endMinutes: number }> = [];
  for (const entry of windowsRaw.slice(0, 3)) {
    const start = clampMinutes((entry as { start?: unknown })?.start ?? null);
    const end = clampMinutes((entry as { end?: unknown })?.end ?? null);
    if (start == null || end == null || start === end) continue;
    windowsDraft.push({
      start: toHHMM(start),
      end: toHHMM(end),
      startMinutes: start,
      endMinutes: end,
    });
  }
  if (!windowsDraft.length) return null;

  const sortedWindows = sortWindowsInternal(windowsDraft).map(({ start, end }) => ({ start, end }));

  if (windowsOverlap(sortedWindows)) return null;
  const required =
    typeof requiredRaw === "number" && Number.isFinite(requiredRaw)
      ? Math.max(0, Math.floor(requiredRaw))
      : null;
  if (required == null) return null;
  return { windows: sortedWindows, requiredMinutes: required };
};

export const normalizeWeeklyPattern = (value: unknown): WeeklyPattern | null => {
  if (!value || typeof value !== "object") return null;
  const pattern: WeeklyPattern = {};
  let hasDay = false;
  for (const key of WEEKDAY_ORDER) {
    const day = sanitizeDay((value as Record<string, unknown>)[key]);
    if (day) {
      pattern[key] = day;
      hasDay = true;
    }
  }
  return hasDay ? pattern : null;
};

export const hasOverlaps = (windows: WeeklyPatternWindow[]): boolean => windowsOverlap(windows);
