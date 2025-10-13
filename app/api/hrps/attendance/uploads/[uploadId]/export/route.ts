import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as XLSX from "xlsx";
import prismadb from "@/lib/prismadb";
import { getUpload } from "@/lib/attendance/store";
import { matchEmployees } from "@/lib/attendance/match";
import {
  AttendanceEmployeeInfo,
  Schedule,
  UNASSIGNED_OFFICE_KEY,
} from "@/lib/attendance/types";
import { buildCsv, buildSummaryAndDetail, buildWorkbook } from "@/lib/attendance/export";
import { formatEmployeeName } from "@/lib/attendance/utils";

export const runtime = "nodejs";

type ExportBody = {
  format: "xlsx" | "csv";
  granularity: "summary" | "detail";
  schedule?: Schedule;
  officeIds?: string[];
};

const normalizeSchedule = (schedule?: Schedule): Schedule => {
  const start = schedule?.start ?? "08:00";
  const end = schedule?.end ?? "17:00";
  const grace = Number.isFinite(schedule?.graceMin) ? Number(schedule?.graceMin) : 0;
  return { start, end, graceMin: grace };
};

export async function POST(
  req: Request,
  { params }: { params: { uploadId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const upload = getUpload(params.uploadId);
    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    const department = await prismadb.department.findFirst({
      where: { id: upload.departmentId, userId },
      select: { id: true },
    });

    if (!department) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body: ExportBody = await req.json();
    const format = body.format === "csv" ? "csv" : "xlsx";
    const granularity = body.granularity === "detail" ? "detail" : "summary";
    const schedule = normalizeSchedule(body.schedule);
    const officeIds = Array.isArray(body.officeIds)
      ? body.officeIds.map((id) => String(id))
      : undefined;

    const [matchResult, employeesRaw, offices] = await Promise.all([
      matchEmployees({ departmentId: upload.departmentId, records: upload.raw }),
      prismadb.employee.findMany({
        where: { departmentId: upload.departmentId },
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
        where: { departmentId: upload.departmentId },
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

    const normalizedOfficeFilter = officeIds?.map((id) =>
      id === UNASSIGNED_OFFICE_KEY ? UNASSIGNED_OFFICE_KEY : id
    );

    const { summary, detail, officeDir } = buildSummaryAndDetail({
      matches: matchResult.matched,
      schedule,
      employees,
      offices,
      officeFilter: normalizedOfficeFilter,
    });

    if (granularity === "summary" && summary.length === 0) {
      return NextResponse.json({ error: "No summary rows to export" }, { status: 400 });
    }

    if (granularity === "detail" && detail.length === 0) {
      return NextResponse.json({ error: "No detail rows to export" }, { status: 400 });
    }

    const monthSegment = upload.month || new Date().toISOString().slice(0, 7);
    const nameSuffix = granularity === "summary" ? "Summary" : "Detail";
    const safeMonth = monthSegment.replace(/[^0-9-]/g, "-");
    const filename = `TU_${safeMonth}_${nameSuffix}.${format}`;

    if (format === "xlsx") {
      const workbook = buildWorkbook({
        summary,
        detail,
        officeDir,
        granularity,
      });
      const buffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "buffer",
        compression: true,
      });
      return new NextResponse(buffer as Buffer, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    const csv = buildCsv({ summary, detail, officeDir, granularity });
    return new NextResponse(Buffer.from(csv, "utf8"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[HRPS_ATTENDANCE_EXPORT]", error);
    return NextResponse.json({ error: "Failed to export attendance" }, { status: 500 });
  }
}
