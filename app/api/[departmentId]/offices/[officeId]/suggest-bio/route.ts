import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

function splitCodes(input: string | null | undefined) {
  return (input ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

function isAlnum16(s: string) {
  return /^[A-Z0-9]+$/.test(s) && s.length <= 16;
}

/** numeric head BEFORE comma; "8540001, E-2" -> 8540001 */
function numericHead(employeeNo: string | null | undefined): number | null {
  const left = (employeeNo ?? "").split(",")[0] ?? "";
  const digitsOnly = left.replace(/[^\d]/g, "");
  const m = digitsOnly.match(/^\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

export async function GET(
  _req: Request,
  { params }: { params: { departmentId: string; officeId: string } }
) {
  try {
    // 1) Load office and its CSV codes
    const office = await prismadb.offices.findUnique({
      where: { id: params.officeId },
      select: { id: true, name: true, bioIndexCode: true, departmentId: true },
    });
    if (!office)
      return NextResponse.json({ ok: false, message: "Office not found" }, { status: 404 });

    // (Optional safety) ensure dept from URL matches the office
    if (office.departmentId !== params.departmentId) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 403 });
    }

    const codes = splitCodes(office.bioIndexCode);
    if (codes.length === 0) {
      return NextResponse.json(
        { ok: false, message: "This office has no BIO Index Code configured." },
        { status: 400 }
      );
    }

    // Validate all codes (A–Z/0–9, ≤16)
    for (const c of codes) {
      if (!isAlnum16(c)) {
        return NextResponse.json(
          { ok: false, message: `Invalid BIO Index Code "${c}". Use A–Z/0–9 (max 16).` },
          { status: 400 }
        );
      }
    }

    // 2) Build USED set (one DB scan)
    const rows = await prismadb.employee.findMany({
      where: { departmentId: params.departmentId },
      select: { employeeNo: true },
    });
    const used = new Set<number>();
    for (const r of rows) {
      const n = numericHead(r.employeeNo);
      if (n != null) used.add(n);
    }

    // 3) Compute a suggestion per code
    const suggestions: { indexCode: string; candidate: string }[] = [];

    for (const code of codes) {
      if (/^\d+$/.test(code)) {
        const anchor = Number(code);
        const width = code.length;

        // Family range: same 1,000-block as anchor
        const familyStart = Math.floor(anchor / 1000) * 1000;
        const familyEnd = familyStart + 999;

        let candidate = anchor + 1;
        if (candidate < familyStart) candidate = familyStart;

        // advance until free (or out of range)
        // eslint-disable-next-line no-constant-condition
        while (true) {
          if (candidate > familyEnd) {
            // none available in this family
            suggestions.push({
              indexCode: code,
              candidate: "", // no candidate; UI can disable button
            });
            break;
          }
          if (!used.has(candidate)) {
            const out = String(candidate).padStart(width, "0");
            suggestions.push({ indexCode: code, candidate: out });
            // mark as used to avoid duplicate return for another code
            used.add(candidate);
            break;
          }
          candidate++;
        }
      } else {
        // Non-numeric code (e.g., "RHU"): no numeric rule — echo back (or leave blank)
        suggestions.push({ indexCode: code, candidate: code });
      }
    }

    // Back-compat: if exactly one numeric suggestion is present and non-empty,
    // also include `suggestion` like the legacy route did.
    const firstNonEmpty = suggestions.find((s) => s.candidate);
    const legacy =
      suggestions.length === 1 && firstNonEmpty
        ? { suggestion: firstNonEmpty.candidate, indexCode: suggestions[0].indexCode }
        : {};

    return NextResponse.json({ ok: true, suggestions, ...legacy });
  } catch (e) {
    console.error("[SUGGEST_BIO_MULTI]", e);
    return NextResponse.json({ ok: false, message: "Internal error" }, { status: 500 });
  }
}
