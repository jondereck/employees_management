// app/api/admin/employees/[employeeId]/awards/route.ts
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import prismadb from "@/lib/prismadb";

const OptionalString = z.union([z.string(), z.null(), z.undefined()]).transform(v => {
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? undefined : t;
  }
  return undefined;
});

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

const TagsInput = z.union([
  z.array(z.string()),
  z.string(),
  z.null(),
  z.undefined(),
]).transform(v => {
  if (Array.isArray(v)) return v.map(t => t.trim()).filter(Boolean);
  if (typeof v === "string") return v.split(",").map(t => t.trim()).filter(Boolean);
  return [];
});

const Body = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: OptionalString,
  date: DateInput,
  issuer: OptionalString,
  thumbnail: OptionalString,
  fileUrl: OptionalString,
  tags: TagsInput,
}).strict();

export async function POST(
  req: Request,
  { params }: { params: { employeeId: string } }
) {
  try {
    const json = await req.json();
    const data = Body.parse(json);

    const row = await prismadb.award.create({
      data: {
        employeeId: params.employeeId,
        title: data.title,
        description: data.description ?? null,
        issuer: data.issuer ?? null,
        thumbnail: data.thumbnail ?? null,
        fileUrl: data.fileUrl ?? null,
        tags: data.tags,                 // String[]
        givenAt: data.date,
      },
    });

    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Invalid body", issues: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
