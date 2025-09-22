import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import prismadb from "@/lib/prismadb";

const Body = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().trim().optional(),
  // client sends `date` (string or Date) -> map to givenAt
  date: z.union([z.string(), z.date()]).transform((v) => new Date(v)),
  // The following fields do NOT exist in Prisma model; ignore safely:
  issuer: z.string().optional(),
  thumbnail: z.string().optional(),
  fileUrl: z.string().optional(),
  tags: z.array(z.string()).optional(),
}).strict(); // ignore unknowns

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
        givenAt: data.date, // map to Prisma field
      },
    });

    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Invalid body", issues: err.issues }, { status: 400 });
    }
    if (err?.code === "P2021") {
      return NextResponse.json(
        { error: "Awards table not found (setup in progress)." },
        { status: 503 }
      );
    }
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
