import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { firstEmployeeNoToken } from "@/lib/employeeNo";

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
  employeeNo: string | null;
  isHead: boolean | null;
  employeeType: string | null;
  candidates?: string[];
  missingOffice?: boolean;
};

type EmployeeCandidate = {
  id: string;
  employeeNo: string | null;
  isHead: boolean;
  firstName: string;
  lastName: string;
  middleName: string | null;
  suffix: string | null;
  updatedAt: Date;
  office: { id: string; name: string } | null;
  employeeTypeName: string | null;
};

const UNKNOWN_RESULT: IdentityRecord = {
  status: "unmatched",
  employeeId: null,
  employeeName: UNMATCHED_NAME,
  officeId: null,
  officeName: UNKNOWN_OFFICE,
  employeeNo: null,
  isHead: null,
  employeeType: null,
};

function formatName(candidate: EmployeeCandidate): string {
  const last = candidate.lastName?.trim();
  const first = candidate.firstName?.trim();
  const middle = candidate.middleName?.trim();
  const suffix = candidate.suffix?.trim();

  const middleInitial = middle
    ? middle
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => `${part.charAt(0).toUpperCase()}.`)
        .join(" ")
    : "";

  const pieces = [last, ", ", first];
  if (middleInitial) pieces.push(" ", middleInitial);
  if (suffix) pieces.push(" ", suffix);
  const formatted = pieces.filter(Boolean).join("");
  return formatted || candidate.employeeNo || "Unnamed";
}

function describeCandidate(candidate: EmployeeCandidate): string {
  const name = formatName(candidate);
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

    const tokenSet = new Set(uniqueTokens);
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
      manualMappings = await identityMapModel.findMany({
        where: { token: { in: uniqueTokens } },
        include: {
          employee: {
            select: {
              id: true,
              employeeNo: true,
              isHead: true,
              firstName: true,
              lastName: true,
              middleName: true,
              suffix: true,
              updatedAt: true,
              offices: { select: { id: true, name: true } },
              employeeType: { select: { name: true } },
            },
          },
        },
      });
    }

    const results: Record<string, IdentityRecord> = {};

    for (const mapping of manualMappings) {
      const employee = mapping.employee;
      if (!employee) continue;
      tokenSet.delete(mapping.token);
      const officeName = employee.offices?.name?.trim() || UNASSIGNED_OFFICE;
      const officeId = employee.offices?.id ?? null;
      const candidate: EmployeeCandidate = {
        id: employee.id,
        employeeNo: employee.employeeNo,
        isHead: employee.isHead,
        firstName: employee.firstName,
        lastName: employee.lastName,
        middleName: employee.middleName,
        suffix: employee.suffix,
        updatedAt: employee.updatedAt,
        office: employee.offices ? { id: employee.offices.id, name: employee.offices.name } : null,
        employeeTypeName: employee.employeeType?.name ?? null,
      };
      results[mapping.token] = {
        status: "matched",
        employeeId: employee.id,
        employeeName: formatName(candidate),
        officeId,
        officeName,
        employeeNo: employee.employeeNo,
        isHead: employee.isHead,
        employeeType: employee.employeeType?.name ?? null,
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
          isHead: true,
          firstName: true,
          lastName: true,
          middleName: true,
          suffix: true,
          updatedAt: true,
          offices: { select: { id: true, name: true } },
          employeeType: { select: { name: true } },
        },
      });

      for (const candidate of batch) {
        const token = firstEmployeeNoToken(candidate.employeeNo);
        if (!token || !tokenSet.has(token)) continue;
        if (!matches.has(token)) {
          matches.set(token, []);
        }
        matches.get(token)!.push({
          id: candidate.id,
          employeeNo: candidate.employeeNo,
          isHead: candidate.isHead,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          middleName: candidate.middleName,
          suffix: candidate.suffix,
          updatedAt: candidate.updatedAt,
          office: candidate.offices ?? null,
          employeeTypeName: candidate.employeeType?.name ?? null,
        });
      }
    }

    for (const token of uniqueTokens) {
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
        employeeName: formatName(primary),
        officeId,
        officeName,
        employeeNo: primary.employeeNo,
        isHead: primary.isHead,
        candidates: status === "ambiguous" ? sorted.map(describeCandidate) : undefined,
        missingOffice: !primary.office,
        employeeType: primary.employeeTypeName ?? null,
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
