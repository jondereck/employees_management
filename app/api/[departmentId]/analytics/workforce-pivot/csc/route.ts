import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { buildWorkforceCscSummary } from "@/lib/workforce-csc";

function normalizeIdArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry === "string" && entry.trim()) {
      seen.add(entry.trim());
    }
  }
  return Array.from(seen);
}

export async function POST(req: Request, { params }: { params: { departmentId: string } }) {
  try {
    const { departmentId } = params;
    const { userId } = auth();

    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 401 });
    }

    if (!departmentId) {
      return new NextResponse("Department Id is required", { status: 400 });
    }

    const department = await prismadb.department.findFirst({
      where: { id: departmentId, userId },
      select: { id: true },
    });

    if (!department) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const employeeTypeIds = normalizeIdArray(body?.employeeTypeIds);
    const eligibilityIds = normalizeIdArray(body?.eligibilityIds);

    const employees = await prismadb.employee.findMany({
      where: {
        departmentId,
        isArchived: false,
        ...(employeeTypeIds.length ? { employeeTypeId: { in: employeeTypeIds } } : {}),
        ...(eligibilityIds.length ? { eligibilityId: { in: eligibilityIds } } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        suffix: true,
        gender: true,
        position: true,
        salaryGrade: true,
        dateHired: true,
        latestAppointment: true,
        terminateDate: true,
        isArchived: true,
        offices: { select: { id: true, name: true } },
        employeeType: { select: { id: true, name: true } },
        eligibility: { select: { id: true, name: true } },
        employmentEvents: {
          select: {
            type: true,
            occurredAt: true,
            deletedAt: true,
          },
        },
      },
    });

    return NextResponse.json(buildWorkforceCscSummary(employees));
  } catch (error) {
    console.error("[WORKFORCE_PIVOT_CSC_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
