import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";
import { EmploymentEventType } from "@prisma/client";

type Params = { params: { employeeId: string; eventId: string } };

const uiToEnum = (t: string): EmploymentEventType => {
  switch (t) {
    case "HIRED": return "HIRED";
    case "PROMOTION": return "PROMOTED";
    case "TRANSFER": return "TRANSFERRED";
    case "AWARD": return "AWARDED";
    case "RECOGNITION": return "AWARDED"; // or "OTHER"
    case "SEPARATION": return "TERMINATED";
    case "TRAINING": return "OTHER"; // or add a new enum in proper path
    default: return "OTHER";
  }
};

const buildDetails = (title?: string, description?: string, attachment?: string) => {
  const lines: string[] = [];
  if (title) lines.push(`Title: ${title}`);
  if (description) lines.push(`Notes: ${description}`);
  if (attachment) lines.push(`Attachment: ${attachment}`);
  return lines.length ? lines.join("\n") : null;
};

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { employeeId, eventId } = params;
    if (!employeeId || !eventId) {
      return new NextResponse("employeeId & eventId required", { status: 400 });
    }

    const body = await req.json();
    // expected from your UI form:
    // { type: "HIRED"|"PROMOTION"|..., title: string, description?: string, date: "yyyy-mm-dd", attachment?: string }
    const typeRaw = (body.type ?? "").toString();
    const title = (body.title ?? "").trim();
    const description = body.description?.trim();
    const date = (body.date ?? "").trim();
    const attachment = body.attachment?.trim();

    if (!typeRaw) return new NextResponse("Type required", { status: 400 });
    if (!title) return new NextResponse("Title required", { status: 400 });
    if (!date) return new NextResponse("Date required", { status: 400 });

    const occurredAt = new Date(date);
    if (isNaN(occurredAt.getTime())) {
      return new NextResponse("Invalid date", { status: 400 });
    }

    const type = uiToEnum(typeRaw);
    const details = buildDetails(title, description, attachment);

    // ownership check
    const found = await prismadb.employmentEvent.findFirst({
      where: { id: eventId, employeeId },
      select: { id: true },
    });
    if (!found) return new NextResponse("Not found", { status: 404 });

    const updated = await prismadb.employmentEvent.update({
      where: { id: eventId },
      data: { type, details, occurredAt },
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    return new NextResponse(e.message ?? "Server error", { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { employeeId, eventId } = params;
    if (!employeeId || !eventId) {
      return new NextResponse("employeeId & eventId required", { status: 400 });
    }

    const found = await prismadb.employmentEvent.findFirst({
      where: { id: eventId, employeeId },
      select: { id: true },
    });
    if (!found) return new NextResponse("Not found", { status: 404 });

    await prismadb.employmentEvent.delete({ where: { id: eventId } });
    return new NextResponse(null, { status: 204 });
  } catch (e: any) {
    return new NextResponse(e.message ?? "Server error", { status: 500 });
  }
}
