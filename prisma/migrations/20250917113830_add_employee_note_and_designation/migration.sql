-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "designationId" TEXT,
ADD COLUMN     "note" TEXT;

-- CreateIndex
CREATE INDEX "Employee_designationId_idx" ON "Employee"("designationId");
