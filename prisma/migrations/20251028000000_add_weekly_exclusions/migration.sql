CREATE TABLE "WeeklyExclusion" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "ignoreUntil" TIMESTAMP(3),
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "WeeklyExclusion"
  ADD CONSTRAINT "WeeklyExclusion_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE INDEX "WeeklyExclusion_employeeId_weekday_effective_idx"
  ON "WeeklyExclusion"("employeeId", "weekday", "effectiveFrom", "effectiveTo");
