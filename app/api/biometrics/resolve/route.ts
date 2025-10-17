import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { normalizeBiometricToken } from "@/utils/normalizeBiometricToken";
import { formatEmployeeName } from "@/utils/formatEmployeeName";

const Payload = z.object({
  token: z.string().min(1),
  employeeId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { token, employeeId } = Payload.parse(json);

    const normalizedToken = normalizeBiometricToken(token);
    if (!normalizedToken) {
      return NextResponse.json({ error: "Token cannot be empty." }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        lastName: true,
        firstName: true,
        middleName: true,
        suffix: true,
        offices: { select: { id: true, name: true } },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    }

    const identityMapModel = (prisma as typeof prisma & {
      biometricsIdentityMap?: typeof prisma.biometricsIdentityMap;
    }).biometricsIdentityMap;

    if (!identityMapModel) {
      console.warn(
        "Biometrics identity map model is unavailable. Returning without persisting mapping until migrations are applied."
      );
      return NextResponse.json(
        {
          error:
            "Biometrics identity mappings storage is unavailable. Please apply the latest database migrations and regenerate the Prisma client.",
        },
        { status: 503 }
      );
    }

    await identityMapModel.upsert({
      where: { token: normalizedToken },
      update: { employeeId: employee.id },
      create: { token: normalizedToken, employeeId: employee.id },
    });

    const officeName = employee.offices?.name?.trim() || "(Unassigned)";

    return NextResponse.json({
      ok: true,
      identity: {
        status: "matched" as const,
        employeeId: employee.id,
        employeeName: formatEmployeeName(employee),
        officeId: employee.offices?.id ?? null,
        officeName,
      },
    });
  } catch (error) {
    console.error("Failed to resolve biometrics token", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unable to resolve biometrics token.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
