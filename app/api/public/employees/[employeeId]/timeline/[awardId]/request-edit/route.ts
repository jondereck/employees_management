import { NextResponse } from "next/server";
import prisma from "@/lib/prismadb";
import { z } from "zod";
import { hashIp } from "@/lib/hash-ip";
import { Prisma } from "@prisma/client";

const EditAwardSchema = z.object({
  title: z.string().min(1).max(150).optional(),
  issuer: z.string().max(150).optional().nullable(),
  givenAt: z.string().datetime().optional(),
  description: z.string().max(1000).optional().nullable(),
  fileUrl: z.string().url().optional().nullable(),
  thumbnail: z.string().url().optional().nullable(),
  tags: z.array(z.string().min(1).max(30)).max(8).optional(),
  note: z.string().max(500).optional(),
  submittedName: z.string().max(120).optional(),
  submittedEmail: z.string().email().optional(),
});

export async function POST(req: Request, { params }: { params: { employeeId: string; awardId: string } }) {
  try {
    const body = await req.json();
    const parsed = EditAwardSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

    const award = await prisma.award.findFirst({
      where: { id: params.awardId, employeeId: params.employeeId, deletedAt: null },
      select: {
        id: true, employeeId: true, title: true, issuer: true, givenAt: true,
        description: true, fileUrl: true, thumbnail: true, tags: true,
        employee: { select: { departmentId: true, publicEnabled: true } },
      },
    });
    if (!award || !award.employee.publicEnabled) {
      return NextResponse.json({ error: "Not available for public edits" }, { status: 404 });
    }

    const candidate = parsed.data;
    const newValues = Object.fromEntries(Object.entries(candidate).filter(([,v]) => v !== undefined));
    if (Object.keys(newValues).length === 0) {
      return NextResponse.json({ error: "No changes provided" }, { status: 400 });
    }

    const oldValues = {
      title: award.title,
      issuer: award.issuer,
      givenAt: award.givenAt,
      description: award.description,
      fileUrl: award.fileUrl,
      thumbnail: award.thumbnail,
      tags: award.tags,
    };

    const ipHash = hashIp(req.headers.get("x-forwarded-for") || "0.0.0.0");
    const cr = await prisma.changeRequest.create({
      data: {
        departmentId: award.employee.departmentId,
        employeeId: award.employeeId,
        entityType: "AWARD",
        entityId: award.id,
        action: "UPDATE",
        status: "PENDING",
          oldValues: { title: award.title, issuer: award.issuer, givenAt: award.givenAt } as Prisma.InputJsonValue,
          newValues: newValues as Prisma.InputJsonValue,
        note: candidate.note,
        submittedName: candidate.submittedName,
        submittedEmail: candidate.submittedEmail,
        ipHash,
      },
    });

    // TODO: notify admins

    return NextResponse.json({ ok: true, requestId: cr.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
