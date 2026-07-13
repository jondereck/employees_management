import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import {
  buildAgeGroups,
  buildEducationDistribution,
  buildOfficeDistribution,
  buildPersonnelComplement,
  buildRetirementForecast,
  type HrPlanningEmployee,
} from "@/lib/hr-planning";

async function requireDepartmentOwner(departmentId: string) {
  const { userId } = auth();
  if (!userId) return { error: new NextResponse("Unauthenticated", { status: 401 }) };

  const department = await prismadb.department.findFirst({
    where: { id: departmentId, userId },
    select: { id: true },
  });
  if (!department) return { error: new NextResponse("Unauthorized", { status: 403 }) };

  return { department };
}

export async function GET(_req: Request, { params }: { params: { departmentId: string } }) {
  try {
    const { departmentId } = params;
    const access = await requireDepartmentOwner(departmentId);
    if (access.error) return access.error;

    const employees = await prismadb.employee.findMany({
      where: { departmentId, isArchived: false },
      select: {
        gender: true,
        birthday: true,
        education: true,
        employeeType: { select: { name: true } },
        offices: { select: { id: true, name: true } },
      },
    });

    const rows: HrPlanningEmployee[] = employees.map((e) => ({
      gender: e.gender,
      birthday: e.birthday,
      education: e.education || "",
      employeeTypeName: e.employeeType?.name ?? "Unassigned",
      officeId: e.offices?.id ?? "",
      officeName: e.offices?.name ?? "Unassigned",
    }));

    const asOf = new Date();

    return NextResponse.json({
      generatedAt: asOf.toISOString(),
      totalActiveEmployees: rows.length,
      personnelComplement: buildPersonnelComplement(rows),
      officeDistribution: buildOfficeDistribution(rows),
      ageGroups: buildAgeGroups(rows, asOf),
      educationDistribution: buildEducationDistribution(rows),
      retirementForecast: buildRetirementForecast(rows, asOf),
    });
  } catch (error) {
    console.error("[HR_PLANNING_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
