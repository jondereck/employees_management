-- CreateTable
CREATE TABLE "EmployeeHistorySnapshot" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "officeId" TEXT,
    "employeeTypeId" TEXT,
    "eligibilityId" TEXT,
    "position" TEXT NOT NULL DEFAULT '',
    "gender" "Gender",
    "maritalStatus" "MaritalStatus",
    "isHead" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeHistorySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkforceReportGroup" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkforceReportGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkforceReportGroupOffice" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkforceReportGroupOffice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeHistorySnapshot_departmentId_effectiveAt_idx" ON "EmployeeHistorySnapshot"("departmentId", "effectiveAt");

-- CreateIndex
CREATE INDEX "EmployeeHistorySnapshot_employeeId_effectiveAt_idx" ON "EmployeeHistorySnapshot"("employeeId", "effectiveAt");

-- CreateIndex
CREATE INDEX "EmployeeHistorySnapshot_departmentId_employeeId_effectiveAt_idx" ON "EmployeeHistorySnapshot"("departmentId", "employeeId", "effectiveAt");

-- CreateIndex
CREATE INDEX "EmployeeHistorySnapshot_officeId_idx" ON "EmployeeHistorySnapshot"("officeId");

-- CreateIndex
CREATE INDEX "EmployeeHistorySnapshot_employeeTypeId_idx" ON "EmployeeHistorySnapshot"("employeeTypeId");

-- CreateIndex
CREATE INDEX "EmployeeHistorySnapshot_eligibilityId_idx" ON "EmployeeHistorySnapshot"("eligibilityId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkforceReportGroup_departmentId_name_key" ON "WorkforceReportGroup"("departmentId", "name");

-- CreateIndex
CREATE INDEX "WorkforceReportGroup_departmentId_sortOrder_idx" ON "WorkforceReportGroup"("departmentId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "WorkforceReportGroupOffice_groupId_officeId_key" ON "WorkforceReportGroupOffice"("groupId", "officeId");

-- CreateIndex
CREATE INDEX "WorkforceReportGroupOffice_officeId_idx" ON "WorkforceReportGroupOffice"("officeId");

-- AddForeignKey
ALTER TABLE "EmployeeHistorySnapshot" ADD CONSTRAINT "EmployeeHistorySnapshot_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "EmployeeHistorySnapshot" ADD CONSTRAINT "EmployeeHistorySnapshot_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "EmployeeHistorySnapshot" ADD CONSTRAINT "EmployeeHistorySnapshot_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Offices"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "EmployeeHistorySnapshot" ADD CONSTRAINT "EmployeeHistorySnapshot_employeeTypeId_fkey" FOREIGN KEY ("employeeTypeId") REFERENCES "EmployeeType"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "EmployeeHistorySnapshot" ADD CONSTRAINT "EmployeeHistorySnapshot_eligibilityId_fkey" FOREIGN KEY ("eligibilityId") REFERENCES "Eligibility"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "WorkforceReportGroup" ADD CONSTRAINT "WorkforceReportGroup_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "WorkforceReportGroupOffice" ADD CONSTRAINT "WorkforceReportGroupOffice_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "WorkforceReportGroup"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "WorkforceReportGroupOffice" ADD CONSTRAINT "WorkforceReportGroupOffice_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Offices"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
