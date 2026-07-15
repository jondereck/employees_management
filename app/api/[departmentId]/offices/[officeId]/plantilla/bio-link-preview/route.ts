import { NextResponse } from "next/server";

import { requireOfficeInDepartment } from "@/lib/office-access";
import { previewBioSuffixLinks } from "@/lib/plantilla";
import prismadb from "@/lib/prismadb";

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

    const candidates = await prismadb.employee.findMany({
      where: {
        departmentId: params.departmentId,
        plantillaPositionId: null,
        employeeNo: { contains: "," },
      },
      select: {
        id: true,
        employeeNo: true,
        firstName: true,
        lastName: true,
      },
    });

    const matches = previewBioSuffixLinks(itemNumbers, candidates);
    return NextResponse.json({ matches, candidateCount: candidates.length });
  } catch (error) {
    console.log("[OFFICE_PLANTILLA_BIO_LINK_PREVIEW]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
