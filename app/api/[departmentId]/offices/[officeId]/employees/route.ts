import prismadb from "@/lib/prismadb";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

type Params = {
  params: {
    departmentId: string;
    officeId: string;
  };
};

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

export async function GET(request: Request, { params }: Params) {
  const { departmentId, officeId } = params;
  if (!departmentId) {
    return new NextResponse("Department Id is required", { status: 400 });
  }
  if (!officeId) {
    return new NextResponse("Office Id is required", { status: 400 });
  }

  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const rawLimit = searchParams.get("limit");
  const shouldLoadAll = rawLimit === "all";
  const parsedLimit = Number.parseInt(rawLimit ?? "", 10);
  const limit = shouldLoadAll
    ? undefined
    : Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(parsedLimit, MAX_LIMIT)
    : DEFAULT_LIMIT;

  const where: Prisma.EmployeeWhereInput = {
    departmentId,
    officeId,
    isArchived: false,
  };

  const totalCount = await prismadb.employee.count({ where });

  const employees = await prismadb.employee.findMany({
    where,
    orderBy: [
      { isHead: "desc" },
      { lastName: "asc" },
      { firstName: "asc" },
      { id: "asc" },
    ],
    ...(limit ? { take: limit } : {}),
    include: {
      employeeType: { select: { name: true, value: true } },
      images: {
        select: { url: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const items = employees.map((employee) => ({
    id: employee.id,
    firstName: employee.firstName,
    middleName: employee.middleName || undefined,
    lastName: employee.lastName,
    positionTitle: employee.position || undefined,
    employeeType: employee.employeeType?.name ?? "",
    employeeTypeColor: employee.employeeType?.value ?? undefined,
    employeeNo: employee.employeeNo,
    photoUrl: employee.images?.[0]?.url ?? undefined,
    isHead: employee.isHead,
  }));

  return NextResponse.json({
    items,
    totalCount,
    limit: limit ?? null,
  });
}
