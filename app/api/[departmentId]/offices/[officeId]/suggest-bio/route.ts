import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";
import { findFirstFreeBioFlat } from "@/lib/bio-utils";

export async function GET(_req: Request, { params }: { params: { departmentId: string; officeId: string } }) {
  try {
    const office = await prismadb.offices.findUnique({
      where: { id: params.officeId },
      select: { id: true, name: true, bioIndexCode: true },
    });
    if (!office) return NextResponse.json({ ok: false, message: "Office not found" }, { status: 404 });

    const anchorRaw = office.bioIndexCode?.trim();
    if (!anchorRaw || !/^\d+$/.test(anchorRaw)) {
      return NextResponse.json({ ok: false, message: "This office has no valid numeric BIO Index Code." }, { status: 400 });
    }

    const anchor = Number(anchorRaw);

    // Optional family block: same thousand range, tweak as you like
    const familyStart = Math.floor(anchor / 1000) * 1000; // e.g., 2050000
    const familyEnd   = familyStart + 999;                // e.g., 2050999 (or 2059999 if per 10k block)

    const suggestion = await findFirstFreeBioFlat({
      departmentId: params.departmentId,
      startFrom: anchor,
      allowStart: false,   // start at anchor+1
      digits: anchorRaw.length, // keep same width as anchor
      familyStart,
      familyEnd,
    });

    return NextResponse.json({ ok: true, indexCode: anchorRaw, suggestion });
  } catch (e) {
    console.error("[SUGGEST_BIO_FLAT]", e);
    return NextResponse.json({ ok: false, message: "Internal error" }, { status: 500 });
  }
}
