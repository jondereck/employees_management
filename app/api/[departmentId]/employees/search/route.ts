import prismadb from "@/lib/prismadb";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

type Params = {
  params: {
    departmentId: string;
  };
};

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

export async function GET(request: Request, { params }: Params) {
  const { departmentId } = params;
  if (!departmentId) {
    return new NextResponse("Department Id is required", { status: 400 });
  }

  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const rawLimit = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;
  const cursor = searchParams.get("cursor") ?? undefined;
  const officeId = searchParams.get("officeId") ?? undefined;
  const query = searchParams.get("q")?.trim() ?? "";

  const tokens = query
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const where: Prisma.EmployeeWhereInput = {
    departmentId,
    isArchived: false,
    ...(officeId ? { officeId } : {}),
  };

  if (tokens.length) {
    where.AND = tokens.map((token) => ({
      OR: [
        { firstName: { contains: token, mode: "insensitive" } },
        { middleName: { contains: token, mode: "insensitive" } },
        { lastName: { contains: token, mode: "insensitive" } },
        { employeeNo: { contains: token, mode: "insensitive" } },
        { position: { contains: token, mode: "insensitive" } },
      ],
    }));
  }

  const take = limit + 1;

  const employees = await prismadb.employee.findMany({
    where,
    include: {
      employeeType: { select: { name: true, value: true } },
      offices: { select: { id: true, name: true } },
      images: {
        select: { url: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { id: "asc" },
    take,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  let nextCursor: string | undefined;
  if (employees.length > limit) {
    const next = employees.pop();
    nextCursor = next?.id;
  }

  const items = employees.map((employee) => ({
    id: employee.id,
    employeeNo: employee.employeeNo,
    firstName: employee.firstName,
    middleName: employee.middleName || undefined,
    lastName: employee.lastName,
    positionTitle: employee.position || undefined,
    employeeType: employee.employeeType?.name ?? "",
    employeeTypeColor: employee.employeeType?.value ?? undefined,
    officeId: employee.officeId || undefined,
    officeName: employee.offices?.name ?? "",
    photoUrl: employee.images?.[0]?.url ?? undefined,
  }));

  return NextResponse.json({ items, nextCursor });
}
