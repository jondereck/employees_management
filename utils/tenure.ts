type DateLike = string | Date | null | undefined;

export type TenureEvent = {
  type?: string | null;
  occurredAt?: DateLike;
  deletedAt?: DateLike;
};

export type TenureDuration = {
  years: number;
  months: number;
  days: number;
  totalDays: number;
};

export type TenureComputationInput = {
  dateHired?: DateLike;
  latestAppointment?: DateLike;
  terminateDate?: DateLike;
  isArchived?: boolean;
  employmentEvents?: TenureEvent[] | null;
};

export type TenureComputationResult = {
  totalService: TenureDuration;
  currentAppointment: TenureDuration;
  totalServiceYears: number;
  currentAppointmentYears: number;
};

type Interval = {
  start: Date;
  end: Date;
};

function clampNonNegative(n: number) {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function toUtcNoon(date: Date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0));
}

function parseMonthDayYear(value: string) {
  const match = value.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (!month || !day || !year) return null;
  const parsed = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseLongMonthDayYear(value: string) {
  const match = value.trim().match(/^(\d{1,2})\s+(\d{1,2}),\s*(\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (!month || !day || !year) return null;
  const parsed = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseFlexibleDate(value: DateLike): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : toUtcNoon(value);

  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const slash = parseMonthDayYear(trimmed);
  if (slash) return slash;

  const longMdy = parseLongMonthDayYear(trimmed);
  if (longMdy) return longMdy;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return toUtcNoon(parsed);
}

function dayDiff(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function diffCalendarYmd(start: Date, end: Date): Omit<TenureDuration, "totalDays"> {
  if (end.getTime() <= start.getTime()) {
    return { years: 0, months: 0, days: 0 };
  }

  let years = end.getUTCFullYear() - start.getUTCFullYear();
  let months = end.getUTCMonth() - start.getUTCMonth();
  let days = end.getUTCDate() - start.getUTCDate();

  if (days < 0) {
    months -= 1;
    const prevMonthLastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 0)).getUTCDate();
    days += prevMonthLastDay;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return {
    years: clampNonNegative(years),
    months: clampNonNegative(months),
    days: clampNonNegative(days),
  };
}

function normalizeFromDays(totalDays: number): Omit<TenureDuration, "totalDays"> {
  const safe = clampNonNegative(totalDays);
  const years = Math.floor(safe / 365);
  const afterYears = safe % 365;
  const months = Math.floor(afterYears / 30);
  const days = afterYears % 30;
  return { years, months, days };
}

function upperType(value?: string | null) {
  return String(value ?? "").trim().toUpperCase();
}

function buildActiveIntervals(input: TenureComputationInput, endDate: Date): Interval[] {
  const events = (input.employmentEvents ?? [])
    .filter((event) => !event?.deletedAt)
    .map((event) => ({
      type: upperType(event?.type),
      occurredAt: parseFlexibleDate(event?.occurredAt),
    }))
    .filter((event) => event.occurredAt)
    .sort((a, b) => a.occurredAt!.getTime() - b.occurredAt!.getTime());

  const intervals: Interval[] = [];
  let openStart: Date | null = null;

  for (const event of events) {
    if (!event.occurredAt) continue;
    if (event.type === "HIRED") {
      if (!openStart) openStart = event.occurredAt;
      continue;
    }

    if (event.type === "TERMINATED" && openStart) {
      if (event.occurredAt.getTime() > openStart.getTime()) {
        intervals.push({ start: openStart, end: event.occurredAt });
      }
      openStart = null;
    }
  }

  const parsedTermination = parseFlexibleDate(input.terminateDate);

  if (openStart) {
    const intervalEnd = parsedTermination && parsedTermination.getTime() > openStart.getTime()
      ? parsedTermination
      : endDate;
    if (intervalEnd.getTime() > openStart.getTime()) {
      intervals.push({ start: openStart, end: intervalEnd });
    }
  }

  if (intervals.length > 0) {
    return intervals;
  }

  const fallbackStart =
    parseFlexibleDate(input.latestAppointment) ??
    parseFlexibleDate(input.dateHired);
  if (!fallbackStart) return intervals;

  const fallbackEnd = parsedTermination && parsedTermination.getTime() > fallbackStart.getTime()
    ? parsedTermination
    : endDate;

  if (fallbackEnd.getTime() <= fallbackStart.getTime()) return intervals;
  return [{ start: fallbackStart, end: fallbackEnd }];
}

function computeCurrentAppointmentDuration(input: TenureComputationInput, endDate: Date): TenureDuration {
  const start =
    parseFlexibleDate(input.latestAppointment) ??
    parseFlexibleDate(input.dateHired);

  if (!start || endDate.getTime() <= start.getTime()) {
    return { years: 0, months: 0, days: 0, totalDays: 0 };
  }

  const ymd = diffCalendarYmd(start, endDate);
  return {
    ...ymd,
    totalDays: dayDiff(start, endDate),
  };
}

/** Compact tenure label for tables: years when ≥1, else months, else days. */
export function formatTenureShort(duration: Pick<TenureDuration, "years" | "months" | "days">): string {
  if (duration.years >= 1) {
    return `${duration.years} ${duration.years === 1 ? "yr" : "yrs"}`;
  }
  if (duration.months >= 1) {
    return `${duration.months} ${duration.months === 1 ? "mo" : "mos"}`;
  }
  const days = clampNonNegative(duration.days);
  return `${days} ${days === 1 ? "day" : "days"}`;
}

export function computeTenure(
  input: TenureComputationInput,
  now: Date = new Date()
): TenureComputationResult {
  const safeNow = parseFlexibleDate(now) ?? toUtcNoon(new Date());
  const parsedTermination = parseFlexibleDate(input.terminateDate);
  const endDate =
    parsedTermination && (input.isArchived || parsedTermination.getTime() < safeNow.getTime())
      ? parsedTermination
      : safeNow;

  const intervals = buildActiveIntervals(input, endDate);
  const totalDays = intervals.reduce((sum, interval) => sum + dayDiff(interval.start, interval.end), 0);
  const normalized = normalizeFromDays(totalDays);
  const currentAppointment = computeCurrentAppointmentDuration(input, endDate);

  return {
    totalService: {
      ...normalized,
      totalDays,
    },
    currentAppointment,
    totalServiceYears: normalized.years,
    currentAppointmentYears: currentAppointment.years,
  };
}

