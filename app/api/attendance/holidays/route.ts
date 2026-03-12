import { NextResponse } from "next/server";
import { z } from "zod";

import { fetchPhilippineHolidays } from "@/src/lib/holiday-api";

export const runtime = "nodejs";

const QuerySchema = z.object({
  year: z.coerce.number().int().min(1900).max(3000),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = QuerySchema.safeParse({
      year: searchParams.get("year"),
      month: searchParams.get("month"),
    });

    if (!parsed.success) {
      return NextResponse.json({ holidays: [] as Array<{ name: string; date: string }> }, { status: 400 });
    }

    const holidays = await fetchPhilippineHolidays(parsed.data.year);
    const monthPrefix = parsed.data.month
      ? `${parsed.data.year}-${String(parsed.data.month).padStart(2, "0")}`
      : null;

    const filtered = monthPrefix
      ? holidays.filter((holiday) => holiday.date.startsWith(monthPrefix))
      : holidays;

    return NextResponse.json({ holidays: filtered });
  } catch {
    return NextResponse.json({ holidays: [] as Array<{ name: string; date: string }> });
  }
}
