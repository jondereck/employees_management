import type { PrismaClient } from "@prisma/client";

let ensureWeeklyPatternPromise: Promise<void> | null = null;

export const ensureWeeklyPatternColumn = (prisma: PrismaClient) => {
  if (!ensureWeeklyPatternPromise) {
    ensureWeeklyPatternPromise = prisma
      .$executeRaw`ALTER TABLE "WorkSchedule" ADD COLUMN IF NOT EXISTS "weeklyPattern" JSONB`
      .then(() => undefined)
      .catch((error) => {
        ensureWeeklyPatternPromise = null;
        throw error;
      });
  }

  return ensureWeeklyPatternPromise;
};
