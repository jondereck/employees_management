
import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

export async function GET() {
  const provinces = await prismadb.employee.findMany({
    distinct: ["province"], // 👈 Prisma distinct
    select: { province: true },
    orderBy: { province: "asc" }
  });

  return NextResponse.json(provinces.map((p) => p.province));
}
