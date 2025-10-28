import prismadb from "@/lib/prismadb";
import { NextResponse } from "next/server";

type Params = {
  params: {
    departmentId: string;
  };
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function GET(request: Request, { params }: Params) {
  const { departmentId } = params;
  if (!departmentId) {
    return new NextResponse("Department Id is required", { status: 400 });
  }

  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const rawLimit = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;
  const query = searchParams.get("q")?.trim() ?? "";

  const offices = await prismadb.offices.findMany({
    where: {
      departmentId,
      ...(query
        ? {
            name: { contains: query, mode: "insensitive" },
          }
        : {}),
    },
    orderBy: { name: "asc" },
    take: limit,
    include: {
      employee: {
        where: { isHead: true, isArchived: false },
        select: { id: true },
        take: 1,
      },
      _count: { select: { employee: true } },
    },
  });

  const items = offices.map((office) => ({
    id: office.id,
    name: office.name,
    headEmployeeId: office.employee[0]?.id,
    employeeCount: office._count.employee,
  }));

  return NextResponse.json({ items });
}
