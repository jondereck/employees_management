import { NextResponse } from "next/server";

import { requireOfficeInDepartment } from "@/lib/office-access";
import prismadb from "@/lib/prismadb";

/**
 * Search employees in the department for manual plantilla linking.
 * Returns both linkable (unassigned) and already-linked matches so search feels responsive.
 * Prefers employees assigned to this office.
 * GET ?q=randy&limit=20
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
    const q = (url.searchParams.get("q") ?? "").trim();
    const limitRaw = Number(url.searchParams.get("limit") ?? "20");
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(Math.floor(limitRaw), 1), 50)
      : 20;

    if (q.length < 1) {
      return NextResponse.json({ results: [] });
    }

    const tokens = q.split(/\s+/).filter(Boolean);

    const employees = await prismadb.employee.findMany({
      where: {
        departmentId: params.departmentId,
        isArchived: false,
        AND: tokens.map((token) => ({
          OR: [
            { firstName: { contains: token, mode: "insensitive" as const } },
            { lastName: { contains: token, mode: "insensitive" as const } },
            { middleName: { contains: token, mode: "insensitive" as const } },
            { employeeNo: { contains: token, mode: "insensitive" as const } },
            { position: { contains: token, mode: "insensitive" as const } },
            {
              offices: {
                name: { contains: token, mode: "insensitive" as const },
              },
            },
          ],
        })),
      },
      select: {
        id: true,
        employeeNo: true,
        firstName: true,
        lastName: true,
        middleName: true,
        position: true,
        officeId: true,
        plantillaPositionId: true,
        offices: { select: { id: true, name: true } },
        plantillaPosition: {
          select: { id: true, itemNumber: true, title: true },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: Math.min(limit * 3, 100),
    });

    // Prefer this office, then unassigned, then others.
    const ranked = [...employees].sort((a, b) => {
      const aOffice = a.officeId === params.officeId ? 0 : 1;
      const bOffice = b.officeId === params.officeId ? 0 : 1;
      if (aOffice !== bOffice) return aOffice - bOffice;
      const aFree = a.plantillaPositionId ? 1 : 0;
      const bFree = b.plantillaPositionId ? 1 : 0;
      if (aFree !== bFree) return aFree - bFree;
      return 0;
    });

    return NextResponse.json({
      results: ranked.slice(0, limit).map((e) => ({
        id: e.id,
        employeeNo: e.employeeNo,
        firstName: e.firstName,
        lastName: e.lastName,
        middleName: e.middleName,
        position: e.position,
        officeId: e.offices?.id ?? e.officeId ?? null,
        officeName: e.offices?.name ?? null,
        linkable: !e.plantillaPositionId,
        linkedPlantilla: e.plantillaPosition
          ? {
              id: e.plantillaPosition.id,
              itemNumber: e.plantillaPosition.itemNumber,
              title: e.plantillaPosition.title,
            }
          : null,
      })),
    });
  } catch (error) {
    console.log("[OFFICE_PLANTILLA_LINK_CANDIDATES]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
