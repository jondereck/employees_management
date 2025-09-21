// app/api/[departmentId]/employees/archive/route.ts
import prismadb from "@/lib/prismadb";
import { auth } from "@clerk/nextjs/server"; // <-- server import
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { employeeIds, archived } = body as {
      employeeIds: string[];
      archived: boolean;
    };

    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return NextResponse.json({ error: "employeeIds array is required" }, { status: 400 });
    }
    if (typeof archived !== "boolean") {
      return NextResponse.json({ error: "`archived` must be boolean" }, { status: 400 });
    }

    // Verify ownership of department
    const department = await prismadb.department.findFirst({
      where: { id: params.departmentId, userId },
      select: { id: true },
    });
    if (!department) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Load current states to skip no-ops
    const employees = await prismadb.employee.findMany({
      where: { id: { in: employeeIds }, departmentId: params.departmentId },
      select: { id: true, isArchived: true, publicEnabled: true },
    });

    const alreadyInState = employees.filter(e => e.isArchived === archived).map(e => e.id);
    const toUpdateIds = employees.filter(e => e.isArchived !== archived).map(e => e.id);

    if (toUpdateIds.length === 0) {
      return NextResponse.json(
        { error: "Nothing to update", skippedAlreadyInState: alreadyInState },
        { status: 400 }
      );
    }

    // Terminate date handling:
    // If your prisma field is Date: use new Date()
    // If your prisma field is String: keep the formatted string below.
    const today = new Date();
    const formattedDate = `${String(today.getMonth() + 1).padStart(2, "0")}/${String(
      today.getDate()
    ).padStart(2, "0")}/${today.getFullYear()}`;

    // Build data per target state
    const dataWhenArchiving = {
      isArchived: true,
      publicEnabled: false,      // force private when archived
      terminateDate: formattedDate as any, // change to `new Date()` if your schema is Date
      employeeNo: "",            // your current rule: clear when archiving
    };

    const dataWhenUnarchiving: any = {
      isArchived: false,
      terminateDate: "",         // or `null` if field is Date; use `null as any`
      // employeeNo: (leave untouched; you can reassign elsewhere if needed)
    };

    const updated = await prismadb.employee.updateMany({
      where: {
        id: { in: toUpdateIds },
        departmentId: params.departmentId, // tenant safety
      },
      data: archived ? dataWhenArchiving : dataWhenUnarchiving,
    });

    return NextResponse.json({
      success: true,
      targetArchivedState: archived,
      updatedCount: updated.count,
      updatedIds: toUpdateIds,
      skippedAlreadyInState: alreadyInState,
    });
  } catch (error) {
    console.error("[EMPLOYEES_ARCHIVE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
