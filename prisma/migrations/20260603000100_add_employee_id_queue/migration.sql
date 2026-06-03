-- Add an explicit ID-processing queue marker for employees.
ALTER TABLE "Employee" ADD COLUMN "idQueueAt" TIMESTAMP(3);

CREATE INDEX "Employee_departmentId_idQueueAt_idx" ON "Employee"("departmentId", "idQueueAt");
