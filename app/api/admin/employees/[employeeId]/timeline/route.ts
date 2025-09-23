import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import prismadb from "@/lib/prismadb";



const ClientEvent = z.enum([
  "HIRED",
  "PROMOTION",
  "TRANSFER",
  "TRAINING",
  "AWARD",
  "RECOGNITION",
  "SEPARATION",
]);

function mapToPrismaEnum(t: z.infer<typeof ClientEvent>) {
  switch (t) {
    case "HIRED": return "HIRED";
    case "PROMOTION": return "PROMOTED";
    case "TRANSFER": return "TRANSFERRED";
    case "TRAINING": return "OTHER";         // change if you add TRAINING in DB
    case "AWARD": return "AWARDED";
    case "RECOGNITION": return "AWARDED";    // or "OTHER"
    case "SEPARATION": return "TERMINATED";
  }
}

// helper: optional string that may come as null/undefined/whitespace
const OptionalString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (typeof v === "string") {
      const t = v.trim();
      return t === "" ? undefined : t;
    }
    return undefined; // null/undefined -> undefined
  });

// helper: accept Date | ISO | "YYYY-MM-DD"
const DateInput = z.preprocess((v) => {
  if (v instanceof Date) return v;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return undefined;
    // If it is YYYY-MM-DD, make it local midnight (no timezone surprises)
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00` : s;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}, z.date());

const Body = z.object({
  type: ClientEvent,
  title: z.string().trim().min(1, "Title is required"),
  description: OptionalString,            // ✅ null/"" -> undefined
  date: DateInput,                        // ✅ accepts Date/ISO/YYYY-MM-DD
  // client-only fields: accept but drop them
  icon: OptionalString.optional(),
  attachment: OptionalString.optional(),
}).strict();
export async function POST(
  req: Request,
  { params }: { params: { employeeId: string } }
) {
  try {
    const json = await req.json();
    const data = Body.parse(json);

    const type = mapToPrismaEnum(data.type) as any; // Prisma enum value
    const details = data.description
      ? `${data.title} — ${data.description}`
      : data.title;

    const row = await prismadb.employmentEvent.create({
      data: {
        employeeId: params.employeeId,
        type,
        details,
        occurredAt: data.date,
      },
    });

    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Invalid body", issues: err.issues }, { status: 400 });
    }
    if (err?.code === "P2021") {
      return NextResponse.json(
        { error: "EmploymentEvent table not found (setup in progress)." },
        { status: 503 }
      );
    }
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
