import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";

import prismadb from "@/lib/prismadb";

export async function PATCH(
  req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const department = await prismadb.department.findFirst({
      where: { id: params.departmentId, userId },
      select: { id: true },
    });

    if (!department) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { employeeIds, queued } = body as {
      employeeIds?: unknown;
      queued?: unknown;
    };

    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return NextResponse.json(
        { error: "employeeIds array is required" },
        { status: 400 }
      );
    }

    if (typeof queued !== "boolean") {
      return NextResponse.json(
        { error: "`queued` must be boolean" },
        { status: 400 }
      );
    }

    const uniqueEmployeeIds = Array.from(
      new Set(
        employeeIds
          .map((id) => (typeof id === "string" ? id.trim() : ""))
          .filter(Boolean)
      )
    );

    if (uniqueEmployeeIds.length === 0) {
      return NextResponse.json(
        { error: "employeeIds array is required" },
        { status: 400 }
      );
    }

    const idQueueAt: Date | null = queued ? new Date() : null;

    const updatedCount = await prismadb.$executeRaw`
      UPDATE "Employee"
      SET "idQueueAt" = ${idQueueAt}
      WHERE "departmentId" = ${params.departmentId}
        AND "id" IN (${Prisma.join(uniqueEmployeeIds)})
    `;

    return NextResponse.json({
      success: true,
      queued,
      updatedCount,
    });
  } catch (error) {
    console.error("[EMPLOYEES_ID_QUEUE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
