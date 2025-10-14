-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('FIXED', 'FLEX', 'SHIFT');

-- CreateTable
CREATE TABLE "WorkSchedule" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "ScheduleType" NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "graceMinutes" INTEGER,
    "coreStart" TEXT,
    "coreEnd" TEXT,
    "bandwidthStart" TEXT,
    "bandwidthEnd" TEXT,
    "requiredDailyMinutes" INTEGER,
    "shiftStart" TEXT,
    "shiftEnd" TEXT,
    "breakMinutes" INTEGER NOT NULL DEFAULT 60,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Manila',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    CONSTRAINT "WorkSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleException" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "ScheduleType" NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "graceMinutes" INTEGER,
    "coreStart" TEXT,
    "coreEnd" TEXT,
    "bandwidthStart" TEXT,
    "bandwidthEnd" TEXT,
    "requiredDailyMinutes" INTEGER,
    "shiftStart" TEXT,
    "shiftEnd" TEXT,
    "breakMinutes" INTEGER,
    CONSTRAINT "ScheduleException_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WorkSchedule" ADD CONSTRAINT "WorkSchedule_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "ScheduleException" ADD CONSTRAINT "ScheduleException_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- CreateIndex
CREATE INDEX "WorkSchedule_employeeId_effectiveFrom_effectiveTo_idx" ON "WorkSchedule"("employeeId", "effectiveFrom", "effectiveTo");

CREATE INDEX "ScheduleException_employeeId_date_idx" ON "ScheduleException"("employeeId", "date");
