export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const employees = await prisma.employee.findMany({
      include: {
        offices: { select: { id: true, name: true, bioIndexCode: true } },
        employeeType: { select: { id: true, name: true, value: true } },
        eligibility: { select: { id: true, name: true, value: true } },
        designation: { select: { id: true, name: true, bioIndexCode: true } },
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
    return NextResponse.json({ error: 'Failed to generate backup' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
