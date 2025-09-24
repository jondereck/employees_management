// app/api/public/employees/[employeeId]/awards/request-create/route.ts
import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const DateLike = z.union([
  z.string().datetime(),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),        // 2000-03-28
  z.string().regex(/^\d{2}[-/]\d{2}[-/]\d{4}$/),  // 03-28-2000 or 03/28/2000
]);

const CreateAward = z.object({
  title: z.string().min(1),
  issuer: z.string().optional(),
  givenAt: DateLike,
  description: z.string().optional(),
  fileUrl: z.string().url().optional(),
  thumbnail: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
  note: z.string().optional(),
  submittedName: z.string().optional(),
  submittedEmail: z.string().email().optional(),
});

function toISO(raw: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(raw + "T00:00:00.000Z").toISOString();
  const m = raw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (m) return new Date(`${m[3]}-${m[1]}-${m[2]}T00:00:00.000Z`).toISOString();
  return new Date(raw).toISOString();
}

export async function POST(req: Request, { params }: { params: { employeeId: string } }) {
  try {
    const body = await req.json();
    const parsed = CreateAward.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

    const emp = await prismadb.employee.findUnique({
      where: { id: params.employeeId },
      select: { id: true, departmentId: true, publicEnabled: true },
    });
    if (!emp?.publicEnabled) {
      return NextResponse.json({ error: "Public suggestions disabled" }, { status: 403 });
    }

    const iso = toISO(parsed.data.givenAt);

    await prismadb.changeRequest.create({
      data: {
        departmentId: emp.departmentId,
        employeeId: emp.id,
        entityType: "AWARD",
        entityId: null,
        action: "CREATE",
        status: "PENDING",
        newValues: {
          title: parsed.data.title,
          issuer: parsed.data.issuer ?? null,
          givenAt: iso,
          description: parsed.data.description ?? null,
          fileUrl: parsed.data.fileUrl ?? null,
          thumbnail: parsed.data.thumbnail ?? null,
          tags: parsed.data.tags ?? [],
        } as Prisma.InputJsonValue,
        note: parsed.data.note,
        submittedName: parsed.data.submittedName,
        submittedEmail: parsed.data.submittedEmail,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[PUBLIC_AWARD_CREATE]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
