import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import prismadb from "@/lib/prismadb";

/** Client -> DB enum mapping */
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
    case "TRAINING": return "OTHER"; // or "REASSIGNED" if you prefer
    case "AWARD": return "AWARDED";
    case "RECOGNITION": return "AWARDED"; // or "OTHER"
    case "SEPARATION": return "TERMINATED";
  }
}

const Body = z.object({
  type: ClientEvent,
  title: z.string().min(1, "Title is required"),
  description: z.string().trim().optional(),
  date: z.union([z.string(), z.date()]).transform((v) => new Date(v)), // -> occurredAt
  // Not in Prisma model; ignore:
  icon: z.string().optional(),
  attachment: z.string().optional(),
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
