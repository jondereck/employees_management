import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { normalizeEmployeeMutationIds } from "@/lib/employee-mutations";
import prismadb from "@/lib/prismadb";
import { publishWorkforceChanged } from "@/lib/workforce-realtime";

export async function DELETE(
  req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { departmentId } = params;
    if (!departmentId) {
      return NextResponse.json(
        { error: "Department id is required" },
        { status: 400 }
      );
    }

    const department = await prismadb.department.findFirst({
      where: { id: departmentId, userId },
      select: { id: true },
    });
    if (!department) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const employeeIds = normalizeEmployeeMutationIds(body?.employeeIds);
    if (!employeeIds) {
      return NextResponse.json(
        { error: "employeeIds must be a non-empty array of non-empty strings" },
        { status: 400 }
      );
    }

    const deleted = await prismadb.employee.deleteMany({
      where: {
        id: { in: employeeIds },
        departmentId,
      },
    });

    if (deleted.count > 0) {
      await publishWorkforceChanged(departmentId, {
        scope: "employee",
        action: "deleted",
      });
    }
    return NextResponse.json({
      message: "Employees deleted successfully",
      deletedCount: deleted.count,
    });
  } catch (error) {
    console.error("[EMPLOYEES_BULK_DELETE]", error);
    return new NextResponse("Failed to delete employees", { status: 500 });
  }
}
