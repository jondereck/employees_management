import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";

export async function GET(
  _req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) return new NextResponse("Unauthenticated", { status: 401 });

    const department = await prismadb.department.findFirst({
      where: { id: params.departmentId, userId },
      select: { id: true },
    });
    if (!department) return new NextResponse("Unauthorized", { status: 403 });

    const [offices, employeeTypes, eligibilities, employees] = await Promise.all([
      prismadb.offices.findMany({
        where: { departmentId: params.departmentId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prismadb.employeeType.findMany({
        where: { departmentId: params.departmentId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prismadb.eligibility.findMany({
        where: { departmentId: params.departmentId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prismadb.employee.findMany({
        where: { departmentId: params.departmentId },
        select: {
          id: true,
          lastName: true,
          firstName: true,
          middleName: true,
          position: true,
          isArchived: true,
        },
        orderBy: [{ isArchived: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
      }),
    ]);

    return NextResponse.json({
      offices,
      employeeTypes,
      eligibilities,
      employees: employees.map((employee) => ({
        id: employee.id,
        name: [employee.lastName, employee.firstName, employee.middleName ? `${employee.middleName[0]}.` : ""]
          .filter(Boolean)
          .join(", "),
        position: employee.position,
        isArchived: employee.isArchived,
      })),
    });
  } catch (error) {
    console.error("[WORKFORCE_HISTORY_OPTIONS_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
