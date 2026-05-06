const DEFAULT_BIRTHDAY_TIME_ZONE = "Asia/Manila";

type MonthDay = {
  month: number;
  day: number;
};

function parseDate(value: Date | string | number): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDateParts(
  value: Date | string | number,
  timeZone = DEFAULT_BIRTHDAY_TIME_ZONE
) {
  const date = parseDate(value);
  if (!date) return null;

  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
}

/**
 * Returns numeric month/day in a stable timezone so day 01 does not drift
 * across month boundaries on UTC servers.
 */
export function getMonthDayInTimeZone(
  value: Date | string | number,
  timeZone = DEFAULT_BIRTHDAY_TIME_ZONE
): MonthDay | null {
  const parts = getDateParts(value, timeZone);
  if (!parts) return null;

  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);

  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
  return { month, day };
}

export function getCurrentMonthIndexInTimeZone(timeZone = DEFAULT_BIRTHDAY_TIME_ZONE) {
  const parts = getDateParts(new Date(), timeZone);
  const month = Number(parts?.find((p) => p.type === "month")?.value);
  if (!Number.isFinite(month)) return new Date().getMonth();
  return Math.min(12, Math.max(1, month)) - 1;
}

export function getCurrentYearInTimeZone(timeZone = DEFAULT_BIRTHDAY_TIME_ZONE) {
  const parts = getDateParts(new Date(), timeZone);
  const year = Number(parts?.find((p) => p.type === "year")?.value);
  if (!Number.isFinite(year)) return new Date().getFullYear();
  return Math.trunc(year);
}

export function isBirthdayOnDate(
  birthday: Date | string | number,
  targetDate = new Date(),
  timeZone = DEFAULT_BIRTHDAY_TIME_ZONE
) {
  const birthdayMonthDay = getMonthDayInTimeZone(birthday, timeZone);
  const targetMonthDay = getMonthDayInTimeZone(targetDate, timeZone);
  if (!birthdayMonthDay || !targetMonthDay) return false;

  return (
    birthdayMonthDay.month === targetMonthDay.month &&
    birthdayMonthDay.day === targetMonthDay.day
  );
}

