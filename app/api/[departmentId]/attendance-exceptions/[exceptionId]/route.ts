import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import prismadb from "@/lib/prismadb";

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

const patchSchema = z.object({
  actionTaken: z.string().optional(),
  status: z
    .enum(["Open", "CounselingConducted", "MemorandumIssued", "Resolved", "ForAdministrativeAction"])
    .optional(),
  remarks: z.string().optional(),
  occurrences: z.number().int().positive().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { departmentId: string; exceptionId: string } }
) {
  try {
    const access = await requireDepartmentOwner(params.departmentId);
    if (access.error) return access.error;

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await prismadb.attendanceException.findFirst({
      where: { id: params.exceptionId, departmentId: params.departmentId },
    });
    if (!existing) return new NextResponse("Not found", { status: 404 });

    const row = await prismadb.attendanceException.update({
      where: { id: existing.id },
      data: parsed.data,
    });

    return NextResponse.json({
      row: {
        ...row,
        incidentDate: row.incidentDate.toISOString().slice(0, 10),
        incidentDates: row.incidentDates,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[ATTENDANCE_EXCEPTION_PATCH]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { departmentId: string; exceptionId: string } }
) {
  try {
    const access = await requireDepartmentOwner(params.departmentId);
    if (access.error) return access.error;

    const existing = await prismadb.attendanceException.findFirst({
      where: { id: params.exceptionId, departmentId: params.departmentId },
    });
    if (!existing) return new NextResponse("Not found", { status: 404 });

    await prismadb.attendanceException.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[ATTENDANCE_EXCEPTION_DELETE]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
