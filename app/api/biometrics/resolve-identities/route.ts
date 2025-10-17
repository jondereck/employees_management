import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { firstEmployeeNoToken } from "@/lib/employeeNo";
import { normalizeBiometricToken } from "@/utils/normalizeBiometricToken";
import { formatEmployeeName } from "@/utils/formatEmployeeName";

const Payload = z.object({
  tokens: z.array(z.string().min(1)).max(2000),
});

const UNMATCHED_NAME = "(Unmatched)";
const UNKNOWN_OFFICE = "(Unknown)";
const UNASSIGNED_OFFICE = "(Unassigned)";

type IdentityRecord = {
  status: "matched" | "unmatched" | "ambiguous";
  employeeId: string | null;
  employeeName: string;
  officeId: string | null;
  officeName: string;
  candidates?: string[];
  missingOffice?: boolean;
};

type EmployeeCandidate = {
  id: string;
  employeeNo: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  suffix: string | null;
  updatedAt: Date;
  office: { id: string; name: string } | null;
};

const UNKNOWN_RESULT: IdentityRecord = {
  status: "unmatched",
  employeeId: null,
  employeeName: UNMATCHED_NAME,
  officeId: null,
  officeName: UNKNOWN_OFFICE,
};

function describeCandidate(candidate: EmployeeCandidate): string {
  const name = formatEmployeeName(candidate);
  const officeName = candidate.office?.name?.trim() || UNASSIGNED_OFFICE;
  return `${name} — ${officeName}`;
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { tokens } = Payload.parse(json);

    if (!tokens.length) {
      return NextResponse.json({ results: {} as Record<string, IdentityRecord> });
    }

    const uniqueTokens = Array.from(new Set(tokens.map((token) => token.trim()).filter(Boolean)));
    if (!uniqueTokens.length) {
      return NextResponse.json({ results: {} as Record<string, IdentityRecord> });
    }

    const normalizedTokens = uniqueTokens
      .map((token) => normalizeBiometricToken(token))
      .filter((token) => token.length > 0);

    if (!normalizedTokens.length) {
      return NextResponse.json({ results: {} as Record<string, IdentityRecord> });
    }

    const tokenSet = new Set(normalizedTokens);
    const matches = new Map<string, EmployeeCandidate[]>();

    const identityMapModel = (prisma as typeof prisma & {
      biometricsIdentityMap?: typeof prisma.biometricsIdentityMap;
    }).biometricsIdentityMap;

    let manualMappings: Array<{ token: string; employee: any }> = [];

    if (!identityMapModel) {
      console.warn(
        "Biometrics identity map model is unavailable. Skipping manual mapping lookup until migrations are applied."
      );
    } else {
      const lookupTokens = new Set<string>([
        ...normalizedTokens,
        ...uniqueTokens.map((token) => token.toUpperCase()),
      ]);
      manualMappings = await identityMapModel.findMany({
        where: { token: { in: Array.from(lookupTokens) } },
        include: {
          employee: {
            select: {
              id: true,
              employeeNo: true,
              firstName: true,
              lastName: true,
              middleName: true,
              suffix: true,
              updatedAt: true,
              offices: { select: { id: true, name: true } },
            },
          },
        },
      });
    }

    const results: Record<string, IdentityRecord> = {};

    for (const mapping of manualMappings) {
      const employee = mapping.employee;
      if (!employee) continue;
      const normalizedToken = normalizeBiometricToken(mapping.token);
      if (!normalizedToken) continue;
      tokenSet.delete(normalizedToken);
      const officeName = employee.offices?.name?.trim() || UNASSIGNED_OFFICE;
      const officeId = employee.offices?.id ?? null;
      const candidate: EmployeeCandidate = {
        id: employee.id,
        employeeNo: employee.employeeNo,
        firstName: employee.firstName,
        lastName: employee.lastName,
        middleName: employee.middleName,
        suffix: employee.suffix,
        updatedAt: employee.updatedAt,
        office: employee.offices ? { id: employee.offices.id, name: employee.offices.name } : null,
      };
      results[normalizedToken] = {
        status: "matched",
        employeeId: employee.id,
        employeeName: formatEmployeeName(candidate),
        officeId,
        officeName,
      };
    }

    const orConditions = Array.from(tokenSet).flatMap((token) => [
      { employeeNo: { startsWith: `${token},` } },
      { employeeNo: { equals: token } },
    ]);

    if (orConditions.length) {
      const batch = await prisma.employee.findMany({
        where: { OR: orConditions },
        select: {
          id: true,
          employeeNo: true,
          firstName: true,
          lastName: true,
          middleName: true,
          suffix: true,
          updatedAt: true,
          offices: { select: { id: true, name: true } },
        },
      });

      for (const candidate of batch) {
        const token = normalizeBiometricToken(firstEmployeeNoToken(candidate.employeeNo));
        if (!token || !tokenSet.has(token)) continue;
        if (!matches.has(token)) {
          matches.set(token, []);
        }
        matches.get(token)!.push({
          id: candidate.id,
          employeeNo: candidate.employeeNo,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          middleName: candidate.middleName,
          suffix: candidate.suffix,
          updatedAt: candidate.updatedAt,
          office: candidate.offices ?? null,
        });
      }
    }

    for (const token of normalizedTokens) {
      if (results[token]) continue;
      const candidates = matches.get(token) ?? [];
      if (!candidates.length) {
        results[token] = { ...UNKNOWN_RESULT };
        continue;
      }

      const sorted = candidates.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      const primary = sorted[0]!;
      const officeName = primary.office?.name?.trim() || UNASSIGNED_OFFICE;
      const officeId = primary.office?.id ?? null;
      const status = sorted.length > 1 ? "ambiguous" : "matched";

      results[token] = {
        status,
        employeeId: primary.id,
        employeeName: formatEmployeeName(primary),
        officeId,
        officeName,
        candidates: status === "ambiguous" ? sorted.map(describeCandidate) : undefined,
        missingOffice: !primary.office,
      };
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Failed to resolve biometrics identities", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message =
      error instanceof Error ? error.message : "Unable to resolve employee identities.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
