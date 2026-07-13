import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  buildAnnex8cSummary,
  buildImportKey,
  consolidateAutoExceptionDrafts,
  type AttendanceExceptionTypeCode,
} from "@/lib/attendance-exception";
import prismadb from "@/lib/prismadb";

async function requireDepartmentOwner(departmentId: string) {
  const { userId } = auth();
  if (!userId) return { error: new NextResponse("Unauthenticated", { status: 401 }) };
  const department = await prismadb.department.findFirst({
    where: { id: departmentId, userId },
    select: { id: true },
  });
  if (!department) return { error: new NextResponse("Unauthorized", { status: 403 }) };
  return { department };
}

function serialize(row: {
  id: string;
  employeeId: string | null;
  employeeNo: string;
  employeeName: string;
  officeName: string;
  incidentDate: Date;
  incidentDates: string;
  exceptionType: string;
  occurrences: number;
  actionTaken: string;
  status: string;
  remarks: string;
  reportingPeriod: string;
  source: string;
  importKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...row,
    incidentDate: row.incidentDate.toISOString().slice(0, 10),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function summaryFromRows(
  rows: Array<{
    employeeName: string;
    employeeNo: string;
    exceptionType: string;
    incidentDate: Date;
    incidentDates: string;
    occurrences: number;
  }>
) {
  return buildAnnex8cSummary(
    rows.map((r) => ({
      employeeName: r.employeeName,
      employeeNo: r.employeeNo,
      exceptionType: r.exceptionType as AttendanceExceptionTypeCode,
      incidentDate: r.incidentDate.toISOString().slice(0, 10),
      incidentDates: r.incidentDates,
      occurrences: r.occurrences,
    }))
  );
}

function preserveKey(employeeNo: string, employeeName: string, exceptionType: string) {
  return `${exceptionType}|${(employeeNo || employeeName || "").trim().toLowerCase()}`;
}

/** Legacy per-day importKey ends with |YYYY-MM-DD (5+ pipe segments). */
function isLegacyAutoImportKey(importKey: string | null | undefined) {
  if (!importKey?.startsWith("auto|")) return false;
  return importKey.split("|").length >= 5;
}

function needsAutoConsolidation(
  rows: Array<{
    employeeNo: string;
    employeeName: string;
    exceptionType: string;
    source: string;
    importKey: string | null;
  }>
) {
  const auto = rows.filter((r) => r.source === "auto" && (r.exceptionType === "T" || r.exceptionType === "U"));
  if (auto.length < 2) return auto.some((r) => isLegacyAutoImportKey(r.importKey));

  const counts = new Map<string, number>();
  for (const r of auto) {
    const key = preserveKey(r.employeeNo, r.employeeName, r.exceptionType);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (isLegacyAutoImportKey(r.importKey)) return true;
  }
  return Array.from(counts.values()).some((n) => n > 1);
}

async function consolidatePeriodIfNeeded(departmentId: string, reportingPeriod: string) {
  const existing = await prismadb.attendanceException.findMany({
    where: {
      departmentId,
      reportingPeriod,
      source: "auto",
      exceptionType: { in: ["T", "U"] },
    },
  });
  if (!needsAutoConsolidation(existing)) return null;

  const drafts = consolidateAutoExceptionDrafts(
    existing.map((r) => ({
      employeeNo: r.employeeNo,
      employeeName: r.employeeName,
      officeName: r.officeName,
      incidentDate: r.incidentDate.toISOString().slice(0, 10),
      incidentDates: r.incidentDates || r.incidentDate.toISOString().slice(0, 10),
      exceptionType: r.exceptionType as "T" | "U",
      occurrences: r.occurrences,
    })),
    reportingPeriod
  );
  return replaceAutoRows({ departmentId, reportingPeriod, drafts });
}

export async function GET(req: Request, { params }: { params: { departmentId: string } }) {
  try {
    const access = await requireDepartmentOwner(params.departmentId);
    if (access.error) return access.error;

    const { searchParams } = new URL(req.url);
    const reportingPeriod = searchParams.get("reportingPeriod") || undefined;
    const departmentId = params.departmentId;

    // Default behavior: silently regroup legacy per-date auto rows
    if (reportingPeriod) {
      await consolidatePeriodIfNeeded(departmentId, reportingPeriod);
    } else {
      const periods = await prismadb.attendanceException.findMany({
        where: { departmentId, source: "auto", exceptionType: { in: ["T", "U"] } },
        select: { reportingPeriod: true },
        distinct: ["reportingPeriod"],
      });
      for (const p of periods) {
        await consolidatePeriodIfNeeded(departmentId, p.reportingPeriod);
      }
    }

    const rows = await prismadb.attendanceException.findMany({
      where: {
        departmentId,
        ...(reportingPeriod ? { reportingPeriod } : {}),
      },
      orderBy: [{ employeeName: "asc" }, { exceptionType: "asc" }, { incidentDate: "desc" }],
    });

    const periodList = await prismadb.attendanceException.findMany({
      where: { departmentId },
      select: { reportingPeriod: true },
      distinct: ["reportingPeriod"],
      orderBy: { reportingPeriod: "desc" },
    });

    return NextResponse.json({
      rows: rows.map(serialize),
      reportingPeriods: periodList.map((p) => p.reportingPeriod),
      summary: summaryFromRows(rows),
    });
  } catch (error) {
    console.error("[ATTENDANCE_EXCEPTIONS_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

const importSchema = z.object({
  reportingPeriod: z.string().min(1),
  drafts: z.array(
    z.object({
      employeeNo: z.string(),
      employeeName: z.string(),
      officeName: z.string(),
      incidentDate: z.string().min(8),
      incidentDates: z.string().optional().default(""),
      exceptionType: z.enum(["T", "U"]),
      occurrences: z.number().int().positive().optional().default(1),
      importKey: z.string().optional(),
    })
  ),
});

const CREATE_CHUNK = 500;

type Preserved = { actionTaken: string; status: string; remarks: string };

/**
 * Replace all auto T/U rows for a period with consolidated employee+type rows.
 * Preserves Action/Status/Remarks when the same employee+type already existed.
 */
async function replaceAutoRows(args: {
  departmentId: string;
  reportingPeriod: string;
  drafts: ReturnType<typeof consolidateAutoExceptionDrafts>;
}) {
  const { departmentId, reportingPeriod, drafts } = args;

  const existingAuto = await prismadb.attendanceException.findMany({
    where: { departmentId, reportingPeriod, source: "auto", exceptionType: { in: ["T", "U"] } },
    select: {
      employeeNo: true,
      employeeName: true,
      exceptionType: true,
      actionTaken: true,
      status: true,
      remarks: true,
      importKey: true,
    },
  });

  const preserved = new Map<string, Preserved>();
  for (const row of existingAuto) {
    const key = preserveKey(row.employeeNo, row.employeeName, row.exceptionType);
    const prev = preserved.get(key);
    // Prefer a row that already has edits
    if (
      !prev ||
      row.actionTaken.trim() ||
      row.remarks.trim() ||
      row.status !== "Open"
    ) {
      preserved.set(key, {
        actionTaken: row.actionTaken,
        status: row.status,
        remarks: row.remarks,
      });
    }
  }

  const nos = [...new Set(drafts.map((d) => d.employeeNo).filter(Boolean))];
  const employees = nos.length
    ? await prismadb.employee.findMany({
        where: { departmentId, employeeNo: { in: nos } },
        select: { id: true, employeeNo: true },
      })
    : [];
  const byNo = new Map(employees.map((e) => [e.employeeNo.trim().toLowerCase(), e.id]));

  // Wipe previous auto T/U for this period (legacy per-date + old keys)
  await prismadb.attendanceException.deleteMany({
    where: {
      departmentId,
      reportingPeriod,
      source: "auto",
      exceptionType: { in: ["T", "U"] },
    },
  });

  const data = drafts
    .map((draft) => {
      const incidentDate = new Date(`${draft.incidentDate}T12:00:00.000Z`);
      if (Number.isNaN(incidentDate.getTime())) return null;
      const employeeId = draft.employeeNo
        ? byNo.get(draft.employeeNo.trim().toLowerCase()) ?? null
        : null;
      const saved = preserved.get(preserveKey(draft.employeeNo, draft.employeeName, draft.exceptionType));
      return {
        departmentId,
        employeeId,
        employeeNo: draft.employeeNo,
        employeeName: draft.employeeName || "(Unnamed)",
        officeName: draft.officeName,
        incidentDate,
        incidentDates: draft.incidentDates || draft.incidentDate,
        exceptionType: draft.exceptionType,
        occurrences: draft.occurrences,
        reportingPeriod,
        source: "auto" as const,
        importKey:
          draft.importKey ||
          buildImportKey(reportingPeriod, draft.exceptionType, draft.employeeNo, draft.employeeName),
        actionTaken: saved?.actionTaken ?? "",
        status: saved?.status ?? "Open",
        remarks: saved?.remarks ?? "",
      };
    })
    .filter(Boolean) as Array<{
    departmentId: string;
    employeeId: string | null;
    employeeNo: string;
    employeeName: string;
    officeName: string;
    incidentDate: Date;
    incidentDates: string;
    exceptionType: "T" | "U";
    occurrences: number;
    reportingPeriod: string;
    source: "auto";
    importKey: string;
    actionTaken: string;
    status: string;
    remarks: string;
  }>;

  for (let i = 0; i < data.length; i += CREATE_CHUNK) {
    await prismadb.attendanceException.createMany({
      data: data.slice(i, i + CREATE_CHUNK).map((row) => ({
        ...row,
        status: row.status as
          | "Open"
          | "CounselingConducted"
          | "MemorandumIssued"
          | "Resolved"
          | "ForAdministrativeAction",
      })),
      skipDuplicates: true,
    });
  }

  const rows = await prismadb.attendanceException.findMany({
    where: { departmentId, reportingPeriod },
    orderBy: [{ employeeName: "asc" }, { exceptionType: "asc" }, { incidentDate: "desc" }],
  });

  return { created: data.length, rows };
}

/** Import auto T/U drafts (always consolidated per employee + type). */
export async function POST(req: Request, { params }: { params: { departmentId: string } }) {
  try {
    const access = await requireDepartmentOwner(params.departmentId);
    if (access.error) return access.error;

    const body = await req.json();
    const parsed = importSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { reportingPeriod, drafts } = parsed.data;
    const departmentId = params.departmentId;

    if (!drafts.length) {
      return NextResponse.json({ error: "No drafts to import." }, { status: 400 });
    }

    const uniqueDrafts = consolidateAutoExceptionDrafts(drafts, reportingPeriod);
    const { created, rows } = await replaceAutoRows({
      departmentId,
      reportingPeriod,
      drafts: uniqueDrafts,
    });

    return NextResponse.json({
      created,
      updated: 0,
      reportingPeriod,
      rows: rows.map(serialize),
      summary: summaryFromRows(rows),
    });
  } catch (error) {
    console.error("[ATTENDANCE_EXCEPTIONS_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
