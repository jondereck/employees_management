import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";
import { z } from "zod";
import { hashIp } from "@/lib/hash-ip";
import { Prisma } from "@prisma/client";

const CreateEventSchema = z.object({
  type: z.string(),                       // must match your EmploymentEventType on review
  occurredAt: z.string().datetime(),      // ISO date string
  details: z.string().max(1000).optional().nullable(),
  note: z.string().max(500).optional(),
  submittedName: z.string().max(120).optional(),
  submittedEmail: z.string().email().optional(),
});

export async function POST(req: Request, { params }: { params: { employeeId: string } }) {
  try {
    const body = await req.json();
    const parsed = CreateEventSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

    const emp = await prismadb.employee.findUnique({
      where: { id: params.employeeId },
      select: { id: true, departmentId: true, publicEnabled: true },
    });
    if (!emp || !emp.publicEnabled) {
      return NextResponse.json({ error: "Public suggestions disabled" }, { status: 403 });
    }

    const ipHash = hashIp(req.headers.get("x-forwarded-for") || "0.0.0.0");

    const cr = await prismadb.changeRequest.create({
      data: {
        departmentId: emp.departmentId,
        employeeId: emp.id,
        entityType: "TIMELINE",
        entityId: null,                 // CREATE: no target yet
        action: "CREATE",
        status: "PENDING",
        newValues: {
          type: parsed.data.type,
          occurredAt: parsed.data.occurredAt,
          details: parsed.data.details ?? null,
        } as Prisma.InputJsonValue,
        note: parsed.data.note,
        submittedName: parsed.data.submittedName,
        submittedEmail: parsed.data.submittedEmail,
        ipHash,
      },
    });

    return NextResponse.json({ ok: true, requestId: cr.id });
  } catch (e) {
    console.error("[PUBLIC_TIMELINE_CREATE]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
