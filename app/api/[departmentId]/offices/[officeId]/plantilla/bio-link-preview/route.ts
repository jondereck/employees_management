import { NextResponse } from "next/server";

import { requireOfficeInDepartment } from "@/lib/office-access";
import {
  previewBioSuffixLinks,
  previewPlantillaAutoLinks,
} from "@/lib/plantilla";
import prismadb from "@/lib/prismadb";

async function loadUnassignedCandidates(departmentId: string) {
  return prismadb.employee.findMany({
    where: {
      departmentId,
      plantillaPositionId: null,
    },
    select: {
      id: true,
      employeeNo: true,
      firstName: true,
      lastName: true,
    },
  });
}

/**
 * Preview who would auto-link by Emp No suffix for given item numbers.
 * GET ?itemNumbers=A-1,B-2
 */
export async function GET(
  req: Request,
  { params }: { params: { departmentId: string; officeId: string } }
) {
  try {
    const access = await requireOfficeInDepartment(
      params.departmentId,
      params.officeId
    );
    if (access.error) return access.error;

    const url = new URL(req.url);
    const raw = url.searchParams.get("itemNumbers") ?? "";
    const itemNumbers = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (itemNumbers.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    const candidates = await loadUnassignedCandidates(params.departmentId);
    // Bio suffix still requires a comma Emp No; filter for that path only.
    const bioCandidates = candidates.filter((c) =>
      Boolean(c.employeeNo?.includes(","))
    );
    const matches = previewBioSuffixLinks(itemNumbers, bioCandidates);
    return NextResponse.json({ matches, candidateCount: candidates.length });
  } catch (error) {
    console.log("[OFFICE_PLANTILLA_BIO_LINK_PREVIEW]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

/**
 * Preview auto-links for paste rows (Emp No suffix and/or occupant name).
 * POST { rows: [{ itemNumber?, occupantName? }] }
 */
export async function POST(
  req: Request,
  { params }: { params: { departmentId: string; officeId: string } }
) {
  try {
    const access = await requireOfficeInDepartment(
      params.departmentId,
      params.officeId
    );
    if (access.error) return access.error;

    const body = await req.json().catch(() => null);
    const rows = Array.isArray(body?.rows) ? body.rows : null;
    if (!rows) {
      return NextResponse.json({ error: "rows array is required" }, { status: 400 });
    }

    const candidates = await loadUnassignedCandidates(params.departmentId);
    const matches = previewPlantillaAutoLinks(
      rows.map((row: { itemNumber?: string | null; occupantName?: string | null }) => ({
        itemNumber: row?.itemNumber ?? null,
        occupantName: row?.occupantName ?? null,
      })),
      candidates
    );

    return NextResponse.json({ matches, candidateCount: candidates.length });
  } catch (error) {
    console.log("[OFFICE_PLANTILLA_BIO_LINK_PREVIEW_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
