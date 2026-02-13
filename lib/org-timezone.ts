const DEFAULT_ORG_TIME_ZONE =
  process.env.NEXT_PUBLIC_ORG_TIME_ZONE ||
  process.env.NEXT_PUBLIC_BIRTHDAY_TIME_ZONE ||
  process.env.ORG_TIME_ZONE ||
  process.env.BIRTHDAY_TIME_ZONE ||
  "Asia/Manila";

type FormatterCache = {
  timeZone: string;
  formatter: Intl.DateTimeFormat;
};

let formatterCache: FormatterCache | null = null;

function getFormatter(timeZone: string) {
  if (!formatterCache || formatterCache.timeZone !== timeZone) {
    formatterCache = {
      timeZone,
      formatter: new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
    };
  }
  return formatterCache.formatter;
}

export type OrgDateParts = {
  year: number;
  month: number; // 1-12
  monthIndex: number; // 0-11
  day: number; // 1-31
};

export function getOrgTimeZone() {
  return DEFAULT_ORG_TIME_ZONE;
}

export function getOrgDateParts(input: Date | string | number | null | undefined): OrgDateParts | null {
  if (input == null) return null;
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;

  const timeZone = getOrgTimeZone();
  const formatter = getFormatter(timeZone);
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  if (!year || !month || !day) return null;

  return {
    year,
    month,
    monthIndex: month - 1,
    day,
  };
}

export function orgDatePartsToDate(parts: OrgDateParts) {
  return new Date(Date.UTC(parts.year, parts.monthIndex, parts.day, 12));
}

export function orgDatePartsToIsoString(parts: OrgDateParts) {
  return orgDatePartsToDate(parts).toISOString();
}

export function formatOrgMonthDay(parts: Pick<OrgDateParts, "monthIndex" | "day">, locale?: string) {
  const dt = new Date(Date.UTC(2000, parts.monthIndex, parts.day, 12));
  return dt.toLocaleDateString(locale, { month: "short", day: "numeric" });
}
