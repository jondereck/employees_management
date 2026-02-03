import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";


function addTimestamp(filename: string) {
  const now = new Date();

  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");

  const timestamp = `${yyyy}${mm}${dd}-${hh}${min}`;

  return filename.replace(".xlsx", `-${timestamp}.xlsx`);
}

function sanitizeFilename(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-_\.]/g, "_");
}


function buildExportFilename(context: any) {
    const last = context?.lastListQuery || context?.lastCountQuery;

  if (!last) return "employees-export.xlsx";

  /* ===============================
     NOTE SEARCH
     =============================== */
  if (last.type === "note_search") {
    const keywords =
      last.where?.OR?.map((c: any) => c.note?.contains).filter(Boolean) ?? [];

    if (keywords.length > 0) {
      return `employees-with-note-${keywords.join("-")}.xlsx`;
    }
  }

  /* ===============================
     EMPLOYEE NO PREFIX
     =============================== */
  if (last.type === "employee_no_prefix") {
    const prefix = last.where?.employeeNo?.startsWith;
    if (prefix) {
      return `employees-starting-with-${prefix}.xlsx`;
    }
  }

  /* ===============================
     MULTIPLE EMPLOYEE LOOKUP
     =============================== */
  if (last.type === "employee_lookup") {
    return `selected-employees.xlsx`;
  }

  /* ===============================
     COUNT QUERIES
     =============================== */
  if (last.type === "count") {
    if (last.gender) {
      return `employees-count-${last.gender.toLowerCase()}.xlsx`;
    }

    if (last.office) {
      return `employees-in-${last.office}.xlsx`;
    }

    if (last.employeeType) {
      return `employees-type-${last.employeeType}.xlsx`;
    }

    return "employee-count.xlsx";
  }

  /* ===============================
     CURRENT EMPLOYEES BY YEAR
     =============================== */
  if (last.type === "currentEmployeesByYear") {
    return `current-employees-${last.year}.xlsx`;
  }

  /* ===============================
     AGE ANALYSIS
     =============================== */
  if (last.type === "age_analysis") {
    const min = last.filters?.age?.min;
    const max = last.filters?.age?.max;

    if (min && max) return `employees-age-${min}-to-${max}.xlsx`;
    if (min) return `employees-age-over-${min}.xlsx`;
    if (max) return `employees-age-under-${max}.xlsx`;

    return "employees-by-age.xlsx";
  }

  /* ===============================
     TENURE ANALYSIS
     =============================== */
  if (last.type === "tenure_analysis") {
    const min = last.filters?.tenure?.min;
    const max = last.filters?.tenure?.max;

    if (min && max) return `employees-tenure-${min}-to-${max}-years.xlsx`;
    if (min) return `employees-tenure-over-${min}-years.xlsx`;
    if (max) return `employees-tenure-under-${max}-years.xlsx`;

    return "employees-by-tenure.xlsx";
  }

  /* ===============================
     OFFICE STRUCTURE
     =============================== */
  if (last.type === "list_offices") {
    return "offices-list.xlsx";
  }

  if (last.type === "list_heads") {
    return "office-heads.xlsx";
  }

  if (last.type === "offices_no_head") {
    return "offices-without-head.xlsx";
  }

  /* ===============================
     COMPARISONS
     =============================== */
  if (last.type === "compare_offices") {
    return "compare-offices.xlsx";
  }

  if (last.type === "compare_employee_types") {
    return "compare-employee-types.xlsx";
  }

  /* ===============================
     FALLBACK
     =============================== */
  return "employees-export.xlsx";
}



export async function handleExport(context: any) {

  const last = context?.lastListQuery || context?.lastCountQuery;


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
  Status: e.isArchived ? "Archived" : "Active",
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


const baseFilename = buildExportFilename(context);
const filename = addTimestamp(
  sanitizeFilename(baseFilename)
);


  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        `attachment; filename="${filename}"`,
    },
  });
}
