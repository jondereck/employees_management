import { NextResponse } from "next/server";
import prisma from "@/lib/prismadb";
import { z } from "zod";
import { hashIp } from "@/lib/hash-ip";
import { Prisma } from "@prisma/client";


import { ApprovalEvent } from "@/lib/types/realtime";
import { pusherServer } from "@/lib/pusher";

const DeleteSchema = z.object({
  reason: z.string().min(5).max(500),
  submittedName: z.string().max(120).optional(),
  submittedEmail: z.string().email().optional(),
});

export async function POST(req: Request, { params }: { params: { employeeId: string; awardId: string } }) {
  try {
    const body = await req.json();
    const parsed = DeleteSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

    const award = await prisma.award.findFirst({
      where: { id: params.awardId, employeeId: params.employeeId, deletedAt: null },
      select: {
        id: true, title: true, issuer: true, givenAt: true,
        employee: { select: { departmentId: true, id: true, publicEnabled: true } },
      },
    });
    if (!award || !award.employee.publicEnabled) {
      return NextResponse.json({ error: "Not available for public deletions" }, { status: 404 });
    }

    const ipHash = hashIp(req.headers.get("x-forwarded-for") || "0.0.0.0");
    const cr = await prisma.changeRequest.create({
      data: {
        departmentId: award.employee.departmentId,
        employeeId: award.employee.id,
        entityType: "AWARD",
        entityId: award.id,
        action: "DELETE",
        status: "PENDING",
        oldValues: { title: award.title, issuer: award.issuer, givenAt: award.givenAt } as Prisma.InputJsonValue,
        newValues: Prisma.DbNull,
        note: parsed.data.reason,
        submittedName: parsed.data.submittedName,
        submittedEmail: parsed.data.submittedEmail,
        ipHash,
      },
      select: { id: true },
    });

    /* ✅ NEW: realtime emit (delete request) */
    const actor = parsed.data.submittedEmail ?? parsed.data.submittedName ?? "public";
    const payload: ApprovalEvent = {
      type: "deleted",
      entity: "award",
      approvalId: cr.id,
      departmentId: award.employee.departmentId,
      employeeId: award.employee.id,
      targetId: award.id,
      title: award.title ?? "AWARD DELETE REQUEST",
      occurredAt: null,
      givenAt: award.givenAt?.toISOString() ?? null,
      actorId: actor,
      when: new Date().toISOString(),
    };
    await pusherServer.trigger(
      `dept-${award.employee.departmentId}-approvals`,
      "approval:event",
      payload
    );

    return NextResponse.json({ ok: true, requestId: cr.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
