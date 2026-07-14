import { NextResponse } from "next/server";

import { requireOfficeInDepartment } from "@/lib/office-access";
import {
  normalizeOptionalId,
  normalizePlantillaInput,
  validateDivisionBelongsToOffice,
} from "@/lib/plantilla";
import prismadb from "@/lib/prismadb";

export async function GET(
  req: Request,
  { params }: { params: { departmentId: string; officeId: string } }
) {
  try {
    const access = await requireOfficeInDepartment(params.departmentId, params.officeId);
    if (access.error) return access.error;

    const url = new URL(req.url);
    const divisionId = normalizeOptionalId(url.searchParams.get("divisionId"));
    const vacantOnly = url.searchParams.get("vacantOnly") === "true";
    const activeOnly = url.searchParams.get("activeOnly") !== "false";
    const status = url.searchParams.get("status"); // vacant | filled | all

    const items = await prismadb.plantillaPosition.findMany({
      where: {
        departmentId: params.departmentId,
        officeId: params.officeId,
        ...(divisionId ? { officeDivisionId: divisionId } : {}),
        ...(activeOnly ? { isActive: true } : {}),
        ...(vacantOnly || status === "vacant"
          ? { employee: null }
          : status === "filled"
            ? { employee: { isNot: null } }
            : {}),
      },
      orderBy: [{ itemNumber: "asc" }, { title: "asc" }],
      include: {
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
    console.log("[OFFICE_PLANTILLA_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { departmentId: string; officeId: string } }
) {
  try {
    const access = await requireOfficeInDepartment(params.departmentId, params.officeId);
    if (access.error) return access.error;

    const body = await req.json();
    const normalized = normalizePlantillaInput(body);
    if (normalized.error || !normalized.value) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }

    const value = normalized.value;
    if (value.officeDivisionId) {
      const division = await prismadb.officeDivision.findFirst({
        where: {
          id: value.officeDivisionId,
          departmentId: params.departmentId,
          officeId: params.officeId,
        },
        select: { id: true, officeId: true },
      });
      const divisionError = validateDivisionBelongsToOffice({
        division,
        officeId: params.officeId,
      });
      if (divisionError) {
        return NextResponse.json({ error: divisionError }, { status: 400 });
      }
    }

    const duplicateItem = await prismadb.plantillaPosition.findFirst({
      where: {
        departmentId: params.departmentId,
        itemNumber: { equals: value.itemNumber, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (duplicateItem) {
      return NextResponse.json(
        { error: "Item number already exists in this department" },
        { status: 400 }
      );
    }

    const created = await prismadb.plantillaPosition.create({
      data: {
        departmentId: params.departmentId,
        officeId: params.officeId,
        officeDivisionId: value.officeDivisionId,
        itemNumber: value.itemNumber,
        title: value.title,
        salaryGrade: value.salaryGrade,
        salaryStep: value.salaryStep,
        isActive: value.isActive,
      },
      include: {
        officeDivision: { select: { id: true, name: true } },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNo: true,
          },
        },
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.log("[OFFICE_PLANTILLA_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
