import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

/* ✅ NEW */

import { ApprovalEvent } from "@/lib/types/realtime";
import { pusherServer } from "@/lib/pusher";
const DateLike = z.union([
  z.string().datetime(),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  z.string().regex(/^\d{2}[-/]\d{2}[-/]\d{4}$/),
]);
const Schema = z.object({
  title: z.string().min(1).max(200).optional(),
  issuer: z.string().max(200).optional().nullable(),
  givenAt: DateLike.optional(),
  description: z.string().max(2000).optional().nullable(),
  fileUrl: z.string().url().optional().nullable(),
  thumbnail: z.string().url().optional().nullable(),
  tags: z.array(z.string()).optional(),
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

export async function POST(req: Request, { params }: { params: { employeeId: string; awardId: string } }) {
  try {
    const body = await req.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

    const emp = await prismadb.employee.findUnique({
      where: { id: params.employeeId },
      select: { id: true, departmentId: true, publicEnabled: true },
    });
    if (!emp?.publicEnabled) return NextResponse.json({ error: "Public suggestions disabled" }, { status: 403 });

    const award = await prismadb.award.findFirst({
      where: { id: params.awardId, employeeId: emp.id },
      select: { id: true },
    });
    if (!award) return NextResponse.json({ error: "Award not found" }, { status: 404 });

    const nv: any = {};
    if (parsed.data.title !== undefined) nv.title = parsed.data.title ?? "";
    if (parsed.data.issuer !== undefined) nv.issuer = parsed.data.issuer ?? null;
    if (parsed.data.givenAt !== undefined) {
      const iso = toISO(parsed.data.givenAt);
      if (!assertNotFuture(iso)) return NextResponse.json({ error: "Date cannot be in the future" }, { status: 400 });
      nv.givenAt = iso;
    }
    if (parsed.data.description !== undefined) nv.description = parsed.data.description ?? null;
    if (parsed.data.fileUrl !== undefined) nv.fileUrl = parsed.data.fileUrl ?? null;
    if (parsed.data.thumbnail !== undefined) nv.thumbnail = parsed.data.thumbnail ?? null;
    if (parsed.data.tags !== undefined) nv.tags = Array.isArray(parsed.data.tags) ? parsed.data.tags : [];

    const cr = await prismadb.changeRequest.create({
      data: {
        departmentId: emp.departmentId,
        employeeId: emp.id,
        entityType: "AWARD",
        entityId: award.id,
        action: "UPDATE",
        status: "PENDING",
        newValues: nv as Prisma.InputJsonValue,
        note: parsed.data.note,
        submittedName: parsed.data.submittedName,
        submittedEmail: parsed.data.submittedEmail,
      },
      select: { id: true },
    });

    /* ✅ NEW: realtime emit (update request) */
    const actor = parsed.data.submittedEmail ?? parsed.data.submittedName ?? "public";
    const payload: ApprovalEvent = {
      type: "updated",
      entity: "award",
      approvalId: cr.id,
      departmentId: emp.departmentId,
      employeeId: emp.id,
      targetId: award.id,
      title: nv.title ?? "AWARD UPDATE REQUEST",
      occurredAt: null,
      givenAt: nv.givenAt ?? null,
      actorId: actor,
      when: new Date().toISOString(),
    };
    await pusherServer.trigger(`dept-${emp.departmentId}-approvals`, "approval:event", payload);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[PUBLIC_AWARD_REQUEST_EDIT]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
