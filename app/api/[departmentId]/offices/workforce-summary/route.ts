import { NextResponse } from "next/server";

import { aggregateOfficeWorkforce } from "@/lib/office-workforce";
import { requireOrgChartDepartmentAccess } from "@/lib/org-chart-access";
import prismadb from "@/lib/prismadb";

export async function GET(
  _req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    const access = await requireOrgChartDepartmentAccess(params.departmentId);
    if (access.error) return access.error;

    const [offices, plantillaPositions, employees] = await Promise.all([
      prismadb.offices.findMany({
        where: { departmentId: params.departmentId },
        select: { id: true, name: true },
      }),
      prismadb.plantillaPosition.findMany({
        where: { departmentId: params.departmentId },
        select: { id: true, officeId: true, isActive: true },
      }),
      prismadb.employee.findMany({
        where: {
          departmentId: params.departmentId,
          isArchived: false,
          plantillaPositionId: { not: null },
        },
        select: {
          id: true,
          officeId: true,
          plantillaPositionId: true,
          isArchived: true,
        },
      }),
    ]);

    const summary = aggregateOfficeWorkforce({
      offices,
      plantillaPositions,
      employees,
    });

    return NextResponse.json({
      overall: summary.totals,
      perOffice: summary.offices,
    });
  } catch (error) {
    console.error("[OFFICE_WORKFORCE_SUMMARY_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
