import { NextResponse } from "next/server";

import { requireSmsAdmin, smsAuthErrorResponse } from "@/lib/auth/require-sms-admin";
import prismadb from "@/lib/prismadb";

export async function GET(
  _req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    await requireSmsAdmin(params.departmentId);

    const employees = await prismadb.employee.findMany({
      where: {
        departmentId: params.departmentId,
        isArchived: false,
        contactNumber: { not: "" },
      },
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        suffix: true,
        contactNumber: true,
        position: true,
        offices: { select: { name: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    return NextResponse.json({
      employees: employees.map((employee) => ({
        id: employee.id,
        name: `${employee.lastName}, ${[employee.firstName, employee.middleName, employee.suffix]
          .map((part) => part?.trim())
          .filter(Boolean)
          .join(" ")}`,
        contactNumber: employee.contactNumber,
        position: employee.position,
        office: employee.offices?.name ?? "",
      })),
    });
  } catch (error) {
    const authResponse = smsAuthErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("[sms-targets] failed", error);
    return NextResponse.json({ error: "Unable to load SMS targets." }, { status: 500 });
  }
}
