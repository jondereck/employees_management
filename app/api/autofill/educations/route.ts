
import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

export async function GET() {
  const educations = await prismadb.employee.findMany({
    distinct: ["education"], // 👈 Prisma distinct
    select: { education: true },
    orderBy: { education: "asc" }
  });

  return NextResponse.json(educations.map((p) => p.education));
}
