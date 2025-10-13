import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prismadb from "@/lib/prismadb";
import { getUpload } from "@/lib/attendance/store";
import { matchEmployees } from "@/lib/attendance/match";

export const runtime = "nodejs";

type MappingInput = { bioUserId: string; employeeId: string };

export async function POST(
  req: Request,
  { params }: { params: { uploadId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const upload = getUpload(params.uploadId);
    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    const department = await prismadb.department.findFirst({
      where: { id: upload.departmentId, userId },
      select: { id: true },
    });

    if (!department) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const mappingsInput: MappingInput[] = Array.isArray(body?.mappings) ? body.mappings : [];

    const sanitized = new Map<string, MappingInput>();
    for (const mapping of mappingsInput) {
      if (!mapping) continue;
      const bio = typeof mapping.bioUserId === "string" ? mapping.bioUserId.trim() : "";
      const employeeId = typeof mapping.employeeId === "string" ? mapping.employeeId.trim() : "";
      if (!bio || !employeeId) continue;
      sanitized.set(bio, { bioUserId: bio, employeeId });
    }

    if (!sanitized.size) {
      return NextResponse.json({ error: "No valid mappings provided" }, { status: 400 });
    }

    await prismadb.$transaction(
      Array.from(sanitized.values()).map((mapping) =>
        prismadb.bioUserMap.upsert({
          where: {
            departmentId_bioUserId: {
              departmentId: upload.departmentId,
              bioUserId: mapping.bioUserId,
            },
          },
          update: { employeeId: mapping.employeeId },
          create: {
            departmentId: upload.departmentId,
            bioUserId: mapping.bioUserId,
            employeeId: mapping.employeeId,
          },
        })
      )
    );

    const matchResult = await matchEmployees({
      departmentId: upload.departmentId,
      records: upload.raw,
    });

    return NextResponse.json({
      count: sanitized.size,
      matched: matchResult.matched,
      unmatched: matchResult.unmatched,
    });
  } catch (error) {
    console.error("[HRPS_ATTENDANCE_MAPPINGS]", error);
    return NextResponse.json({ error: "Failed to save mappings" }, { status: 500 });
  }
}
