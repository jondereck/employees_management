-- AlterTable
ALTER TABLE "EmployeeHistorySnapshot" ADD COLUMN "indicatorId" TEXT;

-- CreateIndex
CREATE INDEX "EmployeeHistorySnapshot_indicatorId_idx" ON "EmployeeHistorySnapshot"("indicatorId");

-- AddForeignKey
ALTER TABLE "EmployeeHistorySnapshot" ADD CONSTRAINT "EmployeeHistorySnapshot_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "WorkforceReportGroup"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
