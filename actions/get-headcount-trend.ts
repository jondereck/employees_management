import prismadb from "@/lib/prismadb";

export type HeadcountTrendPoint = {
  name: string;
  [employeeType: string]: number | string;
};

export type HeadcountTrendResult = {
  data: HeadcountTrendPoint[];
  series: string[];
};

const toMonthKey = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  const key = `${year}-${String(month + 1).padStart(2, "0")}`;
  const label = new Date(year, month, 1).toLocaleString("default", {
    month: "short",
    year: "numeric",
  });
  return { key, label };
};

export const getHeadcountTrend = async (
  departmentId: string
): Promise<HeadcountTrendResult> => {
  const employees = await prismadb.employee.findMany({
    where: {
      departmentId,
      isArchived: false,
    },
    select: {
      createdAt: true,
      employeeType: {
        select: {
          name: true,
        },
      },
    },
  });

  const typeSet = new Set<string>();
  const monthMap = new Map<
    string,
    { name: string; counts: Record<string, number> }
  >();

  for (const employee of employees) {
    const typeName = employee.employeeType?.name?.trim() || "Uncategorized";
    typeSet.add(typeName);

    const { key, label } = toMonthKey(employee.createdAt);
    if (!monthMap.has(key)) {
      monthMap.set(key, { name: label, counts: {} });
    }
    const monthEntry = monthMap.get(key)!;
    monthEntry.counts[typeName] = (monthEntry.counts[typeName] || 0) + 1;
  }

  const sortedData = Array.from(monthMap.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, value]) => {
      const point: HeadcountTrendPoint = { name: value.name };
      for (const type of typeSet) {
        point[type] = value.counts[type] || 0;
      }
      return point;
    });

  return {
    data: sortedData,
    series: Array.from(typeSet),
  };
};

