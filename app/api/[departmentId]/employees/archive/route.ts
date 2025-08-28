// app/api/[departmentId]/employees/archive/route.ts
import prismadb from "@/lib/prismadb";
import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const { employeeIds, archived } = await req.json();

    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return new NextResponse("employeeIds array is required", { status: 400 });
    }

    const department = await prismadb.department.findFirst({
      where: { id: params.departmentId, userId },
    });
    if (!department) return new NextResponse("Unauthorized", { status: 403 });

    // Format date as MM/DD/YYYY (e.g., "03/28/2025")
    const today = new Date();
    const formattedDate = `${String(today.getMonth() + 1).padStart(2, "0")}/${String(
      today.getDate()
    ).padStart(2, "0")}/${today.getFullYear()}`;

    await prismadb.employee.updateMany({
      where: { id: { in: employeeIds } },
      data: {
        isArchived: archived,
        terminateDate: archived ? formattedDate : "",
        employeeNo: archived ? "" : undefined, // clear only when archiving
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[EMPLOYEES_ARCHIVE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
