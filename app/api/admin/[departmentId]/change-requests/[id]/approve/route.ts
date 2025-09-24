import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prismadb";

export async function POST(_req: Request, { params }: { params: { departmentId: string; id: string } }) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cr = await prisma.changeRequest.findFirst({ where: { id: params.id, departmentId: params.departmentId, status: "PENDING" } });
  if (!cr) return NextResponse.json({ error: "Not found or already processed" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    if (cr.entityType === "AWARD") {
      if (cr.action === "CREATE") {
        const data = (cr.newValues ?? {}) as any;
        await tx.award.create({
          data: {
            employeeId: cr.employeeId,
            title: data.title,
            issuer: data.issuer ?? null,
            givenAt: new Date(data.givenAt),
            description: data.description ?? null,
            fileUrl: data.fileUrl ?? null,
            thumbnail: data.thumbnail ?? null,
            tags: Array.isArray(data.tags) ? data.tags : [],
          },
        });
      } else if (cr.action === "UPDATE") {
        await tx.award.update({
          where: { id: cr.entityId! },
          data: cr.newValues as any,
        });
      } else if (cr.action === "DELETE") {
        await tx.award.update({
          where: { id: cr.entityId! },
          data: { deletedAt: new Date() },
        });
      }
    } else if (cr.entityType === "TIMELINE") {
      if (cr.action === "CREATE") {
        const data = (cr.newValues ?? {}) as any;
        await tx.employmentEvent.create({
          data: {
            employeeId: cr.employeeId,
            type: data.type,                // must be one of EmploymentEventType
            occurredAt: new Date(data.occurredAt),
            details: data.details ?? null,
          },
        });
      } else if (cr.action === "UPDATE") {
        await tx.employmentEvent.update({
          where: { id: cr.entityId! },
          data: cr.newValues as any,
        });
      } else if (cr.action === "DELETE") {
        await tx.employmentEvent.update({
          where: { id: cr.entityId! },
          data: { deletedAt: new Date() },
        });
      }
    }

    await tx.changeRequest.update({
      where: { id: cr.id },
      data: { status: "APPROVED", reviewedAt: new Date(), approvedById: userId },
    });
  });

  // TODO: notify requester (email) and admins if needed

  return NextResponse.json({ ok: true });
}
