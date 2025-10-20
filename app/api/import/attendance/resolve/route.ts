import { NextResponse } from "next/server";
import { z } from "zod";
import prismadb from "@/lib/prismadb"; // your existing prisma helper
import { utcToZonedTime } from "date-fns-tz";
import { parse, isValid, format } from "date-fns";

const UUID_STR =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";



const BodySchema = z.object({
  departmentId: z.string().min(1, "departmentId is required"),
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

const CATEGORY_KEYS = ["E", "P", "CT_COS", "C", "JO"] as const;
type CategoryKey = typeof CATEGORY_KEYS[number];

const OFFICE_UNKNOWN = "Unassigned / No Office";

function mapEmployeeTypeToCategory(name?: string | null): CategoryKey {
  const normalized = (name || "").toLowerCase();
  if (normalized.includes("elective")) return "E";
  if (normalized.includes("job order") || normalized.includes("job-order") || normalized.includes("joborder") || normalized === "jo") {
    return "JO";
  }
  if (normalized.includes("casual") || normalized.includes("temporary")) return "C";
  if (
    normalized.includes("co-term") ||
    normalized.includes("coterminous") ||
    normalized.includes("co-terminous") ||
    normalized.includes("contract of service") ||
    normalized.includes("contractual") ||
    normalized.includes("cos")
  ) {
    return "CT_COS";
  }
  if (normalized.includes("permanent") || normalized.includes("regular")) return "P";
  return "P";
}

function createEmptyCounts(): Record<CategoryKey, number> {
  return { E: 0, P: 0, CT_COS: 0, C: 0, JO: 0 };
}

function normalizeOfficeName(name?: string | null): string {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : OFFICE_UNKNOWN;
}

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

function hasExplicitTZ(s?: string) {
  if (!s) return false;
  // ISO with Z or explicit offset like +08:00 / -0500
  return /z$/i.test(s) || /[+-]\d{2}:\d{2}$/.test(s) || /[+-]\d{4}$/.test(s);
}

function normalizeDateString(input?: string): string {
  if (!input) return "";
  const s = input.trim();

  // Try a few common calendar-only formats by regex (no Date math)
  // yyyy-MM-dd
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // MM/dd/yyyy or M/d/yyyy
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const mm = m[1].padStart(2, "0");
    const dd = m[2].padStart(2, "0");
    return `${m[3]}-${mm}-${dd}`;
  }

  // dd/MM/yyyy or d/M/yyyy
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    // ambiguous with previous; keep as-is unless you know locale
  }

  // Fallback: last resort using date-fns parse (only for calendar, no TZ output)
  const tryPat = ["yyyy-MM-dd", "MM/dd/yyyy", "M/d/yyyy", "dd/MM/yyyy", "d/M/yyyy"];
  for (const p of tryPat) {
    const d = parse(s, p, new Date());
    if (isValid(d)) return format(d, "yyyy-MM-dd");
  }
  return s; // give up-return raw
}

function normalizeTimeString(input?: string): string {
  if (!input) return "";
  const s = input.trim().toLowerCase();

  // h:mm[:ss] [am|pm]
  let m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (m) {
    let hh = parseInt(m[1], 10);
    const mm = m[2];
    const ss = m[3] ?? "00";
    const ampm = (m[4] || "").toLowerCase();
    if (ampm === "pm" && hh < 12) hh += 12;
    if (ampm === "am" && hh === 12) hh = 0;
    return `${String(hh).padStart(2, "0")}:${mm}:${ss.padStart(2, "0")}`;
  }

  // HH:mm[:ss]
  m = s.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const hh = m[1], mm = m[2], ss = m[3] ?? "00";
    return `${hh}:${mm}:${ss}`;
  }

  return s; // fallback
}

// Prefer Date+Time -> Timestamp. Only convert when timestamp has an explicit TZ.
// Otherwise, treat as Manila wall-clock and DON'T convert.
function toDateTime(date?: string, time?: string, timestamp?: string) {
  // Case A: separate Date + Time provided -> normalize as strings, no Date()
  if (date && time) {
    const dateStr = normalizeDateString(date);
    const timeStr = normalizeTimeString(time);
    return { dateStr, timeStr, iso: "" }; // keep as plain strings
  }

  // Case B: single Timestamp
  if (timestamp) {
    const ts = timestamp.trim();

    // If the timestamp includes TZ info -> parse then convert to Manila consistently
    if (hasExplicitTZ(ts)) {
      const d = parseWithPatterns(ts);
      if (d && isValid(d)) {
        const zoned = utcToZonedTime(d, PH_TZ);
        return {
          dateStr: safeFormat(zoned, "yyyy-MM-dd"),
          timeStr: safeFormat(zoned, "HH:mm:ss"),
          iso: isValid(zoned) ? zoned.toISOString() : "",
        };
      }
    }

    // Otherwise, split it as plain local timestamp (no TZ math)
    // Accept "YYYY-MM-DD[ T]HH:mm[:ss]" and similar
    const m = ts.match(
      /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)/
    );
    if (m) {
      return {
        dateStr: m[1],
        timeStr: normalizeTimeString(m[2]),
        iso: "",
      };
    }

    // Try looser patterns: let's separate date + time substrings when obvious
    const dateOnly = normalizeDateString(ts);
    if (dateOnly !== ts) return { dateStr: dateOnly, timeStr: "", iso: "" };
  }

  // Case C: only Date provided
  if (date) {
    return { dateStr: normalizeDateString(date), timeStr: "", iso: "" };
  }

  return { dateStr: "", timeStr: "", iso: "" };
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
          where: {
            id: { in: ids },
            departmentId: body.departmentId,
          },
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            suffix: true,
            position: true,
            offices: { select: { name: true } },
            employeeNo: true,
            employeeType: { select: { name: true } },
          },
        });
      } else {
        employees = await prismadb.employee.findMany({
          where: {
            employeeNo: { in: ids },
            departmentId: body.departmentId,
          },
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            suffix: true,
            position: true,
            offices: { select: { name: true } },
            employeeNo: true,
            employeeType: { select: { name: true } },
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

      const middleInitial =
        e?.middleName && e.middleName.trim()
          ? `${e.middleName.trim()[0].toUpperCase()}.`
          : "";

      const suffix = e?.suffix?.trim() ?? "";

      // Keep your combined Name as-is but enhanced (optional)
      const displayName = e
        ? `${e.lastName}, ${e.firstName}${middleInitial ? " " + middleInitial : ""}${suffix ? " " + suffix : ""}`
        : "(Unmatched)";

      return {
        employeeId: e?.id ?? "",
        employeeNo: e?.employeeNo ?? "",
        name: displayName,
        middleInitial,      // <-- "D." style
        suffix,
        office: e?.offices?.name ?? "",
        employeeTypeName: e?.employeeType?.name ?? "",
        position: e?.position ?? "",
        date: r.dt.dateStr,
        time: r.dt.timeStr,
        source: r.source,
        idMatched: !!e,
        id: r.id,
      };
    });

    type OfficeSummaryEntry = {
      office: string;
      counts: Record<CategoryKey, number>;
      total: number;
      attendance: Record<CategoryKey, number>;
      attendanceTotal: number;
    };

    const officeSummaryMap = new Map<string, OfficeSummaryEntry>();
    const ensureOfficeEntry = (office: string): OfficeSummaryEntry => {
      const key = normalizeOfficeName(office);
      let entry = officeSummaryMap.get(key);
      if (!entry) {
        entry = {
          office: key,
          counts: createEmptyCounts(),
          total: 0,
          attendance: createEmptyCounts(),
          attendanceTotal: 0,
        };
        officeSummaryMap.set(key, entry);
      }
      return entry;
    };

    const roster = await prismadb.employee.findMany({
      where: {
        departmentId: body.departmentId,
        isArchived: false,
      },
      select: {
        employeeType: { select: { name: true } },
        offices: { select: { name: true } },
      },
    });

    for (const employee of roster) {
      const officeName = normalizeOfficeName(employee.offices?.name);
      const entry = ensureOfficeEntry(officeName);
      const category = mapEmployeeTypeToCategory(employee.employeeType?.name);
      entry.counts[category] += 1;
      entry.total += 1;
    }

    for (const row of out) {
      if (!row.idMatched) continue;
      const officeName = normalizeOfficeName(row.office);
      const entry = ensureOfficeEntry(officeName);
      const category = mapEmployeeTypeToCategory(row.employeeTypeName);
      entry.attendance[category] += 1;
      entry.attendanceTotal += 1;
    }

    const officeSummary = Array.from(officeSummaryMap.values()).sort((a, b) =>
      a.office.localeCompare(b.office)
    );

    return NextResponse.json({
      ok: true,
      rows: out,
      officeSummary,
      categories: CATEGORY_KEYS,
      debug: {
        idType: body.idType,
        idsRequested: ids.length,
        idsFound: employees.length,
        sampleMissing, // <- check these in the response
        dbUrlHost: process.env.DATABASE_URL?.split("@")[1]?.split("/")[0], // quick hint which DB you're on
      },
    });
  } catch (e: any) {
      console.error("resolve error:", e);
      return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}

