import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  // Fetch once each; keep payload small
  const [offices, eligibilities, employeeTypes] = await Promise.all([
    prisma.offices.findMany({ select: { id: true, name: true } }),
    prisma.eligibility.findMany({ select: { id: true, name: true } }),
    prisma.employeeType.findMany({ select: { id: true, name: true } }),
  ]);

  // Convert to { [id]: name } objects
  const officeMapping = Object.fromEntries(offices.map(o => [o.id, o.name]));
  const eligibilityMapping = Object.fromEntries(eligibilities.map(e => [e.id, e.name]));
  const appointmentMapping = Object.fromEntries(employeeTypes.map(t => [t.id, t.name]));

  return NextResponse.json({ officeMapping, eligibilityMapping, appointmentMapping });
}
