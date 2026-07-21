import { NextResponse } from "next/server";

import { requireOrgChartDepartmentAccess } from "@/lib/org-chart-access";
import prismadb from "@/lib/prismadb";

export async function GET(
  _req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    const access = await requireOrgChartDepartmentAccess(params.departmentId);
    if (access.error) return access.error;

    const positions = await prismadb.plantillaPosition.findMany({
      where: {
        departmentId: params.departmentId,
        isActive: true,
        OR: [
          { employee: null },
          {
            employee: {
              is: {
                departmentId: params.departmentId,
                isArchived: true,
              },
            },
          },
        ],
      },
      select: {
        itemNumber: true,
        title: true,
        salaryGrade: true,
        office: { select: { name: true } },
        officeDivision: { select: { name: true } },
        employeeType: { select: { name: true } },
      },
      orderBy: [
        { office: { name: "asc" } },
        { itemNumber: "asc" },
        { title: "asc" },
      ],
    });

    return NextResponse.json({
      vacantPositions: positions.map((position) => ({
        officeName: position.office.name,
        itemNumber: position.itemNumber,
        title: position.title,
        salaryGrade: position.salaryGrade,
        divisionName: position.officeDivision?.name ?? null,
        employeeTypeName: position.employeeType?.name ?? null,
      })),
    });
  } catch (error) {
    console.error("[OFFICE_WORKFORCE_EXPORT_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
