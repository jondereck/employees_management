import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";
import type { EmploymentEventType } from "@prisma/client";

// DB enum -> client enum
function mapType(t: EmploymentEventType) {
  switch (t) {
    case "HIRED": return "HIRED";
    case "PROMOTED": return "PROMOTION";
    case "TRANSFERRED": return "TRANSFER";
    case "AWARDED": return "AWARD";
    case "TERMINATED": return "SEPARATION";
    case "REASSIGNED": return "TRANSFER";        // choose TRANSFER (or TRAINING if you prefer)
    case "CONTRACT_RENEWAL": return "PROMOTION"; // closest display bucket
    case "OTHER": return "TRAINING";             // display as TRAINING
  }
}

// we stored details as "title — description" in the POST route; split them back
function splitDetails(details?: string | null) {
  if (!details) return { title: "Event", description: null as string | null };
  const [first, ...rest] = details.split(" — ");
  return { title: first || "Event", description: rest.length ? rest.join(" — ") : null };
}

export async function GET(
  _req: Request,
  { params }: { params: { employeeId: string } }
) {
  const emp = await prismadb.employee.findUnique({
    where: { id: params.employeeId },
    select: { publicEnabled: true },
  });
  if (!emp?.publicEnabled) return NextResponse.json([], { status: 200 });

  const rows = await prismadb.employmentEvent.findMany({
    where: { employeeId: params.employeeId },
    orderBy: { occurredAt: "desc" },
  });

  const data = rows.map(r => {
    const { title, description } = splitDetails(r.details);
    return {
      id: r.id,
      type: mapType(r.type) as
        | "HIRED" | "PROMOTION" | "TRANSFER" | "TRAINING" | "AWARD" | "RECOGNITION" | "SEPARATION",
      title,
      description,
      date: r.occurredAt.toISOString(),
      attachment: null, // not in schema
    };
  });

  return NextResponse.json(data, { status: 200 });
}
