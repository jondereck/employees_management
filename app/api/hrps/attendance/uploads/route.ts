import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prismadb from "@/lib/prismadb";
import { parseAttendanceFile } from "@/lib/attendance/parse";
import { matchEmployees } from "@/lib/attendance/match";
import { cleanupUploads, saveUpload } from "@/lib/attendance/store";
import {
  AttendanceEmployeeInfo,
  UploadResponse,
} from "@/lib/attendance/types";
import { formatEmployeeName } from "@/lib/attendance/utils";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const formData = await req.formData();
    const departmentId = formData.get("departmentId");
    const manualMonth = formData.get("month");
    const file = formData.get("file");

    if (typeof departmentId !== "string" || !departmentId) {
      return NextResponse.json({ error: "Department is required" }, { status: 400 });
    }

    const department = await prismadb.department.findFirst({
      where: { id: departmentId, userId },
      select: { id: true },
    });

    if (!department) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const filename = (file as File).name ?? "attendance.xlsx";
    const ext = filename.split(".").pop()?.toLowerCase();
    if (!ext || !["xls", "xlsx"].includes(ext)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseAttendanceFile(buffer, filename);

    let month = parsed.month;
    let inferred = parsed.inferred;

    if (!month && typeof manualMonth === "string" && manualMonth) {
      month = manualMonth;
      inferred = false;
    }

    if (!month) {
      return NextResponse.json(
        { error: "Unable to infer month. Please select a month before uploading." },
        { status: 400 }
      );
    }

    cleanupUploads();

    const uploadId = randomUUID();

    const [matchResult, employeesRaw, offices] = await Promise.all([
      matchEmployees({ departmentId, records: parsed.records }),
      prismadb.employee.findMany({
        where: { departmentId },
        orderBy: { lastName: "asc" },
        select: {
          id: true,
          prefix: true,
          firstName: true,
          middleName: true,
          lastName: true,
          suffix: true,
          officeId: true,
          offices: { select: { id: true, name: true } },
        },
      }),
      prismadb.offices.findMany({
        where: { departmentId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

    const employees: AttendanceEmployeeInfo[] = employeesRaw.map((employee) => ({
      id: employee.id,
      name: formatEmployeeName(employee),
      officeId: employee.officeId,
      officeName: employee.offices?.name ?? null,
    }));

    const meta = {
      rows: parsed.rows,
      distinctBio: parsed.distinctBio,
      inferred,
    };

    const response: UploadResponse = {
      uploadId,
      month,
      raw: parsed.records,
      meta,
      matched: matchResult.matched,
      unmatched: matchResult.unmatched,
      employees,
      offices,
    };

    saveUpload({
      id: uploadId,
      departmentId,
      raw: parsed.records,
      month,
      meta,
      createdAt: Date.now(),
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("[HRPS_ATTENDANCE_UPLOAD]", error);
    return NextResponse.json({ error: "Failed to process upload" }, { status: 500 });
  }
}
