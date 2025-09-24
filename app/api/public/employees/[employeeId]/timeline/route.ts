// app/api/public/employees/[employeeId]/timeline/route.ts
import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";
import { EmploymentEventType } from "@prisma/client";

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

function parseDetails(details: string | null | undefined) {
  const raw = (details ?? "").trim();
  if (!raw) return { title: "", description: "", attachment: null as string | null };
  try {
    const obj = JSON.parse(raw);
    return {
      title: (obj?.title ?? "").toString(),
      description: (obj?.description ?? "").toString(),
      attachment: obj?.attachment ? String(obj.attachment) : null,
    };
  } catch {
    // fallback to legacy "Title:/Notes:/Attachment:" pattern if any
    const titleMatch = raw.match(/Title:\s*([^\n]+)/i);
    const notesMatch = raw.match(/Notes:\s*([\s\S]*?)(?:\n|$)/i);
    const attachMatch = raw.match(/Attachment:\s*([^\n]+)/i);
    return {
      title: titleMatch?.[1]?.trim() ?? raw,  // last resort: whole string
      description: notesMatch?.[1]?.trim() ?? "",
      attachment: attachMatch?.[1]?.trim() || null,
    };
  }
}

export async function GET(_: Request, { params }: { params: { employeeId: string } }) {
  try {
    const { employeeId } = params;

    const [events, awards] = await Promise.all([
      prismadb.employmentEvent.findMany({
        where: { employeeId },
        orderBy: { occurredAt: "desc" },
        select: { id: true, type: true, details: true, occurredAt: true },
      }),
      prismadb.award.findMany({
        where: { employeeId },
        orderBy: { givenAt: "desc" },
        select: { id: true, title: true, description: true, fileUrl: true, thumbnail: true, tags: true, givenAt: true },
      }),
    ]);

    const mappedEvents = events.map(e => {
      const parsed = parseDetails(e.details);
      return {
        id: e.id,
        type: enumToUi(e.type),
        title: parsed.title,
        description: parsed.description,
        date: e.occurredAt.toISOString().slice(0,10),
        attachment: parsed.attachment,
      };
    });

    const mappedAwards = awards.map(a => ({
      id: a.id,
      type: "AWARD" as const,
      title: a.title,
      description: a.description ?? "",
      date: a.givenAt.toISOString().slice(0,10),
      attachment: a.fileUrl ?? null,
      thumbnail: a.thumbnail ?? null,
      tags: a.tags ?? [],
    }));

    const timeline = [...mappedEvents, ...mappedAwards]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json(timeline);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch timeline" }, { status: 500 });
  }
}
