import { NextResponse } from "next/server";

type NagerHoliday = {
  date: string;
  localName?: string;
  name?: string;
  countryCode?: string;
  global?: boolean;
  types?: string[];
};

const parseYear = (value: string | null) => {
  if (!value || !/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  return Number.isInteger(year) && year >= 1900 && year <= 2100 ? year : null;
};

const parseMonth = (value: string | null) => {
  if (!value || !/^\d{1,2}$/.test(value)) return null;
  const month = Number(value);
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : null;
};

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = parseYear(searchParams.get("year"));
  const month = parseMonth(searchParams.get("month"));
  const country = (searchParams.get("country") ?? "PH").trim().toUpperCase();

  if (!year || !month) {
    return NextResponse.json(
      { error: "Valid year and month are required." },
      { status: 400 }
    );
  }
  if (!/^[A-Z]{2}$/.test(country)) {
    return NextResponse.json({ error: "Invalid country code." }, { status: 400 });
  }

  try {
    const upstream = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`,
      { next: { revalidate: 86400 } }
    );

    if (!upstream.ok) {
      return NextResponse.json(
        { error: "Unable to load holidays from upstream service." },
        { status: 502 }
      );
    }

    const data = (await upstream.json()) as unknown;
    if (!Array.isArray(data)) {
      return NextResponse.json(
        { error: "Unexpected holiday service response." },
        { status: 502 }
      );
    }

    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    const holidays = (data as NagerHoliday[])
      .filter((holiday) => typeof holiday?.date === "string" && holiday.date.startsWith(prefix))
      .map((holiday) => ({
        date: holiday.date,
        name: String(holiday.name || holiday.localName || "Holiday"),
        localName: String(holiday.localName || holiday.name || "Holiday"),
        countryCode: String(holiday.countryCode || country),
        global: Boolean(holiday.global),
        types: Array.isArray(holiday.types) ? holiday.types.map(String) : [],
      }));

    return NextResponse.json({ holidays, source: "nager.date" });
  } catch (error) {
    console.error("Failed to load holidays", error);
    const message = error instanceof Error ? error.message : "Unable to load holidays.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
