import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import {
  buildWorkforcePivot,
  resolvePivotAxes,
  type PivotEmployeeInput,
} from "@/lib/workforce-pivot";

const normalizeIdArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry === "string" && entry.trim()) seen.add(entry.trim());
  }
  return Array.from(seen);
};

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

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new NextResponse("Invalid payload", { status: 400 });
    }

    const axes = resolvePivotAxes(body);
    if ("error" in axes) {
      return new NextResponse(axes.error, { status: 400 });
    }

    const employeeTypeIds = normalizeIdArray(body.employeeTypeIds);
    const eligibilityIds = normalizeIdArray(body.eligibilityIds);
    const officeIds = normalizeIdArray(body.officeIds);

    const employees = await prismadb.employee.findMany({
      where: {
        departmentId,
        isArchived: false,
        ...(employeeTypeIds.length ? { employeeTypeId: { in: employeeTypeIds } } : {}),
        ...(eligibilityIds.length ? { eligibilityId: { in: eligibilityIds } } : {}),
        ...(officeIds.length ? { officeId: { in: officeIds } } : {}),
      },
      select: {
        id: true,
        gender: true,
        salaryGrade: true,
        officeId: true,
        employeeTypeId: true,
        eligibilityId: true,
        offices: { select: { name: true } },
        employeeType: { select: { name: true } },
        eligibility: { select: { name: true } },
      },
    });

    const inputs: PivotEmployeeInput[] = employees.map((employee) => ({
      id: employee.id,
      gender: employee.gender,
      salaryGrade: employee.salaryGrade,
      officeId: employee.officeId,
      officeName: employee.offices?.name ?? null,
      employeeTypeId: employee.employeeTypeId,
      employeeTypeName: employee.employeeType?.name ?? null,
      eligibilityId: employee.eligibilityId,
      eligibilityName: employee.eligibility?.name ?? null,
    }));

    const result = buildWorkforcePivot({
      employees: inputs,
      rowFields: axes.rowFields,
      colField: axes.colField,
    });

    return NextResponse.json({
      ...result,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[WORKFORCE_PIVOT_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
