import type { HHMM } from "@/types/time";

export type RotationWorkDay = {
  kind: "WORK";
  start: HHMM;
  end: HHMM;
  breakMinutes?: number;
  graceMinutes?: number;
};

export type RotationOffDay = {
  kind: "OFF";
};

export type RotationDay = RotationWorkDay | RotationOffDay;

export type RotationPattern = {
  days: RotationDay[];
};

export const ROTATION_MIN_DAYS = 2;
export const ROTATION_MAX_DAYS = 31;

export const ROTATION_HHMM_REGEX = /^\d{2}:\d{2}$/;

const isValidHHMM = (value: unknown): value is HHMM =>
  typeof value === "string" && ROTATION_HHMM_REGEX.test(value);

const normalizeOptionalMinutes = (
  value: unknown,
  max: number
): number | undefined => {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(max, Math.max(0, Math.round(parsed)));
};

export const sanitizeRotationPattern = (raw: unknown): RotationPattern | null => {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const rawDays = Array.isArray(record.days) ? record.days : [];
  const days: RotationDay[] = [];

  for (const rawDay of rawDays) {
    if (!rawDay || typeof rawDay !== "object") continue;
    const day = rawDay as Record<string, unknown>;
    if (day.kind === "OFF") {
      days.push({ kind: "OFF" });
      continue;
    }

    if (day.kind !== "WORK") continue;
    const start = day.start;
    const end = day.end;
    if (!isValidHHMM(start) || !isValidHHMM(end) || start === end) continue;
    const workDay: RotationWorkDay = {
      kind: "WORK",
      start,
      end,
    };
    const breakMinutes = normalizeOptionalMinutes(day.breakMinutes, 720);
    const graceMinutes = normalizeOptionalMinutes(day.graceMinutes, 180);
    if (breakMinutes !== undefined) workDay.breakMinutes = breakMinutes;
    if (graceMinutes !== undefined) workDay.graceMinutes = graceMinutes;
    days.push(workDay);
  }

  if (days.length < ROTATION_MIN_DAYS || days.length > ROTATION_MAX_DAYS) {
    return null;
  }
  if (!days.some((day) => day.kind === "WORK")) {
    return null;
  }
  return { days };
};

export const hasRotationPattern = (
  pattern: RotationPattern | null | undefined
): pattern is RotationPattern =>
  Boolean(pattern && pattern.days.length >= ROTATION_MIN_DAYS);

const toUtcDayIndex = (dateISO: string): number => {
  const [year, month, day] = dateISO.slice(0, 10).split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
};

export const resolveRotationDay = (
  pattern: RotationPattern,
  anchorDateISO: string,
  dateISO: string
): { day: RotationDay; index: number } => {
  const diff = toUtcDayIndex(dateISO) - toUtcDayIndex(anchorDateISO);
  const length = pattern.days.length;
  const index = ((diff % length) + length) % length;
  return { day: pattern.days[index], index };
};

