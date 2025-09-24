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
    case "RECOGNITION": return "AWARDED";   // or OTHER
    case "SEPARATION": return "TERMINATED";
    case "TRAINING": return "OTHER";
    default: return "OTHER";
  }
};

const enumToUi = (t: EmploymentEventType) => {
  switch (t) {
    case "HIRED": return "HIRED";
    case "PROMOTED": return "PROMOTION";
    case "TRANSFERRED": return "TRANSFER";
    case "AWARDED": return "AWARD";
    case "TERMINATED": return "SEPARATION";
    default: return "TRAINING";
  }
};

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { employeeId, eventId } = params;
    if (!employeeId || !eventId) {
      return new NextResponse("employeeId & eventId required", { status: 400 });
    }

    const body = await req.json();
    const typeRaw = String(body.type ?? "");
    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();
    const date = String(body.date ?? "").slice(0, 10); // yyyy-mm-dd
    const attachment = String(body.attachment ?? "").trim();

    if (!title) return new NextResponse("Title required", { status: 400 });
    if (!date)  return new NextResponse("Date required", { status: 400 });

    const occurredAt = new Date(date);
    if (Number.isNaN(occurredAt.getTime())) {
      return new NextResponse("Invalid date", { status: 400 });
    }

    // Detect source table by id
    const [eventRow, awardRow] = await Promise.all([
      prismadb.employmentEvent.findFirst({
        where: { id: eventId, employeeId },
        select: { id: true, type: true },
      }),
      prismadb.award.findFirst({
        where: { id: eventId, employeeId },
        select: { id: true },
      }),
    ]);

    if (eventRow) {
      // Update EmploymentEvent (store UI fields as JSON in `details`)
      const updated = await prismadb.employmentEvent.update({
        where: { id: eventId },
        data: {
          type: typeRaw ? uiToEnum(typeRaw) : eventRow.type,
          occurredAt,
          details: JSON.stringify({
            title,
            description,
            attachment: attachment || null,
          }),
        },
        select: { id: true, type: true, occurredAt: true },
      });

      return NextResponse.json({
        id: updated.id,
        type: enumToUi(updated.type),
        title,
        description,
        date,                            // already yyyy-mm-dd
        attachment: attachment || null,
      });
    }

    if (awardRow) {
      // Update Award (keep issuer/thumbnail/tags as-is)
      const updated = await prismadb.award.update({
        where: { id: eventId },
        data: {
          title,
          description: description || null,
          fileUrl: attachment || null,
          givenAt: occurredAt,
        },
        select: { id: true, title: true, description: true, fileUrl: true, givenAt: true },
      });

      return NextResponse.json({
        id: updated.id,
        type: "AWARD",
        title: updated.title,
        description: updated.description ?? "",
        date: updated.givenAt.toISOString().slice(0, 10),
        attachment: updated.fileUrl ?? null,
      });
    }

    return new NextResponse("Not found", { status: 404 });
  } catch (e: any) {
    return new NextResponse(e?.message ?? "Server error", { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { employeeId, eventId } = params;
    if (!employeeId || !eventId) {
      return new NextResponse("employeeId & eventId required", { status: 400 });
    }

    const [eventRow, awardRow] = await Promise.all([
      prismadb.employmentEvent.findFirst({ where: { id: eventId, employeeId }, select: { id: true } }),
      prismadb.award.findFirst({ where: { id: eventId, employeeId }, select: { id: true } }),
    ]);

    if (eventRow) {
      await prismadb.employmentEvent.delete({ where: { id: eventId } });
      return new NextResponse(null, { status: 204 });
    }
    if (awardRow) {
      await prismadb.award.delete({ where: { id: eventId } });
      return new NextResponse(null, { status: 204 });
    }

    return new NextResponse("Not found", { status: 404 });
  } catch (e: any) {
    return new NextResponse(e?.message ?? "Server error", { status: 500 });
  }
}
