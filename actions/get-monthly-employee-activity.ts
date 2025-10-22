import prismadb from "@/lib/prismadb";

type MonthlyEmployeeActivity = {
  currentCount: number;
  previousCount: number;
};

const monthRange = (year: number, month: number) => {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);
  return { start, end };
};

export const getMonthlyEmployeeActivity = async (
  departmentId: string
): Promise<MonthlyEmployeeActivity> => {
  const now = new Date();
  const { start: currentStart, end: currentEnd } = monthRange(now.getFullYear(), now.getMonth());
  const { start: previousStart, end: previousEnd } = monthRange(
    now.getFullYear(),
    now.getMonth() - 1
  );

  const [currentCount, previousCount] = await Promise.all([
    prismadb.employee.count({
      where: {
        departmentId,
        isArchived: false,
        OR: [
          { createdAt: { gte: currentStart, lt: currentEnd } },
          { updatedAt: { gte: currentStart, lt: currentEnd } },
        ],
      },
    }),
    prismadb.employee.count({
      where: {
        departmentId,
        isArchived: false,
        OR: [
          { createdAt: { gte: previousStart, lt: previousEnd } },
          { updatedAt: { gte: previousStart, lt: previousEnd } },
        ],
      },
    }),
  ]);

  return {
    currentCount,
    previousCount,
  };
};

