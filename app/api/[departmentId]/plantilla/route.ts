import { NextResponse } from "next/server";

import { requireOrgChartDepartmentAccess } from "@/lib/org-chart-access";
import { normalizeOptionalId } from "@/lib/plantilla";
import prismadb from "@/lib/prismadb";

/**
 * Department-wide plantilla list for employee forms.
 * Plantilla items may belong to a different office than the employee's assignment.
 */
export async function GET(
  req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    const access = await requireOrgChartDepartmentAccess(params.departmentId);
    if (access.error) return access.error;

    const url = new URL(req.url);
    const officeId = normalizeOptionalId(url.searchParams.get("officeId"));
    const divisionId = normalizeOptionalId(url.searchParams.get("divisionId"));
    const vacantOnly = url.searchParams.get("vacantOnly") === "true";
    const activeOnly = url.searchParams.get("activeOnly") !== "false";
    const status = url.searchParams.get("status");

    const items = await prismadb.plantillaPosition.findMany({
      where: {
        departmentId: params.departmentId,
        ...(officeId ? { officeId } : {}),
        ...(divisionId ? { officeDivisionId: divisionId } : {}),
        ...(activeOnly ? { isActive: true } : {}),
        ...(vacantOnly || status === "vacant"
          ? { employee: null }
          : status === "filled"
            ? { employee: { isNot: null } }
            : {}),
      },
      orderBy: [
        { office: { name: "asc" } },
        { itemNumber: "asc" },
        { title: "asc" },
      ],
      include: {
        office: { select: { id: true, name: true } },
        officeDivision: { select: { id: true, name: true } },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
            employeeNo: true,
          },
        },
      },
    });

    return NextResponse.json(items);
  } catch (error) {
    console.log("[DEPARTMENT_PLANTILLA_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
