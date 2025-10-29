import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { departmentId: string } }
) {
  const departmentId = params?.departmentId?.trim();
  if (!departmentId) {
    return NextResponse.json({ error: "Department ID is required" }, { status: 400 });
  }

  try {
    const types = await prisma.employee.findMany({
      where: { departmentId },
      select: { employeeType: { select: { name: true } } },
      distinct: ["employeeTypeId"],
      orderBy: { employeeType: { name: "asc" } },
    });

    const items = types
      .map((entry) => entry.employeeType?.name?.trim())
      .filter((value): value is string => Boolean(value));

    const unique = Array.from(new Set(items)).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ items: unique });
  } catch (error) {
    console.error("Failed to fetch employee types", error);
    return NextResponse.json({ error: "Failed to fetch employee types" }, { status: 500 });
  }
}
