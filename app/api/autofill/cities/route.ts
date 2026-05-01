
import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const cities = await prismadb.employee.findMany({
    distinct: ["city"], // 👈 Prisma distinct
    select: { city: true },
    orderBy: { city: "asc" }
  });

  return NextResponse.json(cities.map((p) => p.city));
}
