import { NextResponse } from "next/server";

import { requireOfficeInDepartment } from "@/lib/office-access";
import { normalizeDivisionInput } from "@/lib/plantilla";
import prismadb from "@/lib/prismadb";

export async function GET(
  _req: Request,
  { params }: { params: { departmentId: string; officeId: string } }
) {
  try {
    const access = await requireOfficeInDepartment(params.departmentId, params.officeId);
    if (access.error) return access.error;

    const divisions = await prismadb.officeDivision.findMany({
      where: {
        departmentId: params.departmentId,
        officeId: params.officeId,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: {
          select: {
            plantillaPositions: true,
            employees: true,
          },
        },
      },
    });

    return NextResponse.json(divisions);
  } catch (error) {
    console.log("[OFFICE_DIVISIONS_GET]", error);
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
    const normalized = normalizeDivisionInput(body);
    if (normalized.error || !normalized.value) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }

    const existing = await prismadb.officeDivision.findFirst({
      where: {
        officeId: params.officeId,
        name: { equals: normalized.value.name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A division with this name already exists in this office" },
        { status: 400 }
      );
    }

    const created = await prismadb.officeDivision.create({
      data: {
        departmentId: params.departmentId,
        officeId: params.officeId,
        name: normalized.value.name,
        sortOrder: normalized.value.sortOrder,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.log("[OFFICE_DIVISIONS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
