// app/api/public/employees/[employeeId]/timeline/route.ts
import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";
import { EmploymentEventType } from "@prisma/client";

const enumToUi = (t: EmploymentEventType) => {
  switch (t) {
    case "HIRED":      return "HIRED";
    case "PROMOTED":   return "PROMOTION";
    case "TRANSFERRED":return "TRANSFER";
    case "AWARDED":    return "AWARD";
    case "TERMINATED": return "SEPARATION";
    default:           return "OTHER"; // ✅ safer default
  }
};

function safeJSON(raw: string | null | undefined): any {
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

function parseTags(input: any): string[] {
  if (Array.isArray(input)) return input.map((t) => String(t).trim()).filter(Boolean);
  if (typeof input === "string") return input.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

function parseDetails(details: string | null | undefined) {
  const obj = safeJSON(details);

  // Base fields
  const title = (obj?.title ?? "").toString();
  const description = (obj?.description ?? "").toString();
  const attachment = obj?.attachment ? String(obj.attachment).trim() : null;

  // Award-like extra fields
  const issuer = obj?.issuer ? String(obj.issuer).trim() : null;
  const thumbnail = obj?.thumbnail ? String(obj.thumbnail).trim() : null;
  const tags = parseTags(obj?.tags);

  // Legacy text fallback (very old “Title — description” or “Title:/Notes:/Attachment:” formats)
  if (!title && typeof details === "string") {
    const raw = details.trim();
    if (raw) {
      const titleMatch = raw.match(/Title:\s*([^\n]+)/i);
      const notesMatch = raw.match(/Notes:\s*([\s\S]*?)(?:\n|$)/i);
      const attachMatch = raw.match(/Attachment:\s*([^\n]+)/i);
      const legacyTitle = titleMatch?.[1]?.trim() ?? raw.split(" — ")[0] ?? "";
      const legacyDesc =
        notesMatch?.[1]?.trim() ?? raw.split(" — ").slice(1).join(" — ") ?? "";
      const legacyAttach = attachMatch?.[1]?.trim() || null;
      return {
        title: legacyTitle,
        description: legacyDesc,
        attachment: legacyAttach,
        issuer: null,
        thumbnail: null,
        tags: [],
      };
    }
  }

  return { title, description, attachment, issuer, thumbnail, tags };
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
        // ✅ include issuer
        select: { id: true, title: true, description: true, issuer: true, fileUrl: true, thumbnail: true, tags: true, givenAt: true },
      }),
    ]);

    const mappedEvents = events.map(e => {
      const d = parseDetails(e.details);
      const ymd = e.occurredAt.toISOString().slice(0, 10);
      return {
        id: e.id,
        type: enumToUi(e.type),    // UI label
        occurredAt: ymd,           // ✅ add occurredAt for UI
        date: ymd,                 // back-compat with old clients
        title: d.title,
        description: d.description,
        attachment: d.attachment,
        issuer: d.issuer,          // ✅ now present from details
        thumbnail: d.thumbnail,    // ✅ now present from details
        tags: d.tags,              // ✅ now present from details
        origin: "event" as const,
      };
    });

    const mappedAwards = awards.map(a => {
      const ymd = a.givenAt.toISOString().slice(0, 10);
      return {
        id: a.id,
        type: "AWARD" as const,
        occurredAt: ymd,
        date: ymd, // back-compat
        title: a.title,
        description: a.description ?? "",
        attachment: a.fileUrl ?? null,
        issuer: a.issuer ?? null,        // ✅ included
        thumbnail: a.thumbnail ?? null,
        tags: a.tags ?? [],
        origin: "award" as const,
      };
    });

    const timeline = [...mappedEvents, ...mappedAwards]
      .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));

    // return as an array (same as before)
    return NextResponse.json(timeline);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch timeline" }, { status: 500 });
  }
}
