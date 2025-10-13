import { randomUUID } from "crypto";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";
import { parseWorkbook } from "@/lib/attendance/parse";
import { matchEmployees } from "@/lib/attendance/match";
import { saveUpload } from "@/lib/attendance/store";
import { EmployeeLite, OfficeLite } from "@/lib/attendance/types";

export const runtime = "nodejs";

const buildEmployeeName = (employee: {
  firstName: string;
  lastName: string;
  middleName: string | null;
  suffix: string | null;
}) => {
  const parts = [employee.lastName, ", ", employee.firstName];
  if (employee.middleName) parts.push(` ${employee.middleName}`);
  if (employee.suffix) parts.push(` ${employee.suffix}`);
  return parts.join("").trim();
};

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 401 });
    }

    const url = new URL(req.url);
    const departmentId = url.searchParams.get("departmentId");
    if (!departmentId) {
      return NextResponse.json({ error: "Department is required" }, { status: 400 });
    }

    const department = await prismadb.department.findFirst({
      where: { id: departmentId, userId },
      select: { id: true },
    });

    if (!department) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const monthOverrideRaw = formData.get("month");
    if (typeof monthOverrideRaw === "string" && monthOverrideRaw && !/^\d{4}-\d{2}$/.test(monthOverrideRaw)) {
      return NextResponse.json({ error: "Month must be in YYYY-MM format" }, { status: 400 });
    }
    const monthOverride =
      typeof monthOverrideRaw === "string" && /^\d{4}-\d{2}$/.test(monthOverrideRaw)
        ? monthOverrideRaw
        : undefined;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["xls", "xlsx"].includes(extension)) {
      return NextResponse.json({ error: "Only .xls or .xlsx files are supported" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const { raw, meta, month } = parseWorkbook(buffer, file.name);
    const finalMonth = monthOverride ?? month;

    if (!raw.length) {
      return NextResponse.json({ error: "No attendance rows were parsed" }, { status: 400 });
    }

    if (!finalMonth) {
      return NextResponse.json({ error: "Unable to determine attendance month" }, { status: 400 });
    }

    const [{ matched, unmatched, employees: employeeRecords }, officesRaw] = await Promise.all([
      matchEmployees(departmentId, raw),
      prismadb.offices.findMany({
        where: { departmentId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const employees: EmployeeLite[] = employeeRecords.map((employee) => ({
      id: employee.id,
      officeId: employee.officeId,
      name: buildEmployeeName(employee),
    }));

    const offices: OfficeLite[] = officesRaw.map((office) => ({ id: office.id, name: office.name }));

    const uploadId = randomUUID();

    saveUpload({
      uploadId,
      departmentId,
      month: finalMonth,
      raw,
      meta,
      matched,
      unmatched,
      employees,
      offices,
    });

    return NextResponse.json({
      uploadId,
      month: finalMonth,
      raw,
      meta,
      matched,
      unmatched,
      employees,
      offices,
    });
  } catch (error) {
    console.error("[HRPS_ATTENDANCE_UPLOAD]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
