import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";
import { getUpload, updateUpload } from "@/lib/attendance/store";
import { matchEmployees } from "@/lib/attendance/match";

export async function POST(
  req: Request,
  { params }: { params: { uploadId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 401 });
    }

    const stored = getUpload(params.uploadId);
    if (!stored) {
      return new NextResponse("Upload not found", { status: 404 });
    }

    const department = await prismadb.department.findFirst({
      where: { id: stored.departmentId, userId },
      select: { id: true },
    });

    if (!department) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    const body = await req.json();
    const mappings = Array.isArray(body?.mappings) ? body.mappings : [];

    if (!mappings.length) {
      return NextResponse.json({ updated: 0, matched: stored.matched, unmatched: stored.unmatched });
    }

    const bioUserMap = (prismadb as any).bioUserMap;
    if (!bioUserMap?.upsert) {
      return new NextResponse("BioUserMap model not available", { status: 500 });
    }

    await prismadb.$transaction(
      mappings.map((mapping: { bioUserId: string; employeeId: string }) =>
        bioUserMap.upsert({
          where: {
            departmentId_bioUserId: {
              departmentId: stored.departmentId,
              bioUserId: mapping.bioUserId,
            },
          },
          update: { employeeId: mapping.employeeId },
          create: {
            departmentId: stored.departmentId,
            bioUserId: mapping.bioUserId,
            employeeId: mapping.employeeId,
          },
        })
      )
    );

    const { matched, unmatched } = await matchEmployees(stored.departmentId, stored.raw);
    updateUpload(params.uploadId, { matched, unmatched });

    return NextResponse.json({ updated: mappings.length, matched, unmatched });
  } catch (error) {
    console.error("[HRPS_ATTENDANCE_SAVE_MAPPINGS]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
