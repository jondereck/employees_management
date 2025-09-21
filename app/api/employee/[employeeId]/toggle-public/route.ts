
import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

export async function POST(_req: Request, { params }: { params: { employeeId: string } }) {
  const employee = await prismadb.employee.findUnique({
    where: { id: params.employeeId },
    select: { publicEnabled: true },
  });
  if (!employee) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prismadb.employee.update({
    where: { id: params.employeeId },
    data: { publicEnabled: !employee.publicEnabled },
    select: { id: true, publicEnabled: true },
  });

  return NextResponse.json(updated);
}
