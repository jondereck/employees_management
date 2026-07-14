-- Additive: OfficeDivision + PlantillaPosition (no data rewrite / no reset)

-- CreateTable
CREATE TABLE "OfficeDivision" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficeDivision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantillaPosition" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "officeDivisionId" TEXT,
    "itemNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "salaryGrade" INTEGER,
    "salaryStep" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlantillaPosition_pkey" PRIMARY KEY ("id")
);

-- AlterTable Employee (nullable FKs; existing rows remain valid)
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "officeDivisionId" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "plantillaPositionId" TEXT;

-- AlterTable EmployeeHistorySnapshot (forward-looking nullable columns only)
ALTER TABLE "EmployeeHistorySnapshot" ADD COLUMN IF NOT EXISTS "officeDivisionId" TEXT;
ALTER TABLE "EmployeeHistorySnapshot" ADD COLUMN IF NOT EXISTS "plantillaPositionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "OfficeDivision_officeId_name_key" ON "OfficeDivision"("officeId", "name");
CREATE INDEX "OfficeDivision_departmentId_idx" ON "OfficeDivision"("departmentId");
CREATE INDEX "OfficeDivision_officeId_idx" ON "OfficeDivision"("officeId");
CREATE INDEX "OfficeDivision_officeId_sortOrder_idx" ON "OfficeDivision"("officeId", "sortOrder");

CREATE UNIQUE INDEX "PlantillaPosition_departmentId_itemNumber_key" ON "PlantillaPosition"("departmentId", "itemNumber");
CREATE INDEX "PlantillaPosition_departmentId_idx" ON "PlantillaPosition"("departmentId");
CREATE INDEX "PlantillaPosition_officeId_idx" ON "PlantillaPosition"("officeId");
CREATE INDEX "PlantillaPosition_officeDivisionId_idx" ON "PlantillaPosition"("officeDivisionId");
CREATE INDEX "PlantillaPosition_departmentId_isActive_idx" ON "PlantillaPosition"("departmentId", "isActive");

CREATE UNIQUE INDEX "Employee_plantillaPositionId_key" ON "Employee"("plantillaPositionId");
CREATE INDEX "Employee_officeDivisionId_idx" ON "Employee"("officeDivisionId");

CREATE INDEX "EmployeeHistorySnapshot_officeDivisionId_idx" ON "EmployeeHistorySnapshot"("officeDivisionId");
CREATE INDEX "EmployeeHistorySnapshot_plantillaPositionId_idx" ON "EmployeeHistorySnapshot"("plantillaPositionId");

-- AddForeignKey
ALTER TABLE "OfficeDivision" ADD CONSTRAINT "OfficeDivision_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "OfficeDivision" ADD CONSTRAINT "OfficeDivision_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Offices"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "PlantillaPosition" ADD CONSTRAINT "PlantillaPosition_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "PlantillaPosition" ADD CONSTRAINT "PlantillaPosition_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Offices"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "PlantillaPosition" ADD CONSTRAINT "PlantillaPosition_officeDivisionId_fkey" FOREIGN KEY ("officeDivisionId") REFERENCES "OfficeDivision"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "Employee" ADD CONSTRAINT "Employee_officeDivisionId_fkey" FOREIGN KEY ("officeDivisionId") REFERENCES "OfficeDivision"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_plantillaPositionId_fkey" FOREIGN KEY ("plantillaPositionId") REFERENCES "PlantillaPosition"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "EmployeeHistorySnapshot" ADD CONSTRAINT "EmployeeHistorySnapshot_officeDivisionId_fkey" FOREIGN KEY ("officeDivisionId") REFERENCES "OfficeDivision"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "EmployeeHistorySnapshot" ADD CONSTRAINT "EmployeeHistorySnapshot_plantillaPositionId_fkey" FOREIGN KEY ("plantillaPositionId") REFERENCES "PlantillaPosition"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
