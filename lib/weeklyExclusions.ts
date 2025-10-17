import type { WeeklyExclusion } from "@prisma/client";

export const WEEKLY_EXCLUSION_MODES = ["EXCUSED", "IGNORE_LATE_UNTIL"] as const;

export type WeeklyExclusionMode = (typeof WEEKLY_EXCLUSION_MODES)[number];

export type WeeklyExclusionDTO = {
  id: string;
  employeeId: string;
  weekday: number;
  mode: WeeklyExclusionMode;
  ignoreUntil: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WeeklyExclusionEvaluation = {
  id: string;
  employeeId: string;
  weekday: number;
  mode: WeeklyExclusionMode;
  ignoreUntilMinutes: number | null;
  ignoreUntilLabel: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

export const MINUTES_IN_DAY = 24 * 60;

const pad = (value: number) => String(value).padStart(2, "0");

export const toMinutesFromHHMM = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const [hoursPart, minutesPart] = value.split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

export const toHHMMFromMinutes = (value: number | null | undefined): string | null => {
  if (value == null || Number.isNaN(value)) return null;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${pad(hours)}:${pad(minutes)}`;
};

const toIgnoreUntilMinutes = (value: Date | null): number | null => {
  if (!value) return null;
  const hours = value.getUTCHours();
  const minutes = value.getUTCMinutes();
  return hours * 60 + minutes;
};

export const toWeeklyExclusionDto = (exclusion: WeeklyExclusion): WeeklyExclusionDTO => {
  const ignoreMinutes = toIgnoreUntilMinutes(exclusion.ignoreUntil ?? null);
  return {
    id: exclusion.id,
    employeeId: exclusion.employeeId,
    weekday: exclusion.weekday,
    mode: exclusion.mode as WeeklyExclusionMode,
    ignoreUntil: toHHMMFromMinutes(ignoreMinutes),
    effectiveFrom: exclusion.effectiveFrom.toISOString(),
    effectiveTo: exclusion.effectiveTo ? exclusion.effectiveTo.toISOString() : null,
    createdAt: exclusion.createdAt.toISOString(),
    updatedAt: exclusion.updatedAt.toISOString(),
  };
};

export const toWeeklyExclusionEvaluation = (
  exclusion: WeeklyExclusion
): WeeklyExclusionEvaluation => {
  const ignoreMinutes = toIgnoreUntilMinutes(exclusion.ignoreUntil ?? null);
  return {
    id: exclusion.id,
    employeeId: exclusion.employeeId,
    weekday: exclusion.weekday,
    mode: exclusion.mode as WeeklyExclusionMode,
    ignoreUntilMinutes: ignoreMinutes,
    ignoreUntilLabel: toHHMMFromMinutes(ignoreMinutes),
    effectiveFrom: exclusion.effectiveFrom,
    effectiveTo: exclusion.effectiveTo ?? null,
  };
};

export const weekdayNumberToLabel = (weekday: number): string => {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const index = ((weekday - 1) % 7 + 7) % 7;
  return labels[index] ?? "Mon";
};

export const isDateWithinRange = (date: Date, from: Date, to: Date | null): boolean => {
  if (to == null) {
    return date >= from;
  }
  return date >= from && date <= to;
};

export const toWeekdayNumberFromDate = (date: Date): number => {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
};

export const findWeeklyExclusionForDate = (
  exclusions: WeeklyExclusionEvaluation[] | undefined,
  dateISO: string
): WeeklyExclusionEvaluation | null => {
  if (!exclusions || !exclusions.length) return null;
  const date = new Date(`${dateISO}T00:00:00.000Z`);
  const weekday = toWeekdayNumberFromDate(date);
  return (
    exclusions.find(
      (exclusion) =>
        exclusion.weekday === weekday &&
        isDateWithinRange(date, exclusion.effectiveFrom, exclusion.effectiveTo)
    ) ?? null
  );
};

export const toIgnoreUntilDate = (value: string | null | undefined): Date | null => {
  const minutes = toMinutesFromHHMM(value ?? null);
  if (minutes == null) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return new Date(Date.UTC(1970, 0, 1, hours, mins, 0, 0));
};

