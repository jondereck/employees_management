
import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

export async function GET() {
  const barangays = await prismadb.employee.findMany({
    distinct: ["barangay"], // 👈 Prisma distinct
    select: { barangay: true },
    orderBy: { barangay: "asc" }
  });

  return NextResponse.json(barangays.map((p) => p.barangay));
}
