import { classifyOfficeDeletionEmployees } from "@/lib/office-deletion";
import prismadb from "@/lib/prismadb";
import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: { departmentId: string; officeId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const office = await prismadb.offices.findFirst({
      where: {
        id: params.officeId,
        departmentId: params.departmentId,
        department: { userId },
      },
      select: { id: true, name: true },
    });
    if (!office) return new NextResponse("Unauthorized", { status: 403 });

    const [employees, destinations] = await Promise.all([
      prismadb.employee.findMany({
        where: {
          departmentId: params.departmentId,
          OR: [
            { officeId: office.id },
            { designationId: office.id },
            { officeDivision: { is: { officeId: office.id } } },
            { plantillaPosition: { is: { officeId: office.id } } },
          ],
        },
        select: {
          id: true,
          firstName: true,
          middleName: true,
          lastName: true,
          suffix: true,
          position: true,
          isArchived: true,
          officeId: true,
          designationId: true,
          offices: { select: { id: true, name: true } },
          designation: { select: { id: true, name: true } },
          officeDivision: {
            select: { officeId: true, name: true },
          },
          plantillaPosition: {
            select: {
              officeId: true,
              office: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      prismadb.offices.findMany({
        where: {
          departmentId: params.departmentId,
          id: { not: office.id },
          department: { userId },
        },
        select: {
          id: true,
          name: true,
          officeDivisions: {
            where: { departmentId: params.departmentId },
            select: { id: true, name: true },
            orderBy: [
              { sortOrder: "asc" },
              { name: "asc" },
              { id: "asc" },
            ],
          },
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
    ]);

    const reasonsByEmployee = new Map(
      classifyOfficeDeletionEmployees(employees, office.id).map((affected) => [
        affected.employeeId,
        affected.reasons,
      ])
    );

    return NextResponse.json({
      office,
      employees: employees.map((employee) => ({
        id: employee.id,
        firstName: employee.firstName,
        middleName: employee.middleName,
        lastName: employee.lastName,
        suffix: employee.suffix,
        position: employee.position,
        isArchived: employee.isArchived,
        reasons: reasonsByEmployee.get(employee.id) ?? [],
        assignedOffice: employee.offices,
        designationOffice: employee.designation,
        plantillaOffice: employee.plantillaPosition?.office ?? null,
        divisionName: employee.officeDivision?.name ?? null,
      })),
      destinationOffices: destinations.map((destination) => ({
        id: destination.id,
        name: destination.name,
        divisions: destination.officeDivisions,
      })),
    });
  } catch (error) {
    console.log("[OFFICE_DELETION_PREVIEW_GET]", error);
    return NextResponse.json(
      { error: "Unable to load the office deletion preview." },
      { status: 500 }
    );
  }
}
