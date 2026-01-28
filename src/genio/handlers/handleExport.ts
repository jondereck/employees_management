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

  

let employees = await prisma.employee.findMany({
  where: last.where,
  include: {
    offices: { select: { name: true } },
    employeeType: { select: { name: true } },
  },
});

// 🔥 APPLY POST FILTER (CURRENT EMPLOYEES BY YEAR)
if (last.postFilter?.excludeTerminatedOnOrBefore) {
  const year = last.postFilter.excludeTerminatedOnOrBefore;
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

  employees = employees.filter((e) => {
    if (!e.terminateDate) return true;

    const [m, d, y] = e.terminateDate.split("/").map(Number);
    if (!m || !d || !y) return true;

    const termination = new Date(y, m - 1, d);
    return termination > yearEnd;
  });
}




  if (employees.length === 0) {
    return NextResponse.json(
      { error: "No data found to export." },
      { status: 404 }
    );
  }

const rows = employees.map((e) => ({
  "Employee No": e.employeeNo,
  "Last Name": e.lastName,
  "First Name": e.firstName,
  "M.I.": e.middleName ? e.middleName.charAt(0) : "",
  Suffix: e.suffix ?? "",
  Position: e.position,
  Office: e.offices?.name ?? "",
  "Employee Type": e.employeeType?.name ?? "",
  Gender: e.gender,
}));


  // 🧾 Create workbook
  const worksheet = XLSX.utils.json_to_sheet(rows, {
  skipHeader: false,
});

const headerCells = Object.keys(rows[0]) as Array<keyof typeof rows[0]>;




headerCells.forEach((_, colIndex) => {
  const cellAddress = XLSX.utils.encode_cell({ r: 0, c: colIndex });
  if (worksheet[cellAddress]) {
    worksheet[cellAddress].s = {
      font: { bold: true },
      alignment: { vertical: "center" },
    };
  }
});


worksheet["!cols"] = headerCells.map((header) => ({
  wch: Math.max(
    header.length,
    ...rows.map((row) => String(row[header] ?? "").length)
  ) + 2,
}));
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
