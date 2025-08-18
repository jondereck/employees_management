
import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

export async function GET() {
  const streets = await prismadb.employee.findMany({
    distinct: ["street"], // 👈 Prisma distinct
    select: { street: true },
    orderBy: { street: "asc" }
  });

  return NextResponse.json(streets.map((p) => p.street));
}
