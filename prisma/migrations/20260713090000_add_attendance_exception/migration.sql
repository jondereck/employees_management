-- CreateEnum
CREATE TYPE "AttendanceExceptionType" AS ENUM ('T', 'U', 'MD', 'FD', 'UA', 'AWOL');

-- CreateEnum
CREATE TYPE "AttendanceExceptionStatus" AS ENUM ('Open', 'CounselingConducted', 'MemorandumIssued', 'Resolved', 'ForAdministrativeAction');

-- CreateEnum
CREATE TYPE "AttendanceExceptionSource" AS ENUM ('auto', 'manual');

-- CreateTable
CREATE TABLE "AttendanceException" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "employeeId" TEXT,
    "employeeNo" TEXT NOT NULL DEFAULT '',
    "employeeName" TEXT NOT NULL,
    "officeName" TEXT NOT NULL DEFAULT '',
    "incidentDate" TIMESTAMP(3) NOT NULL,
    "exceptionType" "AttendanceExceptionType" NOT NULL,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "actionTaken" TEXT NOT NULL DEFAULT '',
    "status" "AttendanceExceptionStatus" NOT NULL DEFAULT 'Open',
    "remarks" TEXT NOT NULL DEFAULT '',
    "reportingPeriod" TEXT NOT NULL,
    "source" "AttendanceExceptionSource" NOT NULL DEFAULT 'manual',
    "importKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceException_departmentId_importKey_key" ON "AttendanceException"("departmentId", "importKey");

-- CreateIndex
CREATE INDEX "AttendanceException_departmentId_reportingPeriod_idx" ON "AttendanceException"("departmentId", "reportingPeriod");

-- CreateIndex
CREATE INDEX "AttendanceException_departmentId_exceptionType_idx" ON "AttendanceException"("departmentId", "exceptionType");

-- CreateIndex
CREATE INDEX "AttendanceException_employeeId_idx" ON "AttendanceException"("employeeId");

-- AddForeignKey
ALTER TABLE "AttendanceException" ADD CONSTRAINT "AttendanceException_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "AttendanceException" ADD CONSTRAINT "AttendanceException_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
