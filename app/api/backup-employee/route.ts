export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { requireBackupAccess } from '@/lib/backups/access';
import { backupErrorResponse } from '@/lib/backups/http';
import prismadb from '@/lib/prismadb';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get("departmentId");

    if (!departmentId) {
      return NextResponse.json(
        { error: "departmentId is required" },
        { status: 400 }
      );
    }

    await requireBackupAccess(departmentId);

    const employees = await prismadb.employee.findMany({
      where: { departmentId },
      include: {
        offices: { select: { id: true, name: true, bioIndexCode: true } },
        employeeType: { select: { id: true, name: true, value: true } },
        eligibility: { select: { id: true, name: true, value: true } },
        designation: { select: { id: true, name: true, bioIndexCode: true } },
        historySnapshots: {
          where: { effectiveAt: { lte: new Date() } },
          orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: {
            indicatorId: true,
            effectiveAt: true,
            indicator: { select: { name: true } },
          },
        },
      },
    });

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      employees,
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error("Backup error:", error);
    return backupErrorResponse(error);
  }
}
