import prismadb from "@/lib/prismadb";
import { NextResponse } from "next/server";

type Params = {
  params: {
    departmentId: string;
  };
};

export async function GET(_request: Request, { params }: Params) {
  const employees = await prismadb.employee.findMany({
    where: { departmentId: params.departmentId, isArchived: false },
    orderBy: [{ isHead: "desc" }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      middleName: true,
      position: true,
      officeId: true,
      employeeType: {
        select: { name: true },
      },
    },
  });

  const formatted = employees.map((emp) => ({
    id: emp.id,
    name: formatEmployeeName(emp),
    title: emp.position ?? "",
    employeeTypeName: emp.employeeType?.name ?? "",
    officeId: emp.officeId,
  }));

  return NextResponse.json(formatted);
}

function formatEmployeeName(employee: {
  firstName: string;
  lastName: string;
  middleName: string;
}): string {
  const { firstName, middleName, lastName } = employee;
  const initials = middleName ? `${middleName[0]}.` : "";
  return [firstName, initials, lastName].filter(Boolean).join(" ");
}
