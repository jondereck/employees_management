// app/api/admin/employees/[employeeId]/awards/[awardId]/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import prismadb from "@/lib/prismadb";

type Params = { params: { employeeId: string; awardId: string } };

const OptionalString = z.union([z.string(), z.null(), z.undefined()]).transform(v => {
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? undefined : t;
  }
  return undefined;
});

// accept "YYYY-MM-DD" or ISO
const DateInput = z.preprocess((v) => {
  if (v instanceof Date) return v;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return undefined;
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00` : s;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}, z.date());

const TagsInput = z.union([z.array(z.string()), z.string(), z.null(), z.undefined()])
  .transform(v => {
    if (Array.isArray(v)) return v.map(t => t.trim()).filter(Boolean);
    if (typeof v === "string") return v.split(",").map(t => t.trim()).filter(Boolean);
    return [];
  });

// allow partial updates; only fields present will be written
const PatchBody = z.object({
  title: z.string().trim().min(1).optional(),
  date: DateInput.optional(),
  description: OptionalString,   // → string | undefined
  issuer: OptionalString,
  thumbnail: OptionalString,
  fileUrl: OptionalString,
  tags: TagsInput.optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { employeeId, awardId } = params;
    if (!employeeId || !awardId) {
      return new NextResponse("employeeId & awardId required", { status: 400 });
    }

    const body = await req.json();
    const data = PatchBody.parse(body);

    // ownership
    const found = await prismadb.award.findFirst({
      where: { id: awardId, employeeId },
      select: { id: true },
    });
    if (!found) return new NextResponse("Not found", { status: 404 });

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.date !== undefined) updateData.givenAt = data.date;
    if (data.description !== undefined) updateData.description = data.description ?? null;
    if (data.issuer !== undefined) updateData.issuer = data.issuer ?? null;
    if (data.thumbnail !== undefined) updateData.thumbnail = data.thumbnail ?? null;
    if (data.fileUrl !== undefined) updateData.fileUrl = data.fileUrl ?? null;
    if (data.tags !== undefined) updateData.tags = data.tags;

    if (!Object.keys(updateData).length) {
      return new NextResponse("No fields to update", { status: 400 });
    }

    const updated = await prismadb.award.update({
      where: { id: awardId },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    return new NextResponse(e.message ?? "Server error", { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { employeeId, awardId } = params;
    if (!employeeId || !awardId) {
      return new NextResponse("employeeId & awardId required", { status: 400 });
    }

    const found = await prismadb.award.findFirst({
      where: { id: awardId, employeeId },
      select: { id: true },
    });
    if (!found) return new NextResponse("Not found", { status: 404 });

    await prismadb.award.delete({ where: { id: awardId } });
    return new NextResponse(null, { status: 204 });
  } catch (e: any) {
    return new NextResponse(e.message ?? "Server error", { status: 500 });
  }
}
