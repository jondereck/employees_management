import { NextResponse } from "next/server";

import { requireOfficeInDepartment } from "@/lib/office-access";
import {
  buildEmployeePlantillaLinkUpdate,
  buildPlantillaCandidateDepartmentScope,
} from "@/lib/plantilla";
import prismadb from "@/lib/prismadb";
import { publishWorkforceChanged } from "@/lib/workforce-realtime";

const plantillaInclude = {
  officeDivision: { select: { id: true, name: true } },
  employeeType: { select: { id: true, name: true } },
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      middleName: true,
      employeeNo: true,
    },
  },
} as const;

async function loadPlantilla(
  departmentId: string,
  officeId: string,
  plantillaId: string
) {
  return prismadb.plantillaPosition.findFirst({
    where: { id: plantillaId, officeId, departmentId },
    select: {
      id: true,
      officeId: true,
      itemNumber: true,
      title: true,
      salaryGrade: true,
      employeeTypeId: true,
      officeDivisionId: true,
      employee: { select: { id: true } },
    },
  });
}

/** POST { employeeId } — manually link an unassigned employee to this plantilla item. */
export async function POST(
  req: Request,
  {
    params,
  }: { params: { departmentId: string; officeId: string; plantillaId: string } }
) {
  try {
    const access = await requireOfficeInDepartment(
      params.departmentId,
      params.officeId
    );
    if (access.error) return access.error;

    const plantilla = await loadPlantilla(
      params.departmentId,
      params.officeId,
      params.plantillaId
    );
    if (!plantilla) {
      return new NextResponse("Plantilla position not found", { status: 404 });
    }

    if (plantilla.employee) {
      return NextResponse.json(
        { error: "This plantilla item already has an occupant. Unlink first." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => null);
    const employeeId =
      typeof body?.employeeId === "string" ? body.employeeId.trim() : "";
    if (!employeeId) {
      return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
    }

    const employee = await prismadb.employee.findFirst({
      where: {
        id: employeeId,
        ...buildPlantillaCandidateDepartmentScope(params.departmentId),
      },
      select: {
        id: true,
        officeId: true,
        employeeNo: true,
        plantillaPositionId: true,
      },
    });
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    if (employee.plantillaPositionId) {
      return NextResponse.json(
        { error: "Employee is already linked to another plantilla item" },
        { status: 400 }
      );
    }

    const data = buildEmployeePlantillaLinkUpdate(plantilla, employee);
    await prismadb.employee.update({
      where: { id: employee.id },
      data,
    });

    const updated = await prismadb.plantillaPosition.findUnique({
      where: { id: plantilla.id },
      include: plantillaInclude,
    });

    await publishWorkforceChanged(params.departmentId, {
      scope: "plantilla",
      action: "linked",
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.log("[OFFICE_PLANTILLA_LINK_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

/** DELETE — unlink the current occupant from this plantilla item. */
export async function DELETE(
  _req: Request,
  {
    params,
  }: { params: { departmentId: string; officeId: string; plantillaId: string } }
) {
  try {
    const access = await requireOfficeInDepartment(
      params.departmentId,
      params.officeId
    );
    if (access.error) return access.error;

    const plantilla = await loadPlantilla(
      params.departmentId,
      params.officeId,
      params.plantillaId
    );
    if (!plantilla) {
      return new NextResponse("Plantilla position not found", { status: 404 });
    }

    if (!plantilla.employee) {
      return NextResponse.json({ error: "No occupant to unlink" }, { status: 400 });
    }

    await prismadb.employee.update({
      where: { id: plantilla.employee.id },
      data: { plantillaPositionId: null },
    });

    const updated = await prismadb.plantillaPosition.findUnique({
      where: { id: plantilla.id },
      include: plantillaInclude,
    });

    await publishWorkforceChanged(params.departmentId, {
      scope: "plantilla",
      action: "unlinked",
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.log("[OFFICE_PLANTILLA_LINK_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
