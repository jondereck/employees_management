import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";




export async function DELETE(
  req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    const { departmentId } = params;
    const body = await req.json();
    const { employeeIds } = body as { employeeIds: string[] };

    if (!employeeIds || employeeIds.length === 0) {
      return new NextResponse("No employee IDs provided", { status: 400 });
    }

    // Delete employees in this department
    await prismadb.employee.deleteMany({
      where: {
        id: { in: employeeIds },
        departmentId,
      },
    });

    return NextResponse.json({ message: "Employees deleted successfully" });
  } catch (error) {
    console.error(error);
    return new NextResponse("Failed to delete employees", { status: 500 });
  }
}
