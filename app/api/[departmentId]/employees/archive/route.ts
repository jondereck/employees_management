// app/api/[departmentId]/employees/archive/route.ts

import prismadb from "@/lib/prismadb";
import { auth } from "@clerk/nextjs/server";
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

    const { employeeIds, archived, terminationDate } = body as {
      employeeIds: string[];
      archived: boolean;
      terminationDate?: string;
    };

    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return NextResponse.json(
        { error: "employeeIds array is required" },
        { status: 400 }
      );
    }

    if (typeof archived !== "boolean") {
      return NextResponse.json(
        { error: "`archived` must be boolean" },
        { status: 400 }
      );
    }

    // Verify department ownership
    const department = await prismadb.department.findFirst({
      where: {
        id: params.departmentId,
        userId,
      },
      select: { id: true },
    });

    if (!department) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Load current employees
    const employees = await prismadb.employee.findMany({
      where: {
        id: { in: employeeIds },
        departmentId: params.departmentId,
      },
      select: {
        id: true,
        isArchived: true,
      },
    });

    const alreadyInState = employees
      .filter((e) => e.isArchived === archived)
      .map((e) => e.id);

    const toUpdateIds = employees
      .filter((e) => e.isArchived !== archived)
      .map((e) => e.id);

    if (toUpdateIds.length === 0) {
      return NextResponse.json(
        {
          error: "Nothing to update",
          skippedAlreadyInState: alreadyInState,
        },
        { status: 400 }
      );
    }

    // -------- TERMINATION DATE LOGIC --------

  let finalTerminationDate: string | null = null;

if (archived) {
  if (terminationDate) {
    const parsed = new Date(terminationDate);

    if (isNaN(parsed.getTime())) {
      return NextResponse.json(
        { error: "Invalid terminationDate" },
        { status: 400 }
      );
    }

    // Convert to MM/DD/YYYY
    finalTerminationDate = `${String(parsed.getMonth() + 1).padStart(2, "0")}/${String(
      parsed.getDate()
    ).padStart(2, "0")}/${parsed.getFullYear()}`;
  } else {
    const today = new Date();
    finalTerminationDate = `${String(today.getMonth() + 1).padStart(2, "0")}/${String(
      today.getDate()
    ).padStart(2, "0")}/${today.getFullYear()}`;
  }
}

    // -------- UPDATE --------

   const updated = await prismadb.employee.updateMany({
  where: {
    id: { in: toUpdateIds },
    departmentId: params.departmentId,
  },
  data: archived
    ? {
        isArchived: true,
        terminateDate: finalTerminationDate ?? "", // ✅ use computed value
        employeeNo: "",
      }
    : {
        isArchived: false,
        terminateDate: "", // clear when unarchiving
      },
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