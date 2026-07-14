import { NextResponse } from "next/server";

import { requireOfficeInDepartment } from "@/lib/office-access";
import { normalizeDivisionInput } from "@/lib/plantilla";
import prismadb from "@/lib/prismadb";

export async function PATCH(
  req: Request,
  {
    params,
  }: { params: { departmentId: string; officeId: string; divisionId: string } }
) {
  try {
    const access = await requireOfficeInDepartment(params.departmentId, params.officeId);
    if (access.error) return access.error;

    if (!params.divisionId) {
      return new NextResponse("Division id is required", { status: 400 });
    }

    const existing = await prismadb.officeDivision.findFirst({
      where: {
        id: params.divisionId,
        officeId: params.officeId,
        departmentId: params.departmentId,
      },
    });
    if (!existing) {
      return new NextResponse("Division not found", { status: 404 });
    }

    const body = await req.json();
    const updates: { name?: string; sortOrder?: number } = {};

    if (body.name !== undefined) {
      const normalized = normalizeDivisionInput({ name: body.name, sortOrder: body.sortOrder });
      if (normalized.error || !normalized.value?.name) {
        return NextResponse.json({ error: normalized.error ?? "Division name is required" }, { status: 400 });
      }
      const duplicate = await prismadb.officeDivision.findFirst({
        where: {
          officeId: params.officeId,
          id: { not: params.divisionId },
          name: { equals: normalized.value.name, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "A division with this name already exists in this office" },
          { status: 400 }
        );
      }
      updates.name = normalized.value.name;
      if (body.sortOrder !== undefined) updates.sortOrder = normalized.value.sortOrder;
    } else if (body.sortOrder !== undefined) {
      const normalized = normalizeDivisionInput(
        { name: existing.name, sortOrder: body.sortOrder },
        { requireName: false }
      );
      if (normalized.error || !normalized.value) {
        return NextResponse.json({ error: normalized.error }, { status: 400 });
      }
      updates.sortOrder = normalized.value.sortOrder;
    }

    if (Object.keys(updates).length === 0) {
      return new NextResponse("No valid fields to update", { status: 400 });
    }

    const updated = await prismadb.officeDivision.update({
      where: { id: params.divisionId },
      data: updates,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.log("[OFFICE_DIVISION_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  {
    params,
  }: { params: { departmentId: string; officeId: string; divisionId: string } }
) {
  try {
    const access = await requireOfficeInDepartment(params.departmentId, params.officeId);
    if (access.error) return access.error;

    if (!params.divisionId) {
      return new NextResponse("Division id is required", { status: 400 });
    }

    const existing = await prismadb.officeDivision.findFirst({
      where: {
        id: params.divisionId,
        officeId: params.officeId,
        departmentId: params.departmentId,
      },
      include: {
        _count: {
          select: {
            plantillaPositions: true,
            employees: true,
          },
        },
      },
    });
    if (!existing) {
      return new NextResponse("Division not found", { status: 404 });
    }

    if (existing._count.plantillaPositions > 0 || existing._count.employees > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete division while plantilla items or employees are still linked to it",
        },
        { status: 400 }
      );
    }

    await prismadb.officeDivision.delete({ where: { id: params.divisionId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.log("[OFFICE_DIVISION_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
