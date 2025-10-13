import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";
import { getUpload, updateUpload } from "@/lib/attendance/store";
import { matchEmployees } from "@/lib/attendance/match";
import { buildExportFile } from "@/lib/attendance/export";
import { Schedule } from "@/lib/attendance/types";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { uploadId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 401 });
    }

    const stored = getUpload(params.uploadId);
    if (!stored) {
      return new NextResponse("Upload not found", { status: 404 });
    }

    const department = await prismadb.department.findFirst({
      where: { id: stored.departmentId, userId },
      select: { id: true },
    });

    if (!department) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    const body = await req.json();
    const format = body?.format === "csv" ? "csv" : "xlsx";
    const granularity = body?.granularity === "detail" ? "detail" : "summary";
    const officeIds = Array.isArray(body?.officeIds) ? body.officeIds : undefined;

    const graceRaw = body?.schedule?.graceMin;
    const parsedGrace = Number(graceRaw);
    const schedule: Schedule = {
      start: body?.schedule?.start ?? "08:00",
      end: body?.schedule?.end ?? "17:00",
      graceMin: Number.isFinite(parsedGrace) ? parsedGrace : 0,
    };

    const { matched, unmatched } = await matchEmployees(stored.departmentId, stored.raw);
    updateUpload(params.uploadId, { matched, unmatched });

    const filteredMatches = officeIds?.length
      ? matched.filter((match) => officeIds.includes(match.officeId))
      : matched;

    const { buffer, contentType } = buildExportFile({
      matches: filteredMatches,
      schedule,
      employees: stored.employees,
      offices: stored.offices,
      granularity,
      format,
    });

    const suffix = granularity === "summary" ? "Summary" : "Detail";
    const extension = format === "xlsx" ? "xlsx" : "csv";
    const safeMonth = (stored.month || "0000-00").replace(/[^0-9-]/g, "");
    const fileName = `TU_${safeMonth}_${suffix}.${extension}`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("[HRPS_ATTENDANCE_EXPORT]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
