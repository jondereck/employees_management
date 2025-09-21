import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
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

    // check dept owner
    const dept = await prismadb.department.findFirst({
      where: { id: params.departmentId, userId },
      select: { id: true },
    });
    if (!dept) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { employeeIds, enable } = body as { employeeIds: string[]; enable: boolean };

    

    if (!employeeIds?.length) {
      return NextResponse.json({ error: "No employee IDs provided" }, { status: 400 });
    }

    const updated = await prismadb.employee.updateMany({
      where: { id: { in: employeeIds }, departmentId: params.departmentId },
      data: { publicEnabled: enable },
    });
    

    return NextResponse.json({ count: updated.count, enabled: enable });
  } catch (err: any) {
    console.error("bulk toggle error", err);
    return NextResponse.json({ error: "Server error", detail: String(err) }, { status: 500 });
  }
}

