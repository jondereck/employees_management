import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import {
  invalidateWorkforceReportCache,
  WORKFORCE_ACTIVE_STATUS,
  WORKFORCE_INACTIVE_STATUS,
  resolveWorkforceIndicatorId,
} from "@/lib/workforce-history";

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function normalizeAssignments(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => ({
      employeeId: typeof entry?.employeeId === "string" ? entry.employeeId.trim() : "",
      indicatorId: typeof entry?.indicatorId === "string" ? entry.indicatorId.trim() : "",
    }))
    .filter((entry) => entry.employeeId && entry.indicatorId);
}

function normalizeMode(value: unknown): "update_as_of" | "create_new" {
  return value === "create_new" ? "create_new" : "update_as_of";
}

export async function POST(
  req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) return new NextResponse("Unauthenticated", { status: 401 });

    const department = await prismadb.department.findFirst({
      where: { id: params.departmentId, userId },
      select: { id: true },
    });
    if (!department) return new NextResponse("Unauthorized", { status: 403 });

    const body = await req.json().catch(() => ({}));
    const assignments = normalizeAssignments(body?.assignments);
    const mode = normalizeMode(body?.mode);
    if (assignments.length === 0) {
      return new NextResponse("No indicator assignments selected", { status: 400 });
    }

    const effectiveAt = parseDate(body?.effectiveAt);
    const employeeIds = Array.from(new Set(assignments.map((assignment) => assignment.employeeId)));
    const employees = await prismadb.employee.findMany({
      where: { departmentId: params.departmentId, id: { in: employeeIds } },
      select: {
        id: true,
        departmentId: true,
        officeId: true,
        employeeTypeId: true,
        eligibilityId: true,
        position: true,
        gender: true,
        maritalStatus: true,
        isHead: true,
        isArchived: true,
        dateHired: true,
      },
    });
    const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));

    const indicatorMap = new Map<string, string>();
    for (const assignment of assignments) {
      if (!indicatorMap.has(assignment.indicatorId)) {
        const indicatorId = await resolveWorkforceIndicatorId(params.departmentId, null, assignment.indicatorId);
        if (!indicatorId) {
          throw new Error("Selected indicator does not belong to this department.");
        }
        indicatorMap.set(assignment.indicatorId, indicatorId);
      }
    }

    const validAssignments = assignments
      .map((assignment) => ({
        assignment,
        employee: employeeMap.get(assignment.employeeId),
        indicatorId: indicatorMap.get(assignment.indicatorId),
      }))
      .filter((entry) => entry.employee && entry.indicatorId) as Array<{
      assignment: { employeeId: string; indicatorId: string };
      employee: NonNullable<ReturnType<typeof employeeMap.get>>;
      indicatorId: string;
    }>;

    if (validAssignments.length === 0) {
      return new NextResponse("No valid employee assignments found", { status: 400 });
    }

    let updated = 0;
    let created = 0;
    let skippedBeforeHire = 0;
    let skippedNoSnapshot = 0;
    let skippedAlreadyCurrent = 0;
    const skippedInvalidAssignment = assignments.length - validAssignments.length;

    await prismadb.$transaction(async (tx) => {
      for (const entry of validAssignments) {
        if (effectiveAt < entry.employee.dateHired) {
          skippedBeforeHire += 1;
          continue;
        }

        if (mode === "update_as_of") {
          const existing = await tx.employeeHistorySnapshot.findFirst({
            where: {
              departmentId: params.departmentId,
              employeeId: entry.employee.id,
              effectiveAt: {
                gte: entry.employee.dateHired,
                lte: effectiveAt,
              },
            },
            select: { id: true, indicatorId: true },
            orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
          });

          if (existing) {
            if (existing.indicatorId === entry.indicatorId) {
              skippedAlreadyCurrent += 1;
              continue;
            }
            await tx.employeeHistorySnapshot.update({
              where: { id: existing.id },
              data: {
                indicatorId: entry.indicatorId,
                source: "INDICATOR_SUGGESTION",
                note: "Indicator corrected from low-cost suggestion (as-of update).",
              },
            });
            updated += 1;
            continue;
          }

          skippedNoSnapshot += 1;
          continue;
        }

        await tx.employeeHistorySnapshot.create({
          data: {
            departmentId: entry.employee.departmentId,
            employeeId: entry.employee.id,
            effectiveAt,
            officeId: entry.employee.officeId || null,
            employeeTypeId: entry.employee.employeeTypeId || null,
            eligibilityId: entry.employee.eligibilityId || null,
            position: entry.employee.position ?? "",
            gender: entry.employee.gender,
            maritalStatus: entry.employee.maritalStatus ?? null,
            isHead: Boolean(entry.employee.isHead),
            status: entry.employee.isArchived ? WORKFORCE_INACTIVE_STATUS : WORKFORCE_ACTIVE_STATUS,
            indicatorId: entry.indicatorId,
            source: "INDICATOR_SUGGESTION",
            note: "Indicator assigned from low-cost keyword suggestion review.",
          },
        });
        created += 1;
      }
    });

    await invalidateWorkforceReportCache(params.departmentId);

    return NextResponse.json({
      mode,
      updated,
      created,
      skipped: assignments.length - updated - created,
      skippedBeforeHire,
      skippedNoSnapshot,
      skippedAlreadyCurrent,
      skippedInvalidAssignment,
    });
  } catch (error) {
    console.error("[WORKFORCE_HISTORY_INDICATOR_ASSIGNMENTS_POST]", error);
    const message = error instanceof Error ? error.message : "Internal error";
    return new NextResponse(message, { status: message.includes("indicator") ? 400 : 500 });
  }
}
