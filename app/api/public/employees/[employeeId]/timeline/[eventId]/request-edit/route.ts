import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";
import { z } from "zod";
import type { EmploymentEventType, Prisma } from "@prisma/client";
import { ApprovalEvent } from "@/lib/types/realtime";
import { pusherServer } from "@/lib/pusher";


const UI_TO_DB: Record<string, EmploymentEventType> = {
  HIRED: "HIRED",
  PROMOTION: "PROMOTED",
  PROMOTED: "PROMOTED",
  TRANSFER: "TRANSFERRED",
  TRANSFERRED: "TRANSFERRED",
  REASSIGNED: "REASSIGNED",
  AWARD: "AWARDED",
  AWARDED: "AWARDED",
  SEPARATION: "TERMINATED",
  TERMINATED: "TERMINATED",
  CONTRACT_RENEWAL: "CONTRACT_RENEWAL",
  OTHER: "OTHER",
  TRAINING: "OTHER",
};
const uiToDb = (v?: string | null): EmploymentEventType => UI_TO_DB[(v ?? "").toUpperCase()] ?? "OTHER";

const DateLike = z.union([
  z.string().datetime(),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  z.string().regex(/^\d{2}[-/]\d{2}[-/]\d{4}$/),
]);
const Schema = z.object({
  type: z.string().optional(),
  occurredAt: DateLike.optional(),
  details: z.string().max(1000).optional(),
  note: z.string().max(500).optional(),
  submittedName: z.string().max(120).optional(),
  submittedEmail: z.string().email().optional(),
});

function toISO(raw: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T00:00:00.000Z`;
  const m = raw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (m) return `${m[3]}-${m[1]}-${m[2]}T00:00:00.000Z`;
  return new Date(raw).toISOString();
}
function assertNotFuture(iso: string) {
  const d = new Date(iso), t = new Date();
  d.setHours(0,0,0,0); t.setHours(0,0,0,0);
  return d.getTime() <= t.getTime();
}

export async function POST(req: Request, { params }: { params: { employeeId: string; eventId: string } }) {
  try {
    const body = await req.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

    const emp = await prismadb.employee.findUnique({
      where: { id: params.employeeId },
      select: { id: true, departmentId: true, publicEnabled: true },
    });
    if (!emp?.publicEnabled) return NextResponse.json({ error: "Public suggestions disabled" }, { status: 403 });

    const event = await prismadb.employmentEvent.findFirst({
      where: { id: params.eventId, employeeId: emp.id },
      select: { id: true },
    });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const nv: any = {};
    if (parsed.data.type !== undefined) nv.type = uiToDb(parsed.data.type);
    if (parsed.data.occurredAt !== undefined) {
      const iso = toISO(parsed.data.occurredAt);
      if (!assertNotFuture(iso)) return NextResponse.json({ error: "Date cannot be in the future" }, { status: 400 });
      nv.occurredAt = iso;
    }
    if (parsed.data.details !== undefined) nv.details = parsed.data.details ?? null;

    const cr = await prismadb.changeRequest.create({
      data: {
        departmentId: emp.departmentId,
        employeeId: emp.id,
        entityType: "TIMELINE",
        entityId: event.id,
        action: "UPDATE",
        status: "PENDING",
        newValues: nv as Prisma.InputJsonValue,
        note: parsed.data.note,
        submittedName: parsed.data.submittedName,
        submittedEmail: parsed.data.submittedEmail,
      },
      select: { id: true },
    });

    /* ✅ NEW: realtime emit (request to UPDATE timeline) */
    const actor = parsed.data.submittedEmail ?? parsed.data.submittedName ?? "public";
    const payload: ApprovalEvent = {
      type: "updated",                // request to update
      entity: "timeline",
      approvalId: cr.id,              // changeRequest id
      departmentId: emp.departmentId,
      employeeId: emp.id,
      targetId: event.id,
      title: parsed.data.type ? String(uiToDb(parsed.data.type)) : "TIMELINE UPDATE REQUEST",
      occurredAt: nv.occurredAt ?? null,
      givenAt: null,
      actorId: actor,
      when: new Date().toISOString(),
    };

    await pusherServer.trigger(`dept-${emp.departmentId}-approvals`, "approval:event", payload);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[PUBLIC_TIMELINE_REQUEST_EDIT]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
