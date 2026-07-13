import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ATTENDANCE_EXCEPTION_TYPES } from "@/lib/attendance-exception";
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

const createSchema = z.object({
  reportingPeriod: z.string().min(1),
  employeeId: z.string().optional().nullable(),
  employeeNo: z.string().optional().default(""),
  employeeName: z.string().min(1),
  officeName: z.string().optional().default(""),
  incidentDate: z.string().min(8),
  exceptionType: z.enum(["MD", "FD", "UA", "AWOL", "T", "U"]),
  occurrences: z.number().int().positive().optional().default(1),
  actionTaken: z.string().optional().default(""),
  status: z
    .enum(["Open", "CounselingConducted", "MemorandumIssued", "Resolved", "ForAdministrativeAction"])
    .optional()
    .default("Open"),
  remarks: z.string().optional().default(""),
});

/** Manual create (typically MD/FD/UA/AWOL). */
export async function POST(req: Request, { params }: { params: { departmentId: string } }) {
  try {
    const access = await requireDepartmentOwner(params.departmentId);
    if (access.error) return access.error;

    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    if (!ATTENDANCE_EXCEPTION_TYPES.includes(data.exceptionType)) {
      return NextResponse.json({ error: "Invalid exception type" }, { status: 400 });
    }

    const incidentDate = new Date(`${data.incidentDate}T12:00:00.000Z`);
    if (Number.isNaN(incidentDate.getTime())) {
      return NextResponse.json({ error: "Invalid incidentDate" }, { status: 400 });
    }

    let employeeId = data.employeeId ?? null;
    let employeeNo = data.employeeNo || "";
    let officeName = data.officeName || "";

    if (employeeId) {
      const emp = await prismadb.employee.findFirst({
        where: { id: employeeId, departmentId: params.departmentId },
        select: {
          id: true,
          employeeNo: true,
          firstName: true,
          lastName: true,
          middleName: true,
          suffix: true,
          offices: { select: { name: true } },
        },
      });
      if (emp) {
        employeeId = emp.id;
        employeeNo = emp.employeeNo || employeeNo;
        officeName = emp.offices?.name || officeName;
      }
    }

    const row = await prismadb.attendanceException.create({
      data: {
        departmentId: params.departmentId,
        employeeId,
        employeeNo,
        employeeName: data.employeeName,
        officeName,
        incidentDate,
        incidentDates: data.incidentDate,
        exceptionType: data.exceptionType,
        occurrences: data.occurrences,
        actionTaken: data.actionTaken,
        status: data.status,
        remarks: data.remarks,
        reportingPeriod: data.reportingPeriod,
        source: "manual",
        // Unique with departmentId; avoid NULL importKey collisions on some PG configs
        importKey: `manual|${params.departmentId}|${Date.now()}|${Math.random().toString(36).slice(2, 10)}`,
      },
    });

    return NextResponse.json({
      row: {
        ...row,
        incidentDate: row.incidentDate.toISOString().slice(0, 10),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[ATTENDANCE_EXCEPTIONS_MANUAL_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
