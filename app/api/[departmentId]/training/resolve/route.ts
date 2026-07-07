import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import prismadb from "@/lib/prismadb";
import { buildEmployeeMatchIndex, resolveEmployeeForRow } from "@/lib/training-match";
import type { TrainingResolvedRow } from "@/lib/training-types";

const RowSchema = z.object({
  bioNumberRaw: z.string(),
  nameRaw: z.string(),
  officeNameRaw: z.string(),
  positionRaw: z.string(),
  appointmentRaw: z.string(),
  certificateTitle: z.string(),
  trainingType: z.string(),
  provider: z.string(),
  dateStart: z.string(),
  dateEnd: z.string(),
  durationHours: z.number(),
  certificateOf: z.string(),
  relevanceToJob: z.string(),
  competencyAddressed: z.string(),
  status: z.string(),
  indicator: z.string(),
  remarks: z.string(),
});

const Payload = z.object({
  rows: z.array(RowSchema).max(5000),
});

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

export async function POST(req: Request, { params }: { params: { departmentId: string } }) {
  try {
    const { departmentId } = params;
    const access = await requireDepartmentOwner(departmentId);
    if (access.error) return access.error;

    const body = await req.json().catch(() => null);
    const parsed = Payload.safeParse(body);
    if (!parsed.success) {
      return new NextResponse("Invalid payload", { status: 400 });
    }

    const index = await buildEmployeeMatchIndex(departmentId);

    const resolved: TrainingResolvedRow[] = parsed.data.rows.map((row) => {
      const { match, matchedBy } = resolveEmployeeForRow(index, row);

      return {
        ...row,
        matchStatus: match ? "matched" : "unmatched",
        matchedBy,
        employeeId: match?.employeeId ?? null,
        employeeName: match?.name ?? null,
        officeName: match?.officeName ?? null,
      };
    });

    const matchedCount = resolved.filter((r) => r.matchStatus === "matched").length;
    const matchedByNameCount = resolved.filter((r) => r.matchedBy === "name").length;

    return NextResponse.json({
      rows: resolved,
      matchedCount,
      matchedByNameCount,
      unmatchedCount: resolved.length - matchedCount,
    });
  } catch (error) {
    console.error("[TRAINING_RESOLVE_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
