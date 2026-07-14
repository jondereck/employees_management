import { NextResponse } from "next/server";

import { requireOfficeInDepartment } from "@/lib/office-access";
import {
  normalizePlantillaInput,
  validateDivisionBelongsToOffice,
} from "@/lib/plantilla";
import prismadb from "@/lib/prismadb";

export async function PATCH(
  req: Request,
  {
    params,
  }: { params: { departmentId: string; officeId: string; plantillaId: string } }
) {
  try {
    const access = await requireOfficeInDepartment(params.departmentId, params.officeId);
    if (access.error) return access.error;

    if (!params.plantillaId) {
      return new NextResponse("Plantilla id is required", { status: 400 });
    }

    const existing = await prismadb.plantillaPosition.findFirst({
      where: {
        id: params.plantillaId,
        officeId: params.officeId,
        departmentId: params.departmentId,
      },
      include: {
        employee: { select: { id: true } },
      },
    });
    if (!existing) {
      return new NextResponse("Plantilla position not found", { status: 404 });
    }

    const body = await req.json();
    const normalized = normalizePlantillaInput(body, { partial: true });
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

    if (value.itemNumber) {
      const duplicateItem = await prismadb.plantillaPosition.findFirst({
        where: {
          departmentId: params.departmentId,
          id: { not: params.plantillaId },
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
    }

    // Moving division while occupied by an employee with mismatched division is blocked client-side;
    // also clear employee.officeDivisionId inconsistency is avoided by requiring match on assign.
    const updated = await prismadb.plantillaPosition.update({
      where: { id: params.plantillaId },
      data: {
        ...(value.itemNumber !== undefined ? { itemNumber: value.itemNumber } : {}),
        ...(value.title !== undefined ? { title: value.title } : {}),
        ...(value.salaryGrade !== undefined ? { salaryGrade: value.salaryGrade } : {}),
        ...(value.salaryStep !== undefined ? { salaryStep: value.salaryStep } : {}),
        ...(value.officeDivisionId !== undefined
          ? { officeDivisionId: value.officeDivisionId }
          : {}),
        ...(value.isActive !== undefined ? { isActive: value.isActive } : {}),
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

    return NextResponse.json(updated);
  } catch (error) {
    console.log("[OFFICE_PLANTILLA_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  {
    params,
  }: { params: { departmentId: string; officeId: string; plantillaId: string } }
) {
  try {
    const access = await requireOfficeInDepartment(params.departmentId, params.officeId);
    if (access.error) return access.error;

    if (!params.plantillaId) {
      return new NextResponse("Plantilla id is required", { status: 400 });
    }

    const existing = await prismadb.plantillaPosition.findFirst({
      where: {
        id: params.plantillaId,
        officeId: params.officeId,
        departmentId: params.departmentId,
      },
      include: {
        employee: { select: { id: true } },
      },
    });
    if (!existing) {
      return new NextResponse("Plantilla position not found", { status: 404 });
    }

    if (existing.employee) {
      return NextResponse.json(
        { error: "Cannot delete a plantilla item that is currently occupied" },
        { status: 400 }
      );
    }

    await prismadb.plantillaPosition.delete({ where: { id: params.plantillaId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.log("[OFFICE_PLANTILLA_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
