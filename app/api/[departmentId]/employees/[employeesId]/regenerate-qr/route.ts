import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

export async function POST(
  _req: Request,
  {
    params,
  }: {
    params: { departmentId: string; employeesId: string };
  }
) {
  const { userId } = auth();
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const dept = await prismadb.department.findFirst({
    where: { id: params.departmentId, userId },
    select: { id: true },
  });

  if (!dept) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const employee = await prismadb.employee.update({
    where: { id: params.employeesId }, // ✅ FIX HERE
    data: {
      publicVersion: { increment: 1 },
      publicEnabled: true,
    },
    select: {
      id: true,
      publicId: true,
      publicVersion: true,
    },
  });

  return NextResponse.json(employee);
}
