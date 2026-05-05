import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { invalidateWorkforceReportCache } from "@/lib/workforce-history";

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

async function validateOfficeIds(departmentId: string, officeIds: unknown) {
  const ids = Array.isArray(officeIds)
    ? Array.from(new Set(officeIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0).map((id) => id.trim())))
    : [];

  if (ids.length === 0) return ids;

  const count = await prismadb.offices.count({
    where: { departmentId, id: { in: ids } },
  });
  if (count !== ids.length) {
    throw new Error("One or more offices do not belong to this department.");
  }

  return ids;
}

export async function PATCH(
  req: Request,
  { params }: { params: { departmentId: string; groupId: string } }
) {
  try {
    const access = await requireDepartmentOwner(params.departmentId);
    if (access.error) return access.error;

    const existing = await prismadb.workforceReportGroup.findFirst({
      where: { id: params.groupId, departmentId: params.departmentId },
      select: { id: true },
    });
    if (!existing) return new NextResponse("Group not found", { status: 404 });

    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return new NextResponse("Group name is required", { status: 400 });

    const sortOrder = Number.isFinite(Number(body?.sortOrder)) ? Math.trunc(Number(body.sortOrder)) : 0;
    const officeIds = await validateOfficeIds(params.departmentId, body?.officeIds);

    const group = await prismadb.$transaction(async (tx) => {
      await tx.workforceReportGroupOffice.deleteMany({ where: { groupId: params.groupId } });
      return tx.workforceReportGroup.update({
        where: { id: params.groupId },
        data: {
          name,
          sortOrder,
          offices: {
            createMany: {
              data: officeIds.map((officeId) => ({ officeId })),
              skipDuplicates: true,
            },
          },
        },
        include: {
          offices: { include: { office: { select: { id: true, name: true } } } },
        },
      });
    });

    await invalidateWorkforceReportCache(params.departmentId);

    return NextResponse.json({
      id: group.id,
      name: group.name,
      sortOrder: group.sortOrder,
      offices: group.offices.map((entry) => entry.office),
    });
  } catch (error) {
    console.error("[WORKFORCE_HISTORY_GROUP_PATCH]", error);
    const message = error instanceof Error ? error.message : "Internal error";
    return new NextResponse(message, { status: message.includes("belong") ? 400 : 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { departmentId: string; groupId: string } }
) {
  try {
    const access = await requireDepartmentOwner(params.departmentId);
    if (access.error) return access.error;

    const existing = await prismadb.workforceReportGroup.findFirst({
      where: { id: params.groupId, departmentId: params.departmentId },
      select: { id: true },
    });
    if (!existing) return new NextResponse("Group not found", { status: 404 });

    await prismadb.workforceReportGroup.delete({ where: { id: params.groupId } });
    await invalidateWorkforceReportCache(params.departmentId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[WORKFORCE_HISTORY_GROUP_DELETE]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
