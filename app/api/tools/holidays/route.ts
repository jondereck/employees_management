import { NextResponse } from "next/server";

type NagerHoliday = {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  global?: boolean;
  types?: string[];
};

type HolidaysResponse = {
  holidays: Array<{
    date: string;
    localName: string;
    name: string;
    countryCode: string;
    global: boolean;
    types: string[];
  }>;
  source: "nager.date";
};

const YEAR_MIN = 1900;
const YEAR_MAX = 2100;

function parseYear(raw: string | null): number | null {
  if (!raw) return null;
  if (!/^\d{4}$/.test(raw)) return null;
  const year = Number(raw);
  if (!Number.isInteger(year)) return null;
  if (year < YEAR_MIN || year > YEAR_MAX) return null;
  return year;
}

function normalizeCountryCode(raw: string | null): string {
  const value = (raw ?? "PH").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(value) ? value : "PH";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const year = parseYear(searchParams.get("year"));
  if (!year) {
    return NextResponse.json(
      { error: "Invalid year. Use a 4-digit year, e.g. 2026." },
      { status: 400 }
    );
  }

  const country = normalizeCountryCode(searchParams.get("country"));
  const upstreamUrl = `https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`;

  try {
    const upstream = await fetch(upstreamUrl, {
      next: { revalidate: 86400 },
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return NextResponse.json(
        {
          error: "Upstream holiday service error.",
          upstreamStatus: upstream.status,
          upstreamBody: text ? text.slice(0, 500) : undefined,
        },
        { status: 502 }
      );
    }

    const data = (await upstream.json()) as unknown;
    if (!Array.isArray(data)) {
      return NextResponse.json(
        { error: "Unexpected upstream response shape." },
        { status: 502 }
      );
    }

    const holidays = (data as NagerHoliday[])
      .filter((holiday) => holiday && typeof holiday.date === "string")
      .map((holiday) => ({
        date: holiday.date,
        localName: String(holiday.localName ?? ""),
        name: String(holiday.name ?? ""),
        countryCode: String(holiday.countryCode ?? country),
        global: Boolean(holiday.global),
        types: Array.isArray(holiday.types)
          ? holiday.types.map((t) => String(t))
          : [],
      }));

    const response: HolidaysResponse = {
      holidays,
      source: "nager.date",
    };

    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to fetch holidays." },
      { status: 502 }
    );
  }
}
