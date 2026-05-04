-- CreateTable
CREATE TABLE "OfficeWorkSchedule" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
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
    "weeklyPattern" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfficeWorkSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimekeepingAnalyzerSetting" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT '',
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimekeepingAnalyzerSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OfficeWorkSchedule_departmentId_officeId_effectiveFrom_effectiveTo_idx" ON "OfficeWorkSchedule"("departmentId", "officeId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "OfficeWorkSchedule_officeId_effectiveFrom_effectiveTo_idx" ON "OfficeWorkSchedule"("officeId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "TimekeepingAnalyzerSetting_departmentId_userId_scope_key_key" ON "TimekeepingAnalyzerSetting"("departmentId", "userId", "scope", "key");

-- CreateIndex
CREATE INDEX "TimekeepingAnalyzerSetting_departmentId_scope_key_idx" ON "TimekeepingAnalyzerSetting"("departmentId", "scope", "key");

-- CreateIndex
CREATE INDEX "TimekeepingAnalyzerSetting_departmentId_userId_idx" ON "TimekeepingAnalyzerSetting"("departmentId", "userId");

-- AddForeignKey
ALTER TABLE "OfficeWorkSchedule" ADD CONSTRAINT "OfficeWorkSchedule_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OfficeWorkSchedule" ADD CONSTRAINT "OfficeWorkSchedule_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Offices"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "TimekeepingAnalyzerSetting" ADD CONSTRAINT "TimekeepingAnalyzerSetting_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
