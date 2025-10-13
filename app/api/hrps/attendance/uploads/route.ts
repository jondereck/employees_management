import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prismadb from "@/lib/prismadb";
import * as XLSX from "xlsx";
import {
  detectMonthFromSheet,
  parseBlockSheet,
  parseColumnSheet,
  summarizeRecords,
} from "@/lib/attendance/parse";
import { matchEmployees } from "@/lib/attendance/match";
import { cleanupUploads, saveUpload } from "@/lib/attendance/store";
import {
  AttendanceEmployeeInfo,
  BioSource,
  RawRecord,
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
    const bioSourceRaw = formData.get("bioSource");
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

    let bioSource: BioSource | null = null;
    if (typeof bioSourceRaw === "string") {
      try {
        const parsedSource = JSON.parse(bioSourceRaw) as BioSource;
        if (parsedSource && typeof parsedSource === "object" && "kind" in parsedSource) {
          if (parsedSource.kind === "header") {
            bioSource = { kind: "header" };
          } else if (
            parsedSource.kind === "column" &&
            typeof parsedSource.column === "string" &&
            parsedSource.column.trim()
          ) {
            bioSource = {
              kind: "column",
              column: parsedSource.column.trim().toUpperCase(),
            };
          }
        }
      } catch (error) {
        console.error("[HRPS_ATTENDANCE_UPLOAD_PARSE_BIO]", error);
      }
    }

    if (!bioSource) {
      return NextResponse.json({ error: "Select how to extract Bio numbers before continuing." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, {
        type: "buffer",
        cellDates: true,
        cellText: true,
        raw: false,
      });
    } catch (error) {
      console.error("[HRPS_ATTENDANCE_UPLOAD_READ]", error);
      return NextResponse.json({ error: "Failed to process upload" }, { status: 400 });
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ error: "No worksheet found in file." }, { status: 400 });
    }

    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      return NextResponse.json({ error: "No worksheet found in file." }, { status: 400 });
    }

    const manualMonthValue = typeof manualMonth === "string" && manualMonth ? manualMonth : undefined;
    const detectedMonth = detectMonthFromSheet(worksheet);

    let month = manualMonthValue || detectedMonth || "";
    let inferred = !manualMonthValue && !!detectedMonth;

    let records = [] as RawRecord[];
    let rowsCount = 0;
    let distinctBio = 0;

    if (bioSource.kind === "header") {
      if (!month) {
        return NextResponse.json(
          { error: "Unable to infer month. Please select a month before uploading." },
          { status: 400 }
        );
      }
      records = parseBlockSheet(worksheet, month);
      const summary = summarizeRecords(records);
      rowsCount = summary.rows;
      distinctBio = summary.distinctBio;
    } else {
      const columnResult = parseColumnSheet(worksheet, bioSource.column);
      records = columnResult.records;
      rowsCount = columnResult.rows;
      distinctBio = records.length;
      const dateValues = columnResult.dates;
      if (!month) {
        const inferredMonth = dateValues.length ? dateValues[0].slice(0, 7) : "";
        if (inferredMonth) {
          month = inferredMonth;
          inferred = !manualMonthValue;
        }
      }
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
      matchEmployees({ departmentId, records }),
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
      rows: rowsCount,
      distinctBio,
      inferred,
    };

    const response: UploadResponse = {
      uploadId,
      month,
      raw: records,
      meta,
      matched: matchResult.matched,
      unmatched: matchResult.unmatched,
      employees,
      offices,
    };

    saveUpload({
      id: uploadId,
      departmentId,
      raw: records,
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
