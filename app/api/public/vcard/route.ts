// app/api/public/vcard/route.ts
import { NextRequest, NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

function getMiddleInitial(name?: string | null) {
  if (!name) return "";
  const t = name.trim();
  return t ? `${t[0].toUpperCase()}.` : "";
}

function sanitizeFilename(s: string) {
  return s.replace(/[^\w\-]+/g, "_").slice(0, 60);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId");
  const departmentId = searchParams.get("departmentId");

  if (!employeeId || !departmentId) {
    return NextResponse.json(
      { error: "Missing required query params: employeeId, departmentId" },
      { status: 400 }
    );
  }

  // Only allow vCard for publicly enabled profiles (privacy guard)
  const [employee, dept] = await Promise.all([
    prismadb.employee.findFirst({
      where: {
        id: employeeId,
        departmentId,
        publicEnabled: true,
      },
      select: {
        firstName: true,
        middleName: true,
        lastName: true,
        suffix: true,
        position: true,
        offices: { select: { name: true } },
      },
    }),
    prismadb.department.findUnique({
      where: { id: departmentId },
      select: { name: true },
    }),
  ]);

  if (!employee) {
    return NextResponse.json(
      { error: "Public profile not found or link disabled." },
      { status: 404 }
    );
  }

  const origin = req.nextUrl.origin; // e.g., https://your-domain.tld
  // Public profile URL (adjust if your route changes)
  const profileUrl = `${origin}/${departmentId}/(routes)/(frontend)/view/employee/${employeeId}`;

  const fullName = [
    employee.firstName?.trim(),
    getMiddleInitial(employee.middleName),
    employee.lastName?.trim(),
    employee.suffix?.trim(),
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ");

  const org = dept?.name || "Municipality of Lingayen";
  const title = employee.position || "Public Servant";
  const officeLine = employee.offices?.name ? `;${employee.offices.name}` : "";

  // vCard 3.0 — minimal, privacy-safe (no phone/email/home address)
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${fullName}`,
    // N: Last;First;Middle;Prefix;Suffix
    `N:${employee.lastName || ""};${employee.firstName || ""};${getMiddleInitial(employee.middleName)};;${employee.suffix || ""}`,
    `TITLE:${title}`,
    `ORG:${org}${officeLine}`,
    `URL:${profileUrl}`,
    "END:VCARD",
  ];

  const vcf = lines.join("\r\n");
  const filename = sanitizeFilename(`${fullName}_LGU`);

  return new NextResponse(vcf, {
    status: 200,
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.vcf"`,
      "Cache-Control": "no-store",
    },
  });
}
