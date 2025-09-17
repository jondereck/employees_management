ALTER TABLE "Employee" ADD COLUMN "note" TEXT;
ALTER TABLE "Employee" ADD COLUMN "designationId" TEXT;
CREATE INDEX "Employee_designationId_idx" ON "Employee"("designationId");
