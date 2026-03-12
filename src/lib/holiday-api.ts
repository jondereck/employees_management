export type Holiday = {
  name: string;
  date: string;
};

type HolidayApiHoliday = {
  name?: unknown;
  date?: unknown;
};

type HolidayApiResponse = {
  holidays?: unknown;
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isHoliday = (value: HolidayApiHoliday): value is Holiday =>
  typeof value.name === "string" &&
  value.name.trim().length > 0 &&
  typeof value.date === "string" &&
  ISO_DATE_PATTERN.test(value.date);

export async function fetchPhilippineHolidays(year: number): Promise<Holiday[]> {
  const key = process.env.HOLIDAY_API_KEY;

  if (!key) {
    throw new Error("HOLIDAY_API_KEY missing");
  }

  const url = new URL("https://holidayapi.com/v1/holidays");

  url.searchParams.set("country", "PH");
  url.searchParams.set("year", year.toString());
  url.searchParams.set("public", "true");
  url.searchParams.set("key", key);

  const res = await fetch(url.toString());

  if (!res.ok) {
    throw new Error("Holiday API request failed");
  }

  const data: HolidayApiResponse = await res.json();
  if (!Array.isArray(data.holidays)) {
    return [];
  }

  return data.holidays
    .filter((item): item is HolidayApiHoliday => typeof item === "object" && item !== null)
    .filter(isHoliday)
    .map((holiday) => ({
      name: holiday.name.trim(),
      date: holiday.date,
    }));
}
