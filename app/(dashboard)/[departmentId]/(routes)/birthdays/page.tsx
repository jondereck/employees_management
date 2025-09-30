// app/(dashboard)/[departmentId]/birthdays/page.tsx
import { Prisma } from "@prisma/client";

import prismadb from "@/lib/prismadb";
import BirthdayMonthClient from "./components/birthday-month-client";

// --- Typed select (includes latest image)
const employeeWithLatestImageSelect = Prisma.validator<Prisma.EmployeeDefaultArgs>()({
  select: {
    id: true,
    firstName: true,
    lastName: true,
    nickname: true,
    birthday: true,
    isArchived: true,
    images: {
      select: { url: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 1,
    },
  },
});
type EmployeeWithLatestImage = Prisma.EmployeeGetPayload<typeof employeeWithLatestImageSelect>;

function clampMonth(m: string | null | undefined, fallback: number) {
  if (m == null) return fallback;
  const n = Number(m);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(11, Math.max(0, n));
}

export const revalidate = 3600;

export default async function Page({
  params,
  searchParams,
}: {
  params: { departmentId: string };
  searchParams?: { month?: string };
}) {
  const { departmentId } = params;
  const now = new Date();
  const month = clampMonth(searchParams?.month, now.getMonth()); // 0..11
  const pgMonth = month + 1; // Postgres EXTRACT(MONTH) is 1..12

  const idRows = await prismadb.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      SELECT e.id
      FROM "Employee" e
      WHERE e."departmentId" = ${departmentId}
        AND e."isArchived" = false
        AND EXTRACT(MONTH FROM e."birthday") = ${pgMonth}
      ORDER BY EXTRACT(DAY FROM e."birthday") ASC
    `
  );

  if (idRows.length === 0) {
    return (
      <BirthdayMonthClient
        departmentId={departmentId}
        initialMonth={month}
        people={[]}
        subtitle={`HRPS • 0 celebrants for this month`}
      />
    );
  }

  // 2) Fetch only those employees with the typed select (latest image)
 const employees: EmployeeWithLatestImage[] = idRows.length
  ? await prismadb.employee.findMany({
      where: { id: { in: idRows.map(r => r.id) } },
      ...employeeWithLatestImageSelect,
    })
  : [];

const people = employees
  // keep a defensive sort in case DB order is lost
  .sort((a, b) => new Date(a.birthday).getDate() - new Date(b.birthday).getDate())
  .map(e => ({
    id: e.id,
    firstName: e.firstName,
    lastName: e.lastName,
    nickname: e.nickname ?? null,
    birthday: new Date(e.birthday).toISOString(),
    imageUrl: e.images?.[0]?.url ?? null,
  }));


  const subtitle = `HRPS • ${people.length} celebrant${people.length === 1 ? "" : "s"} for this month`;

  return (
    <BirthdayMonthClient
      departmentId={departmentId}
      initialMonth={month}
      people={people}
      subtitle={subtitle}
    />
  );
}
