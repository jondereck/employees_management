import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function handleExport(context: any) {
  const last = context?.lastCountQuery || context?.lastListQuery;

  if (!last) {
    return NextResponse.json(
      { error: "Nothing to export yet." },
      { status: 400 }
    );
  }

  const employees = await prisma.employee.findMany({
    where: {
      isArchived: false,
      officeId: last.officeId,
      gender: last.gender,
      employeeTypeId: last.employeeTypeId,
    },
    select: {
      employeeNo: true,
      firstName: true,
      middleName: true,
      lastName: true,
      position: true,
      gender: true,
    },
  });

  if (employees.length === 0) {
    return NextResponse.json(
      { error: "No data found to export." },
      { status: 404 }
    );
  }

  const rows = employees.map((e) => ({
    EmployeeNo: e.employeeNo,
    Name: [e.firstName, e.middleName, e.lastName]
      .filter(Boolean)
      .join(" "),
    Position: e.position,
    Gender: e.gender,
  }));

  // 🧾 Create workbook
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  });

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="employees-export.xlsx"',
    },
  });
}
