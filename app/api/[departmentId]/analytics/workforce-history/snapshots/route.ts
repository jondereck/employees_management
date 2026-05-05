import { auth } from "@clerk/nextjs/server";
import { Gender, MaritalStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { WORKFORCE_ACTIVE_STATUS, WORKFORCE_INACTIVE_STATUS } from "@/lib/workforce-history";

async function requireDepartmentOwner(departmentId: string) {
  const { userId } = auth();
  if (!userId) return { error: new NextResponse("Unauthenticated", { status: 401 }) };

  const department = await prismadb.department.findFirst({
    where: { id: departmentId, userId },
    select: { id: true },
  });
  if (!department) return { error: new NextResponse("Unauthorized", { status: 403 }) };

  return { userId };
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function ensureDepartmentRecord(
  model: "offices" | "employeeType" | "eligibility",
  departmentId: string,
  id: string | null
) {
  if (!id) return null;
  const count = await (prismadb[model] as any).count({ where: { id, departmentId } });
  if (count !== 1) throw new Error("Selected reference does not belong to this department.");
  return id;
}

export async function GET(
  req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    const access = await requireDepartmentOwner(params.departmentId);
    if (access.error) return access.error;

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId");
    if (!employeeId) return new NextResponse("employeeId is required", { status: 400 });

    const employee = await prismadb.employee.findFirst({
      where: { id: employeeId, departmentId: params.departmentId },
      select: { id: true },
    });
    if (!employee) return new NextResponse("Employee not found", { status: 404 });

    const snapshots = await prismadb.employeeHistorySnapshot.findMany({
      where: { departmentId: params.departmentId, employeeId },
      include: {
        office: { select: { id: true, name: true } },
        employeeType: { select: { id: true, name: true } },
        eligibility: { select: { id: true, name: true } },
      },
      orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(
      snapshots.map((snapshot) => ({
        id: snapshot.id,
        effectiveAt: snapshot.effectiveAt.toISOString(),
        officeId: snapshot.officeId,
        officeName: snapshot.office?.name ?? "",
        employeeTypeId: snapshot.employeeTypeId,
        employeeTypeName: snapshot.employeeType?.name ?? "",
        eligibilityId: snapshot.eligibilityId,
        eligibilityName: snapshot.eligibility?.name ?? "",
        position: snapshot.position,
        gender: snapshot.gender,
        maritalStatus: snapshot.maritalStatus,
        isHead: snapshot.isHead,
        status: snapshot.status,
        source: snapshot.source,
        note: snapshot.note,
      }))
    );
  } catch (error) {
    console.error("[WORKFORCE_HISTORY_SNAPSHOTS_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    const access = await requireDepartmentOwner(params.departmentId);
    if (access.error) return access.error;

    const body = await req.json();
    const employeeId = nullableString(body?.employeeId);
    if (!employeeId) return new NextResponse("employeeId is required", { status: 400 });

    const employee = await prismadb.employee.findFirst({
      where: { id: employeeId, departmentId: params.departmentId },
      select: { id: true },
    });
    if (!employee) return new NextResponse("Employee not found", { status: 404 });

    const effectiveAt = parseDate(body?.effectiveAt);
    if (!effectiveAt) return new NextResponse("Valid effectiveAt is required", { status: 400 });

    const status = body?.status === WORKFORCE_INACTIVE_STATUS ? WORKFORCE_INACTIVE_STATUS : WORKFORCE_ACTIVE_STATUS;
    const gender = Object.values(Gender).includes(body?.gender) ? body.gender : null;
    const maritalStatus = Object.values(MaritalStatus).includes(body?.maritalStatus) ? body.maritalStatus : null;

    const officeId = await ensureDepartmentRecord("offices", params.departmentId, nullableString(body?.officeId));
    const employeeTypeId = await ensureDepartmentRecord("employeeType", params.departmentId, nullableString(body?.employeeTypeId));
    const eligibilityId = await ensureDepartmentRecord("eligibility", params.departmentId, nullableString(body?.eligibilityId));

    const snapshot = await prismadb.employeeHistorySnapshot.create({
      data: {
        departmentId: params.departmentId,
        employeeId,
        effectiveAt,
        officeId,
        employeeTypeId,
        eligibilityId,
        position: typeof body?.position === "string" ? body.position.trim() : "",
        gender,
        maritalStatus,
        isHead: Boolean(body?.isHead),
        status,
        source: "MANUAL",
        note: nullableString(body?.note),
      },
    });

    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("[WORKFORCE_HISTORY_SNAPSHOTS_POST]", error);
    const message = error instanceof Error ? error.message : "Internal error";
    return new NextResponse(message, { status: message.includes("department") ? 400 : 500 });
  }
}
