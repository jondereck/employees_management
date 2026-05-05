import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { invalidateWorkforceReportCache } from "@/lib/workforce-history";

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toUtcDayRange(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
  return { start, end };
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
    const effectiveDate = parseDate(body?.effectiveDate);
    const dryRun = body?.dryRun === true;

    if (!effectiveDate) {
      return new NextResponse("effectiveDate is required (YYYY-MM-DD)", { status: 400 });
    }

    const { start, end } = toUtcDayRange(effectiveDate);
    const where = {
      departmentId: params.departmentId,
      source: "INDICATOR_SUGGESTION",
      effectiveAt: {
        gte: start,
        lte: end,
      },
    };

    const matchCount = await prismadb.employeeHistorySnapshot.count({ where });
    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        effectiveDate: effectiveDate.toISOString().slice(0, 10),
        matched: matchCount,
      });
    }

    const deleted = await prismadb.employeeHistorySnapshot.deleteMany({ where });
    await invalidateWorkforceReportCache(params.departmentId);

    return NextResponse.json({
      dryRun: false,
      effectiveDate: effectiveDate.toISOString().slice(0, 10),
      matched: matchCount,
      deleted: deleted.count,
      cacheCleared: true,
    });
  } catch (error) {
    console.error("[WORKFORCE_HISTORY_CLEANUP_SUGGESTIONS_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

