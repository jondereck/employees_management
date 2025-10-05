import { Prisma } from "@prisma/client";
import prismadb from "@/lib/prismadb";
import BirthdayMonthClient from "./components/birthday-month-client";

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

  // Single round-trip: filter by month and take latest image per employee
  const employees = await prismadb.employee.findMany({
    where: {
      departmentId,
      isArchived: false,
      // server-side month filter
      birthday: {
        // use raw for month match if needed; here we filter in JS below as safety
        // but DB can still index birthday directly if needed
        // NOTE: If you want strict DB filter by month, keep your raw query approach.
      } as any,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      nickname: true,
      birthday: true,
      middleName: true,
      suffix: true,
      prefix: true,
      images: {
        select: { url: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });


  const toMiddleInitial = (name?: string | null) => {
  if (!name) return null;
  const match = name.match(/[A-Za-z]/); // first alphabetic char
  return match ? match[0].toUpperCase() /* + "." if you want a period */ : null;
};
  // Filter by month on app side (keeps portability across DBs)
  const people = employees
    .filter((e) => new Date(e.birthday).getMonth() === month)
    .sort((a, b) => new Date(a.birthday).getDate() - new Date(b.birthday).getDate())
    .map((e) => ({
      id: e.id,
      firstName: e.firstName,
      lastName: e.lastName,
      middleName: toMiddleInitial(e.middleName),
      suffix:e.suffix,
      prefix:e.prefix,
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
