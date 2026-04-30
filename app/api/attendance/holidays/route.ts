import { NextResponse } from "next/server";

import { HolidayApiError, fetchPhilippineHolidays } from "@/src/lib/holiday-api";

export const runtime = "nodejs";

const YEAR_PATTERN = /^\d{4}$/;
const MONTH_PATTERN = /^(?:[1-9]|1[0-2])$/;

const parseYear = (value: string | null): number | null => {
  if (!value || !YEAR_PATTERN.test(value)) return null;
  const year = Number(value);
  if (!Number.isInteger(year) || year < 1900 || year > 3000) return null;
  return year;
};

const parseMonth = (value: string | null): number | undefined => {
  if (value == null || value === "") return undefined;
  if (!MONTH_PATTERN.test(value)) return undefined;
  const month = Number(value);
  if (!Number.isInteger(month) || month < 1 || month > 12) return undefined;
  return month;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = parseYear(searchParams.get("year"));

  if (year == null) {
    return NextResponse.json({ error: "year is required" }, { status: 400 });
  }

  const month = parseMonth(searchParams.get("month"));

  try {
    const holidays = await fetchPhilippineHolidays(year, { month });
    return NextResponse.json({ holidays });
  } catch (error) {
    console.error("Failed to load holidays", error);
    if (error instanceof HolidayApiError) {
      return NextResponse.json(
        { error: error.message, holidays: [] as Array<{ name: string; date: string }> },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Unable to fetch holidays", holidays: [] as Array<{ name: string; date: string }> },
      { status: 502 }
    );
  }
}
