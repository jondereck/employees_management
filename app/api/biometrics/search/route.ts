import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  q: z.string().min(1),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20),
});

const formatName = (employee: {
  lastName: string;
  firstName: string;
  middleName: string | null;
  suffix: string | null;
}): string => {
  const last = employee.lastName?.trim();
  const first = employee.firstName?.trim();
  const middle = employee.middleName?.trim();
  const suffix = employee.suffix?.trim();

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
  return formatted || first || last || "Unnamed";
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawQuery = searchParams.get("q")?.trim() ?? "";
    if (!rawQuery) {
      return NextResponse.json({ results: [] });
    }

    const limitParam = searchParams.get("limit");
    const parsedLimit = limitParam ? Number(limitParam) : undefined;
    const { q, limit } = querySchema.parse({ q: rawQuery, limit: parsedLimit });

    const tokens = q.split(/\s+/).filter(Boolean);

    const where = {
      OR: [
        { employeeNo: { contains: q, mode: "insensitive" as const } },
        { firstName: { contains: q, mode: "insensitive" as const } },
        { lastName: { contains: q, mode: "insensitive" as const } },
        { middleName: { contains: q, mode: "insensitive" as const } },
      ],
      AND: tokens.map((token) => ({
        OR: [
          { firstName: { contains: token, mode: "insensitive" as const } },
          { lastName: { contains: token, mode: "insensitive" as const } },
          { middleName: { contains: token, mode: "insensitive" as const } },
          { employeeNo: { contains: token, mode: "insensitive" as const } },
        ],
      })),
    };

    const employees = await prisma.employee.findMany({
      where,
      select: {
        id: true,
        employeeNo: true,
        firstName: true,
        lastName: true,
        middleName: true,
        suffix: true,
        offices: { select: { id: true, name: true } },
      },
      take: limit,
      orderBy: [
        { lastName: "asc" },
        { firstName: "asc" },
      ],
    });

    const results = employees.map((employee) => ({
      id: employee.id,
      employeeNo: employee.employeeNo,
      name: formatName(employee),
      officeId: employee.offices?.id ?? null,
      officeName: employee.offices?.name ?? null,
    }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Failed to search employees", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to search employees." }, { status: 500 });
  }
}
