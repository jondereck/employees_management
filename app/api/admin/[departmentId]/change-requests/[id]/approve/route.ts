import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prismadb";
import type { EmploymentEventType } from "@prisma/client";

// ⬇️ add this import
import { pusherServer } from "@/lib/pusher";

/* ---------------- helpers ---------------- */

type CanonicalAction = "CREATE" | "UPDATE" | "DELETE";

function normalizeAction(a: unknown): CanonicalAction {
  const s = String(a);
  if (s === "EDIT") return "UPDATE"; // tolerate old values
  if (s === "CREATE" || s === "UPDATE" || s === "DELETE") return s;
  return "UPDATE";
}

function uiToDbEventType(ui?: string | null): EmploymentEventType | undefined {
  if (!ui) return undefined;
  const u = ui.toUpperCase();
  const map: Record<string, EmploymentEventType> = {
    HIRED: "HIRED",
    PROMOTION: "PROMOTED",
    PROMOTED: "PROMOTED",
    TRANSFER: "TRANSFERRED",
    TRANSFERRED: "TRANSFERRED",
    TRAINING: "OTHER",
    REASSIGNED: "REASSIGNED",
    AWARD: "AWARDED",
    RECOGNITION: "AWARDED",
    "CONTRACT RENEWAL": "CONTRACT_RENEWAL",
    CONTRACT_RENEWAL: "CONTRACT_RENEWAL",
    TERMINATED: "TERMINATED",
    SEPARATION: "TERMINATED",
    OTHER: "OTHER",
  };
  return map[u];
}

function toDate(v: any) {
  if (!v) return undefined;
  const s = String(v);
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00.000Z` : s;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function normalizeDetails(v: any): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  if (typeof v === "string") return v;
  try { return JSON.stringify(v); } catch { return String(v); }
}

/* ---------------- realtime payload ---------------- */

type RealtimeApprovalPayload = {
  type: "created" | "updated" | "deleted";
  entity: "timeline" | "award";
  approvalId: string;
  departmentId: string;
  employeeId: string;
  targetId?: string;
  title?: string | null;
  occurredAt?: string | null;
  givenAt?: string | null;
  actorId: string;
  when: string;
};

/* ---------------- route ---------------- */

export async function POST(
  _req: Request,
  { params }: { params: { departmentId: string; id: string } }
) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only approve PENDING changes for the same department
  const cr = await prisma.changeRequest.findFirst({
    where: { id: params.id, departmentId: params.departmentId, status: "PENDING" },
  });
  if (!cr) return NextResponse.json({ error: "Not found or already processed" }, { status: 404 });

  const action = normalizeAction(cr.action);
  const nv = (cr.newValues ?? {}) as any;

  // We will fill this inside the transaction and emit AFTER success
  let rt: RealtimeApprovalPayload | undefined;

  try {
    await prisma.$transaction(async (tx) => {
      if (cr.entityType === "AWARD") {
        if (action === "CREATE") {
          const created = await tx.award.create({
            data: {
              employeeId: cr.employeeId,
              title: nv.title,
              issuer: nv.issuer ?? null,
              givenAt: toDate(nv.givenAt)!,
              description: nv.description ?? null,
              fileUrl: nv.fileUrl ?? null,
              thumbnail: nv.thumbnail ?? null,
              tags: Array.isArray(nv.tags) ? nv.tags : [],
            },
            select: { id: true, title: true, givenAt: true },
          });

          rt = {
            type: "created",
            entity: "award",
            approvalId: cr.id,
            departmentId: cr.departmentId,
            employeeId: cr.employeeId,
            targetId: created.id,
            title: created.title ?? null,
            givenAt: created.givenAt?.toISOString() ?? null,
            actorId: userId,
            when: new Date().toISOString(),
          };
        } else if (action === "UPDATE") {
          const aw = await tx.award.findUnique({
            where: { id: cr.entityId! },
            select: { id: true, employeeId: true },
          });
          if (!aw || aw.employeeId !== cr.employeeId) {
            throw new Error("Award not found for employee");
          }
          const patch: any = {};
          if (nv.title        !== undefined) patch.title = nv.title;
          if (nv.issuer       !== undefined) patch.issuer = nv.issuer ?? null;
          if (nv.givenAt      !== undefined) patch.givenAt = toDate(nv.givenAt);
          if (nv.description  !== undefined) patch.description = nv.description ?? null;
          if (nv.fileUrl      !== undefined) patch.fileUrl = nv.fileUrl ?? null;
          if (nv.thumbnail    !== undefined) patch.thumbnail = nv.thumbnail ?? null;
          if (nv.tags         !== undefined) patch.tags = Array.isArray(nv.tags) ? nv.tags : [];

          const updated = await tx.award.update({
            where: { id: aw.id },
            data: patch,
            select: { id: true, title: true, givenAt: true },
          });

          rt = {
            type: "updated",
            entity: "award",
            approvalId: cr.id,
            departmentId: cr.departmentId,
            employeeId: cr.employeeId,
            targetId: updated.id,
            title: updated.title ?? null,
            givenAt: updated.givenAt?.toISOString() ?? null,
            actorId: userId,
            when: new Date().toISOString(),
          };
        } else if (action === "DELETE") {
          const aw = await tx.award.findUnique({
            where: { id: cr.entityId! },
            select: { id: true, employeeId: true, title: true, givenAt: true },
          });
          if (!aw || aw.employeeId !== cr.employeeId) {
            throw new Error("Award not found for employee");
          }
          await tx.award.delete({ where: { id: aw.id } });

          rt = {
            type: "deleted",
            entity: "award",
            approvalId: cr.id,
            departmentId: cr.departmentId,
            employeeId: cr.employeeId,
            targetId: aw.id,
            title: aw.title ?? null,
            givenAt: aw.givenAt?.toISOString() ?? null,
            actorId: userId,
            when: new Date().toISOString(),
          };
        }
      }

      if (cr.entityType === "TIMELINE") {
        if (action === "CREATE") {
          const created = await tx.employmentEvent.create({
            data: {
              employeeId: cr.employeeId,
              type: uiToDbEventType(nv.type)!,          // map UI → Prisma enum
              occurredAt: toDate(nv.occurredAt)!,
              details: normalizeDetails(nv.details) ?? null,
            },
            select: { id: true, type: true, occurredAt: true },
          });

          rt = {
            type: "created",
            entity: "timeline",
            approvalId: cr.id,
            departmentId: cr.departmentId,
            employeeId: cr.employeeId,
            targetId: created.id,
            title: created.type, // use enum as label
            occurredAt: created.occurredAt?.toISOString() ?? null,
            actorId: userId,
            when: new Date().toISOString(),
          };
        } else if (action === "UPDATE") {
          const ev = await tx.employmentEvent.findUnique({
            where: { id: cr.entityId! },
            select: { id: true, employeeId: true },
          });
          if (!ev || ev.employeeId !== cr.employeeId) {
            throw new Error("EmploymentEvent not found for employee");
          }
          const patch: any = {};
          if (nv.type       !== undefined) patch.type = uiToDbEventType(nv.type);
          if (nv.occurredAt !== undefined) patch.occurredAt = toDate(nv.occurredAt);
          if (nv.details    !== undefined) patch.details = normalizeDetails(nv.details);

          const updated = await tx.employmentEvent.update({
            where: { id: ev.id },
            data: patch,
            select: { id: true, type: true, occurredAt: true },
          });

          rt = {
            type: "updated",
            entity: "timeline",
            approvalId: cr.id,
            departmentId: cr.departmentId,
            employeeId: cr.employeeId,
            targetId: updated.id,
            title: updated.type,
            occurredAt: updated.occurredAt?.toISOString() ?? null,
            actorId: userId,
            when: new Date().toISOString(),
          };
        } else if (action === "DELETE") {
          const ev = await tx.employmentEvent.findUnique({
            where: { id: cr.entityId! },
            select: { id: true, employeeId: true, type: true, occurredAt: true },
          });
          if (!ev || ev.employeeId !== cr.employeeId) {
            throw new Error("EmploymentEvent not found for employee");
          }
          await tx.employmentEvent.delete({ where: { id: ev.id } });

          rt = {
            type: "deleted",
            entity: "timeline",
            approvalId: cr.id,
            departmentId: cr.departmentId,
            employeeId: cr.employeeId,
            targetId: ev.id,
            title: ev.type,
            occurredAt: ev.occurredAt?.toISOString() ?? null,
            actorId: userId,
            when: new Date().toISOString(),
          };
        }
      }

      await tx.changeRequest.update({
        where: { id: cr.id },
        data: { status: "APPROVED", reviewedAt: new Date(), approvedById: userId },
      });
    });

    await pusherServer.trigger(
  `dept-${cr.departmentId}-approvals`,
  "approval:resolved",
  { approvalId: cr.id, departmentId: cr.departmentId, status: "APPROVED" }
);

    // ⬇️ Emit AFTER the transaction succeeded
   if (rt) {
  await pusherServer.trigger(
    `dept-${rt.departmentId}-approvals`,
    "approval:event",
    rt
  );
}

    return NextResponse.json({ ok: true, status: "APPROVED" });
  } catch (e: any) {
    console.error("Approve failed:", e);
    return NextResponse.json({ error: e?.message || "Approve failed" }, { status: 500 });
  }
}
