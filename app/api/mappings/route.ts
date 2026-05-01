import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  // Fetch once each; keep payload small
  const [offices, eligibilities, employeeTypes] = await Promise.all([
    prismadb.offices.findMany({ select: { id: true, name: true } }),
    prismadb.eligibility.findMany({ select: { id: true, name: true } }),
    prismadb.employeeType.findMany({ select: { id: true, name: true } }),
  ]);

  // Convert to { [id]: name } objects
  const officeMapping = Object.fromEntries(offices.map(o => [o.id, o.name]));
  const eligibilityMapping = Object.fromEntries(eligibilities.map(e => [e.id, e.name]));
  const appointmentMapping = Object.fromEntries(employeeTypes.map(t => [t.id, t.name]));

  return NextResponse.json({ officeMapping, eligibilityMapping, appointmentMapping });
}
