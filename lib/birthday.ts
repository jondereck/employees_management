const DEFAULT_BIRTHDAY_TIME_ZONE = "Asia/Manila";

type MonthDay = {
  month: number;
  day: number;
};

function parseDate(value: Date | string | number): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Returns numeric month/day in a stable timezone so day 01 does not drift
 * across month boundaries on UTC servers.
 */
export function getMonthDayInTimeZone(
  value: Date | string | number,
  timeZone = DEFAULT_BIRTHDAY_TIME_ZONE
): MonthDay | null {
  const date = parseDate(value);
  if (!date) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);

  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
  return { month, day };
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

