import prismadb from "@/lib/prismadb";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Reference salary = step 1 per grade
    const rows = await prismadb.salary.findMany({
      where: { step: 1 },
      select: { grade: true, amount: true },
      orderBy: { grade: "asc" },
    });
    const map: Record<number, number> = {};
    for (const r of rows) map[r.grade] = r.amount;
    return NextResponse.json(map);
  } catch (error) {
    return new NextResponse(
      error instanceof Error ? error.message : "Failed to load salary grades",
      { status: 500 }
    );
  }
}

