import { NextResponse } from "next/server";
import { z } from "zod";
import prismadb from "@/lib/prismadb"; // your existing prisma helper
import { utcToZonedTime } from "date-fns-tz";
import { parse, isValid, format } from "date-fns";

const UUID_STR =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";



const BodySchema = z.object({
  idType: z.enum(["employeeId", "employeeNo"]).default("employeeId"),
  // rows come from the client after CSV+mapping
  rows: z.array(z.object({
    idRaw: z.string().optional(), // original text containing the ID (if any)
    id: z.string().optional(), // extracted id (if already parsed client-side)
    timestamp: z.string().optional(), // full ISO/datetime string if provided
    date: z.string().optional(), // like 2025-09-10 or mm/dd/yyyy
    time: z.string().optional(), // 13:45:27 or with am/pm
    source: z.string().optional(),
  })),
  // optional custom regex as a string: must contain a capturing group for ID
  regex: z.string().optional(),
});


const PH_TZ = "Asia/Manila";

// Try multiple patterns (US/EU/ISO), with/without seconds, 12h/24h
const CANDIDATE_PATTERNS = [
  "yyyy-MM-dd'T'HH:mm:ssXXX",
  "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
  "yyyy-MM-dd HH:mm:ss",
  "yyyy/MM/dd HH:mm:ss",
  "yyyy-MM-dd HH:mm",
  "MM/dd/yyyy HH:mm:ss",
  "MM/dd/yyyy HH:mm",
  "M/d/yyyy h:mm:ss a",
  "M/d/yyyy h:mm a",
  "dd/MM/yyyy HH:mm:ss",
  "d/M/yyyy H:mm",
  "MMM d, yyyy h:mm:ss a",
  "MMM d, yyyy h:mm a",
  "yyyy-MM-dd",
  "MM/dd/yyyy",
  "dd/MM/yyyy",
  "H:mm:ss",
  "h:mm:ss a",
  "H:mm",
  "h:mm a",
];

function parseWithPatterns(input?: string): Date | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;

  // epoch seconds / millis
  if (/^\d{10}$/.test(s)) return new Date(Number(s) * 1000);
  if (/^\d{13}$/.test(s)) return new Date(Number(s));

  for (const p of CANDIDATE_PATTERNS) {
    const d = parse(s, p, new Date());
    if (isValid(d)) return d;
  }

  // native Date() as last resort
  const d2 = new Date(s);
  if (isValid(d2)) return d2;

  return null;
}

function safeFormat(d: Date | null, fmt: string) {
  if (!d || !isValid(d)) return "";
  try {
    return format(d, fmt);
  } catch {
    return "";
  }
}
// Prefer date+time → timestamp → date
function toDateTime(date?: string, time?: string, timestamp?: string) {
  let raw: Date | null = null;

  if (date && time) {
    // Try a couple of join styles (CSV often has commas)
    const candidates = [
      `${date} ${time}`,
      `${date}T${time}`,
      `${date}, ${time}`,
    ];
    for (const c of candidates) {
      raw = parseWithPatterns(c);
      if (raw) break;
    }
  }

  if (!raw && timestamp) raw = parseWithPatterns(timestamp);
  if (!raw && date) raw = parseWithPatterns(date);

  if (!raw) {
    return { dateStr: "", timeStr: "", iso: "" };
  }

  const zoned = utcToZonedTime(raw, PH_TZ);
  return {
    dateStr: safeFormat(zoned, "yyyy-MM-dd"),
    timeStr: safeFormat(zoned, "HH:mm:ss"),
    iso: isValid(zoned) ? zoned.toISOString() : "",
  };
}

export async function POST(req: Request) {
  try {
    const body = BodySchema.parse(await req.json());
    const customRe = body.regex ? new RegExp(body.regex) : undefined;


    // 1) Collect IDs
    const ids: string[] = [];
    const prepared = body.rows.map((r) => {
      const finalId = (r.id ?? r.idRaw ?? "").toString().trim();

      // --- URL-with-two-UUIDs fix: prefer /employee/<uuid> ---
      const UUID_ONLY_RE = new RegExp(`^${UUID_STR}$`, "i");
      let useId = finalId;

      // If it's NOT a bare UUID and looks like a URL containing /employee/<uuid>,
      // extract the employee UUID (the second one in your case).
      if (useId && !UUID_ONLY_RE.test(useId) && /employee\//i.test(useId)) {
        const m = useId.match(
          new RegExp(`(?:^|/)employee/(${UUID_STR})(?:$|[/?#])`, "i")
        );
        if (m?.[1]) useId = m[1];
      }

      const dt = toDateTime(
        r.date?.toString().trim(),
        r.time?.toString().trim(),
        r.timestamp?.toString().trim()
      );

      return { id: useId, dt, source: r.source ?? "csv" };
    }).filter(r => r.id);



    for (const r of prepared) ids.push(r.id);




    // 2) Load employees in one go
    let employees: any[] = [];
    if (ids.length) {
      if (body.idType === "employeeId") {
        employees = await prismadb.employee.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            position: true,
            offices: { select: { name: true } },
            employeeNo: true,
          },
        });
      } else {
        employees = await prismadb.employee.findMany({
          where: { employeeNo: { in: ids } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            position: true,
            offices: { select: { name: true } },
            employeeNo: true,
          },
        });
      }
    }


    const key = body.idType === "employeeId" ? "id" : "employeeNo";
    const map = new Map<string, any>();
    for (const e of employees) map.set(e[key], e);
    const foundSet = new Set(employees.map(e => e[key]));
    const sampleMissing = ids.filter(id => !foundSet.has(id)).slice(0, 10);


    // 3) Build output rows
    const out = prepared.map((r) => {
      const e = map.get(r.id);
      return {
        employeeId: e?.id ?? "",
        employeeNo: e?.employeeNo ?? "",
        name: e ? `${e.lastName}, ${e.firstName}` : "(Unmatched)",
        office: e?.offices?.name ?? "",
        position: e?.position ?? "",
        date: r.dt.dateStr,
        time: r.dt.timeStr,
        source: r.source,
        idMatched: !!e,
        id: r.id,
      };
    });

    return NextResponse.json({
      ok: true,
      rows: out,
      debug: {
        idType: body.idType,
        idsRequested: ids.length,
        idsFound: employees.length,
        sampleMissing, // <— check these in the response
        dbUrlHost: process.env.DATABASE_URL?.split("@")[1]?.split("/")[0], // quick hint which DB you're on
      },
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }
}

