import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { requireOrgChartDepartmentAccess } from "@/lib/org-chart-access";

type OfficeAccess =
  | { office: { id: string; departmentId: string; name: string }; error?: never }
  | { office?: never; error: NextResponse };

export async function requireOfficeInDepartment(
  departmentId: string,
  officeId: string
): Promise<OfficeAccess> {
  const access = await requireOrgChartDepartmentAccess(departmentId);
  if (access.error) return { error: access.error };

  if (!officeId) {
    return { error: new NextResponse("Office id is required", { status: 400 }) };
  }

  const office = await prismadb.offices.findFirst({
    where: { id: officeId, departmentId },
    select: { id: true, departmentId: true, name: true },
  });

  if (!office) {
    return { error: new NextResponse("Office not found", { status: 404 }) };
  }

  return { office };
}
