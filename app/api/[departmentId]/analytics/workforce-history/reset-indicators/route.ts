import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { invalidateWorkforceReportCache } from "@/lib/workforce-history";

function normalizeYear(value: unknown, fallback: number) {
  const year = Number(value);
  if (!Number.isFinite(year)) return fallback;
  return Math.min(2100, Math.max(1900, Math.trunc(year)));
}

function startOfYear(year: number) {
  return new Date(year, 0, 1, 0, 0, 0, 0);
}

function endOfYear(year: number) {
  return new Date(year, 11, 31, 23, 59, 59, 999);
}

export async function POST(
  req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) return new NextResponse("Unauthenticated", { status: 401 });

    const department = await prismadb.department.findFirst({
      where: { id: params.departmentId, userId },
      select: { id: true },
    });
    if (!department) return new NextResponse("Unauthorized", { status: 403 });

    const body = await req.json().catch(() => ({}));
    const startYear = normalizeYear(body?.startYear, 2023);
    const endYear = normalizeYear(body?.endYear, 2025);
    const dryRun = body?.dryRun === true;
    const fromYear = Math.min(startYear, endYear);
    const toYear = Math.max(startYear, endYear);

    const where = {
      departmentId: params.departmentId,
      indicatorId: { not: null },
      effectiveAt: {
        gte: startOfYear(fromYear),
        lte: endOfYear(toYear),
      },
    };

    const matched = await prismadb.employeeHistorySnapshot.count({ where });
    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        startYear: fromYear,
        endYear: toYear,
        matched,
      });
    }

    const updated = await prismadb.employeeHistorySnapshot.updateMany({
      where,
      data: {
        indicatorId: null,
        note: "Indicator reset for workforce history year-range cleanup.",
      },
    });
    await invalidateWorkforceReportCache(params.departmentId);

    return NextResponse.json({
      dryRun: false,
      startYear: fromYear,
      endYear: toYear,
      matched,
      updated: updated.count,
      cacheCleared: true,
    });
  } catch (error) {
    console.error("[WORKFORCE_HISTORY_RESET_INDICATORS_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
