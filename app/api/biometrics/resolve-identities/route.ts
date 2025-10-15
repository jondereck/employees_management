import { NextResponse } from "next/server";
import { z } from "zod";

import { firstEmployeeNoToken } from "@/lib/employeeNo";
import { prisma } from "@/lib/prisma";

const payloadSchema = z.object({
  tokens: z.array(z.string().trim().min(1)).max(5000).default([]),
});

const formatName = (
  lastName: string,
  firstName: string,
  middleName?: string | null,
  suffix?: string | null
) => {
  const parts: string[] = [];
  const last = lastName?.trim();
  const first = firstName?.trim();
  if (last) parts.push(last);
  if (first) {
    parts.push(
      `${first}${middleName?.trim() ? ` ${middleName.trim().charAt(0).toUpperCase()}.` : ""}`.trim()
    );
  }
  const suffixValue = suffix?.trim();
  const compact = parts.join(", ");
  return suffixValue ? `${compact} ${suffixValue}`.trim() : compact;
};

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const { tokens } = payloadSchema.parse(json);

    const normalizedTokens = Array.from(
      new Set(tokens.map((token) => token.trim()).filter((token) => token.length > 0))
    );

    if (!normalizedTokens.length) {
      return NextResponse.json({});
    }

    const candidates = await prisma.employee.findMany({
      where: {
        OR: normalizedTokens.map((token) => ({
          employeeNo: {
            startsWith: token,
            mode: "insensitive",
          },
        })),
      },
      select: {
        id: true,
        employeeNo: true,
        firstName: true,
        lastName: true,
        middleName: true,
        suffix: true,
        officeId: true,
        offices: {
          select: {
            id: true,
            name: true,
          },
        },
        updatedAt: true,
      },
    });

    const requestedTokens = new Set(normalizedTokens);
    const grouped = new Map<string, typeof candidates>();

    for (const employee of candidates) {
      const token = firstEmployeeNoToken(employee.employeeNo);
      if (!token || !requestedTokens.has(token)) continue;
      const list = grouped.get(token) ?? [];
      list.push(employee);
      grouped.set(token, list);
    }

    const response: Record<
      string,
      {
        employeeId: string;
        employeeName: string;
        officeId: string | null;
        officeName: string | null;
        candidates?: Array<{
          employeeId: string;
          employeeName: string;
          officeId: string | null;
          officeName: string | null;
        }>;
      }
    > = {};

    for (const token of normalizedTokens) {
      const matches = grouped.get(token);
      if (!matches?.length) continue;
      const sorted = matches.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      const primary = sorted[0];
      const officeName = primary.offices?.name?.trim() ?? null;
      response[token] = {
        employeeId: primary.id,
        employeeName: formatName(primary.lastName, primary.firstName, primary.middleName, primary.suffix),
        officeId: primary.officeId ?? null,
        officeName,
      };
      if (sorted.length > 1) {
        response[token].candidates = sorted.map((candidate) => ({
          employeeId: candidate.id,
          employeeName: formatName(
            candidate.lastName,
            candidate.firstName,
            candidate.middleName,
            candidate.suffix
          ),
          officeId: candidate.officeId ?? null,
          officeName: candidate.offices?.name?.trim() ?? null,
        }));
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to resolve biometrics identities", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to resolve biometrics identities." },
      { status: 500 }
    );
  }
}
