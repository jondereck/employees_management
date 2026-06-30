import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import {
  buildWorkforceCscDrilldown,
  WORKFORCE_CSC_Q38_ROWS,
  WORKFORCE_CSC_Q39_ROWS,
  type WorkforceCscSection,
  type WorkforceCscSexFilter,
} from "@/lib/workforce-csc";

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

function isValidSection(value: unknown): value is WorkforceCscSection {
  return value === "q39" || value === "q38";
}

function isValidSex(value: unknown): value is WorkforceCscSexFilter {
  return value === "male" || value === "female" || value === "total";
}

function isValidRowKey(section: WorkforceCscSection, rowKey: string) {
  const rows = section === "q39" ? WORKFORCE_CSC_Q39_ROWS : WORKFORCE_CSC_Q38_ROWS;
  return rows.some((row) => row.key === rowKey);
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
    if (!body || typeof body !== "object") {
      return new NextResponse("Invalid payload", { status: 400 });
    }

    const section = body.section;
    const rowKey = typeof body.rowKey === "string" ? body.rowKey : "";
    const sex = body.sex;
    const searchText = typeof body.searchText === "string" ? body.searchText : "";

    if (!isValidSection(section)) {
      return new NextResponse("Invalid section", { status: 400 });
    }

    if (!isValidSex(sex)) {
      return new NextResponse("Invalid sex filter", { status: 400 });
    }

    if (!isValidRowKey(section, rowKey)) {
      return new NextResponse("Invalid row key", { status: 400 });
    }

    const employeeTypeIds = normalizeIdArray(body.employeeTypeIds);
    const eligibilityIds = normalizeIdArray(body.eligibilityIds);

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

    return NextResponse.json(
      buildWorkforceCscDrilldown(employees, {
        section,
        rowKey,
        sex,
        searchText,
      })
    );
  } catch (error) {
    console.error("[WORKFORCE_PIVOT_CSC_DRILLDOWN_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
