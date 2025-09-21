import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

export async function GET(
  _req: Request,
  { params }: { params: { publicId: string } }
) {
  try {
    const employee = await prismadb.employee.findFirst({
      where: { publicId: params.publicId, publicEnabled: true },
      select: {
        firstName: true,
        lastName: true,
        employeeNo: true,
        position: true,
        offices: { select: { name: true } },
        images: {
          select: { url: true },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(employee, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}