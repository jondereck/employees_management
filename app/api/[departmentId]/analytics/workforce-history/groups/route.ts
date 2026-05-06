import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { ensureDefaultWorkforceIndicators } from "@/lib/workforce-history";

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

export async function GET(
  _req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    const access = await requireDepartmentOwner(params.departmentId);
    if (access.error) return access.error;
    await ensureDefaultWorkforceIndicators(params.departmentId);

    const groups = await prismadb.workforceReportGroup.findMany({
      where: { departmentId: params.departmentId },
      include: {
        offices: {
          include: {
            office: { select: { id: true, name: true } },
          },
          orderBy: { office: { name: "asc" } },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json(
      groups.map((group) => ({
        id: group.id,
        name: group.name,
        sortOrder: group.sortOrder,
        offices: group.offices.map((entry) => entry.office),
      }))
    );
  } catch (error) {
    console.error("[WORKFORCE_HISTORY_GROUPS_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function POST(
  _req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    const access = await requireDepartmentOwner(params.departmentId);
    if (access.error) return access.error;
    return new NextResponse("Indicators are system-managed and cannot be created manually.", { status: 405 });
  } catch (error) {
    console.error("[WORKFORCE_HISTORY_GROUPS_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
