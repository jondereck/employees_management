import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";

type OrgChartAccess =
  | { departmentId: string; userId: string; error?: never }
  | { departmentId?: never; userId?: never; error: NextResponse };

export async function requireOrgChartDepartmentAccess(
  departmentId: string
): Promise<OrgChartAccess> {
  const { userId } = auth();
  if (!userId) {
    return { error: new NextResponse("Unauthenticated", { status: 401 }) };
  }

  const department = await prismadb.department.findFirst({
    where: { id: departmentId, userId },
    select: { id: true },
  });
  if (!department) {
    return { error: new NextResponse("Unauthorized", { status: 403 }) };
  }

  return { departmentId: department.id, userId };
}
