-- CreateTable
CREATE TABLE "EmployeeExportTemplate" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeExportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeExportTemplate_departmentId_userId_idx" ON "EmployeeExportTemplate"("departmentId", "userId");

-- CreateIndex
CREATE INDEX "EmployeeExportTemplate_departmentId_userId_updatedAt_idx" ON "EmployeeExportTemplate"("departmentId", "userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "EmployeeExportTemplate" ADD CONSTRAINT "EmployeeExportTemplate_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
