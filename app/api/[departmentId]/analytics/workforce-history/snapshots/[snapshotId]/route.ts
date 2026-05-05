import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";

async function requireDepartmentOwner(departmentId: string) {
  const { userId } = auth();
  if (!userId) return { error: new NextResponse("Unauthenticated", { status: 401 }) };

  const department = await prismadb.department.findFirst({
    where: { id: departmentId, userId },
    select: { id: true },
  });
  if (!department) return { error: new NextResponse("Unauthorized", { status: 403 }) };

  return { userId };
}

export async function DELETE(
  _req: Request,
  { params }: { params: { departmentId: string; snapshotId: string } }
) {
  try {
    const access = await requireDepartmentOwner(params.departmentId);
    if (access.error) return access.error;

    const snapshot = await prismadb.employeeHistorySnapshot.findFirst({
      where: { id: params.snapshotId, departmentId: params.departmentId },
      select: { id: true, source: true },
    });
    if (!snapshot) return new NextResponse("Snapshot not found", { status: 404 });

    await prismadb.employeeHistorySnapshot.delete({ where: { id: params.snapshotId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[WORKFORCE_HISTORY_SNAPSHOT_DELETE]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
