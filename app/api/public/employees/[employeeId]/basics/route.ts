// app/api/public/employees/[employeeId]/basics/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prismadb";

export async function GET(
  _req: Request,
  { params }: { params: { employeeId: string } }
) {
  const e = await prisma.employee.findUnique({
    where: { id: params.employeeId },
    select: {
      dateHired: true,
      position: true,
      offices: { select: { name: true } },
      employeeType: { select: { name: true } },
    },
  });

  if (!e) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    dateHired: e.dateHired.toISOString(),
    position: e.position,
    officeName: e.offices.name,
    employeeTypeName: e.employeeType.name,
  });
}
