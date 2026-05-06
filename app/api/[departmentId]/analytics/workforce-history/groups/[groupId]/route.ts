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

export async function PATCH(
  _req: Request,
  { params }: { params: { departmentId: string; groupId: string } }
) {
  try {
    const access = await requireDepartmentOwner(params.departmentId);
    if (access.error) return access.error;
    return new NextResponse("Indicators are system-managed and cannot be updated manually.", { status: 405 });
  } catch (error) {
    console.error("[WORKFORCE_HISTORY_GROUP_PATCH]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { departmentId: string; groupId: string } }
) {
  try {
    const access = await requireDepartmentOwner(params.departmentId);
    if (access.error) return access.error;
    return new NextResponse("Indicators are system-managed and cannot be deleted manually.", { status: 405 });
  } catch (error) {
    console.error("[WORKFORCE_HISTORY_GROUP_DELETE]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
