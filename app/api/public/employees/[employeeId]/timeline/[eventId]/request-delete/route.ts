import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";
import { z } from "zod";

import { ApprovalEvent } from "@/lib/types/realtime";
import { pusherServer } from "@/lib/pusher";
import { Prisma } from "@prisma/client";

const BodySchema = z.object({
  reason: z.string().trim().min(3, "Reason is required"),
  submittedName: z.string().trim().optional(),
  submittedEmail: z.string().trim().email().optional(),
});

export async function POST(req: Request, { params }: { params: { employeeId: string; eventId: string } }) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
    }
    const { reason, submittedName, submittedEmail } = parsed.data;

    const emp = await prismadb.employee.findFirst({
      where: { OR: [{ id: params.employeeId }, { publicId: params.employeeId }] },
      select: { id: true, departmentId: true, publicEnabled: true },
    });

    if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    if (!emp.publicEnabled) return NextResponse.json({ error: "Public suggestions disabled" }, { status: 403 });

    const event = await prismadb.employmentEvent.findFirst({
  where: { id: params.eventId, employeeId: emp.id },
});
if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

const oldValues = {
  type: event.type,
  occurredAt: event.occurredAt,
  details: event.details,
};

const cr = await prismadb.changeRequest.create({
  data: {
    departmentId: emp.departmentId,
    employeeId: emp.id,
    entityType: "TIMELINE",
    entityId: event.id,
    action: "DELETE",
    status: "PENDING",
    oldValues: oldValues,
    newValues: Prisma.DbNull,
    note: reason,
    submittedName,
    submittedEmail,
  },
  select: { id: true },
});
    /* ✅ NEW: realtime emit (request to DELETE timeline) */
    const actor = submittedEmail ?? submittedName ?? "public";
    const payload: ApprovalEvent = {
     type: "request_deleted", // delete request submitted
      entity: "timeline",
      approvalId: cr.id,             // changeRequest id
      departmentId: emp.departmentId,
      employeeId: emp.id,
      targetId: event.id,
      title: "TIMELINE DELETE REQUEST",
      occurredAt: null,
      givenAt: null,
      actorId: actor,
      when: new Date().toISOString(),
    };

    await pusherServer.trigger(`dept-${emp.departmentId}-approvals`, "approval:event", payload);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[PUBLIC_TIMELINE_REQUEST_DELETE]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
