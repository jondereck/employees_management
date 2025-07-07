import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const employees = await prisma.employee.findMany();

 return new NextResponse(JSON.stringify(employees), {
  headers: {
    'Content-Type': 'application/json',
    'Content-Disposition': 'attachment; filename=Employee.json',
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
