
import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

export async function GET() {
  const positions = await prismadb.employee.findMany({
    distinct: ["position"], // 👈 Prisma distinct
    select: { position: true },
    orderBy: { position: "asc" }
  });

  return NextResponse.json(positions.map((p) => p.position));
}


