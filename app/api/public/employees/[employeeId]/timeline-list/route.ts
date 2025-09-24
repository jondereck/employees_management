import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";
import type { EmploymentEventType } from "@prisma/client";

function mapType(t: EmploymentEventType) {
  switch (t) {
    case "HIRED": return "HIRED";
    case "PROMOTED": return "PROMOTION";
    case "TRANSFERRED": return "TRANSFER";
    case "AWARDED": return "AWARD";
    case "TERMINATED": return "SEPARATION";
    case "REASSIGNED": return "TRANSFER";
    case "CONTRACT_RENEWAL": return "PROMOTION";
    default: return "TRAINING";
  }
}

function splitDetails(details?: string | null) {
  if (!details) return { title: "Event", description: null as string | null };
  const [first, ...rest] = details.split(" — ");
  return { title: first || "Event", description: rest.length ? rest.join(" — ") : null };
}

export async function GET(_req: Request, { params }: { params: { employeeId: string } }) {
  const emp = await prismadb.employee.findUnique({
    where: { id: params.employeeId },
    select: { publicEnabled: true },
  });
  if (!emp?.publicEnabled) return NextResponse.json([]);

  const rows = await prismadb.employmentEvent.findMany({
    where: { employeeId: params.employeeId /*, deletedAt: null */ },
    orderBy: { occurredAt: "desc" },
    select: { id: true, type: true, details: true, occurredAt: true },
  });

  const data = rows.map(r => {
    const { title, description } = splitDetails(r.details);
    return {
      id: r.id,
      type: mapType(r.type),             // your display bucket
      occurredAt: r.occurredAt.toISOString(),  // 👈 key name expected by the UI
      details: description,              // or merge title+description if you prefer
    };
  });

  return NextResponse.json(data);
}
