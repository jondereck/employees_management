export type Holiday = {
  name: string;
  date: string;
};

type HolidayApiHoliday = {
  name?: unknown;
  date?: unknown;
  observed?: unknown;
  public?: unknown;
};

type HolidayApiResponse = {
  status?: unknown;
  error?: unknown;
  warning?: unknown;
  holidays?: unknown;
};

export class HolidayApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HolidayApiError";
    this.status = status;
  }
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isHoliday = (value: HolidayApiHoliday): value is Holiday =>
  typeof value.name === "string" &&
  value.name.trim().length > 0 &&
  typeof value.date === "string" &&
  ISO_DATE_PATTERN.test(value.date);

const toHolidayList = (input: unknown): HolidayApiHoliday[] => {
  if (Array.isArray(input)) {
    return input.filter(
      (value): value is HolidayApiHoliday =>
        typeof value === "object" && value !== null
    );
  }

  if (typeof input === "object" && input !== null) {
    return Object.values(input)
      .filter((value) => Array.isArray(value))
      .flatMap((value) =>
        value.filter(
          (entry): entry is HolidayApiHoliday =>
            typeof entry === "object" && entry !== null
        )
      );
  }

  return [];
};

export async function fetchPhilippineHolidays(
  year: number,
  options?: { month?: number }
): Promise<Holiday[]> {
  const key = process.env.HOLIDAY_API_KEY;

  if (!key) {
    throw new Error("HOLIDAY_API_KEY missing");
  }

  const url = new URL("https://holidayapi.com/v1/holidays");

  url.searchParams.set("country", "PH");
  url.searchParams.set("year", year.toString());
  url.searchParams.set("public", "true");
  url.searchParams.set("key", key);

  if (
    typeof options?.month === "number" &&
    Number.isInteger(options.month) &&
    options.month >= 1 &&
    options.month <= 12
  ) {
    url.searchParams.set("month", options.month.toString());
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as HolidayApiResponse;

  if (!res.ok) {
    const message =
      typeof data.error === "string" && data.error.trim().length
        ? data.error.trim()
        : "Holiday API request failed";
    throw new HolidayApiError(message, res.status);
  }

  return toHolidayList(data.holidays)
    .filter(isHoliday)
    .map((holiday) => ({
      name: holiday.name.trim(),
      date: holiday.date,
    }));
}
