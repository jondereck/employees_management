import { NextResponse } from "next/server";

import { requireOfficeInDepartment } from "@/lib/office-access";
import {
  buildWorkforceDetailsRelationScopes,
  classifyWorkforceDetailsView,
  mapEmployeeWorkforceDetail,
  mapWorkforceOffice,
  mapVacantWorkforceDetail,
  parseWorkforceDetailsView,
} from "@/lib/office-workforce";
import prismadb from "@/lib/prismadb";

export async function GET(
  req: Request,
  { params }: { params: { departmentId: string; officeId: string } }
) {
  try {
    const access = await requireOfficeInDepartment(
      params.departmentId,
      params.officeId
    );
    if (access.error) return access.error;

    const rawView = new URL(req.url).searchParams.get("view");
    const view = parseWorkforceDetailsView(rawView);
    if (!view) {
      return NextResponse.json(
        {
          error:
            "Invalid view. Expected vacant, assigned-here-plantilla-elsewhere, or plantilla-here-assigned-elsewhere",
        },
        { status: 400 }
      );
    }

    if (view === "vacant") {
      const relationScopes = buildWorkforceDetailsRelationScopes(
        view,
        params.departmentId,
        params.officeId
      );
      const positions = await prismadb.plantillaPosition.findMany({
        where: {
          departmentId: params.departmentId,
          officeId: params.officeId,
          isActive: true,
          OR: [
            { employee: null },
            { employee: { is: relationScopes.archivedOccupant } },
          ],
        },
        select: {
          id: true,
          title: true,
          itemNumber: true,
          salaryGrade: true,
          officeDivision: { select: { id: true, name: true } },
          employeeType: { select: { id: true, name: true } },
        },
        orderBy: [{ itemNumber: "asc" }, { title: "asc" }],
      });

      return NextResponse.json({
        view,
        office: mapWorkforceOffice(access.office),
        items: positions.map(mapVacantWorkforceDetail),
      });
    }

    const queryKind = classifyWorkforceDetailsView(view);
    const relationScopes = buildWorkforceDetailsRelationScopes(
      view,
      params.departmentId,
      params.officeId
    );
    const employees = await prismadb.employee.findMany({
      where: {
        departmentId: params.departmentId,
        isArchived: false,
        officeId:
          queryKind === "employee-assignment"
            ? params.officeId
            : { not: params.officeId },
        plantillaPosition: {
          is: relationScopes.plantillaPosition,
        },
      },
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        suffix: true,
        position: true,
        offices: { select: { id: true, name: true } },
        plantillaPosition: {
          select: { office: { select: { id: true, name: true } } },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    return NextResponse.json({
      view,
      office: mapWorkforceOffice(access.office),
      items: employees.map(mapEmployeeWorkforceDetail),
    });
  } catch (error) {
    console.error("[OFFICE_WORKFORCE_DETAILS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
