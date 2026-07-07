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

  return { department };
}

export async function GET(req: Request, { params }: { params: { departmentId: string } }) {
  try {
    const { departmentId } = params;
    const access = await requireDepartmentOwner(departmentId);
    if (access.error) return access.error;

    const { searchParams } = new URL(req.url);
    const officeId = searchParams.get("officeId") || undefined;
    const indicator = searchParams.get("indicator") || undefined;
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const excludeEmployeeTypeIds = (searchParams.get("excludeEmployeeTypeIds") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const trainings = await prismadb.training.findMany({
      where: {
        AND: [
          { departmentId },
          ...(indicator ? [{ indicator }] : []),
          ...(officeId ? [{ employee: { officeId } }] : []),
          ...(dateFrom || dateTo
            ? [
                {
                  dateStart: {
                    ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                    ...(dateTo ? { lte: new Date(dateTo) } : {}),
                  },
                },
              ]
            : []),
          // Unmatched rows (no employee) have no type to check, so keep them visible.
          ...(excludeEmployeeTypeIds.length
            ? [{ OR: [{ employeeId: null }, { employee: { employeeTypeId: { notIn: excludeEmployeeTypeIds } } }] }]
            : []),
        ],
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
            suffix: true,
            position: true,
            offices: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { dateStart: "desc" },
    });

    return NextResponse.json({ trainings });
  } catch (error) {
    console.error("[TRAINING_LIST_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
