import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import prismadb from "@/lib/prismadb";
import { buildEmployeeMatchIndex, buildSourceRowHash, resolveEmployeeForRow } from "@/lib/training-match";

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
  rows: z.array(RowSchema).min(1).max(5000),
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

const CHUNK_SIZE = 20;

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

    // Re-resolve employees server-side rather than trusting any employeeId the client might send.
    const index = await buildEmployeeMatchIndex(departmentId);

    let imported = 0;
    let unmatched = 0;
    const rows = parsed.data.rows;

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(async (row) => {
          const { match } = resolveEmployeeForRow(index, row);
          if (!match) unmatched += 1;

          const sourceRowHash = buildSourceRowHash(row);
          const dateStart = new Date(row.dateStart);
          const dateEnd = new Date(row.dateEnd);
          if (Number.isNaN(dateStart.getTime()) || Number.isNaN(dateEnd.getTime())) return;

          const data = {
            employeeId: match?.employeeId ?? null,
            bioNumberRaw: row.bioNumberRaw,
            nameRaw: row.nameRaw,
            officeNameRaw: row.officeNameRaw,
            positionRaw: row.positionRaw,
            appointmentRaw: row.appointmentRaw,
            certificateTitle: row.certificateTitle,
            trainingType: row.trainingType,
            provider: row.provider,
            dateStart,
            dateEnd,
            durationHours: row.durationHours,
            certificateOf: row.certificateOf,
            relevanceToJob: row.relevanceToJob,
            competencyAddressed: row.competencyAddressed,
            status: row.status,
            indicator: row.indicator,
            remarks: row.remarks || null,
          };

          await prismadb.training.upsert({
            where: { departmentId_sourceRowHash: { departmentId, sourceRowHash } },
            create: { departmentId, sourceRowHash, ...data },
            update: data,
          });
          imported += 1;
        })
      );
    }

    return NextResponse.json({ imported, unmatched, total: rows.length });
  } catch (error) {
    console.error("[TRAINING_IMPORT_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
