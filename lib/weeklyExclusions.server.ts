import { prisma } from "@/lib/prisma";
import { toWeeklyExclusionEvaluation } from "@/lib/weeklyExclusions";

export const getWeeklyExclusionForDate = async (
  employeeId: string,
  dateISO: string
) => {
  if (!employeeId) return null;
  const date = new Date(`${dateISO}T00:00:00.000Z`);
  const weekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  const exclusion = await prisma.weeklyExclusion.findFirst({
    where: {
      employeeId,
      weekday,
      effectiveFrom: { lte: date },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
  return exclusion ? toWeeklyExclusionEvaluation(exclusion) : null;
};
