import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { backfillWorkforceHistorySnapshots } from "@/lib/workforce-history";

export async function POST(
  _req: Request,
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

    const result = await backfillWorkforceHistorySnapshots(params.departmentId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[WORKFORCE_HISTORY_BACKFILL_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
