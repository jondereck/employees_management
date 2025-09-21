// app/api/dev/public-check/[departmentId]/[employeeId]/route.ts
import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

export async function GET(
  _req: Request,
  { params }: { params: { departmentId: string; employeeId: string } }
) {
  const base = await prismadb.employee.findUnique({
    where: { id: params.employeeId },
    select: { id: true, departmentId: true, publicEnabled: true },
  });

  const details = await prismadb.employee.findFirst({
    where: {
      id: params.employeeId,
      departmentId: params.departmentId,
      publicEnabled: true,
    },
    select: {
      firstName: true,
      lastName: true,
      position: true,
      employeeNo: true,
    },
  });

  return NextResponse.json({
    exists: !!base,
    deptMatches: base ? base.departmentId === params.departmentId : false,
    publicEnabled: base?.publicEnabled ?? false,
    selectableDataFound: !!details,
  });
}
