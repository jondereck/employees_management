-- CreateEnum
CREATE TYPE "EligibilityTypes" AS ENUM ('None', 'Professional', 'SubProffessional');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('Male', 'Female');

-- CreateEnum
CREATE TYPE "EmploymentEventType" AS ENUM ('HIRED', 'PROMOTED', 'TRANSFERRED', 'REASSIGNED', 'AWARDED', 'CONTRACT_RENEWAL', 'TERMINATED', 'OTHER');

-- CreateEnum
CREATE TYPE "ChangeEntity" AS ENUM ('AWARD', 'TIMELINE');

-- CreateEnum
CREATE TYPE "ChangeAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "ChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Billboard" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "bioIndexCode" VARCHAR(16),

    CONSTRAINT "Billboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offices" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "billboardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeType" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Eligibility" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "eligibilityTypes" "EligibilityTypes" NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Eligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT NOT NULL,
    "suffix" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "education" TEXT NOT NULL,
    "birthday" TIMESTAMP(3) NOT NULL,
    "age" TEXT NOT NULL DEFAULT '',
    "region" TEXT NOT NULL DEFAULT '',
    "province" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "barangay" TEXT NOT NULL DEFAULT '',
    "houseNo" TEXT NOT NULL DEFAULT '',
    "street" TEXT NOT NULL DEFAULT '',
    "gsisNo" TEXT NOT NULL,
    "tinNo" TEXT NOT NULL,
    "philHealthNo" TEXT NOT NULL,
    "pagIbigNo" TEXT NOT NULL,
    "salary" DOUBLE PRECISION NOT NULL,
    "dateHired" TIMESTAMP(3) NOT NULL,
    "latestAppointment" TEXT NOT NULL DEFAULT '',
    "terminateDate" TEXT NOT NULL DEFAULT '',
    "memberPolicyNo" TEXT NOT NULL DEFAULT '',
    "employeeTypeId" TEXT NOT NULL,
    "eligibilityId" TEXT NOT NULL,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isHead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "emergencyContactName" TEXT NOT NULL DEFAULT '',
    "emergencyContactNumber" TEXT NOT NULL DEFAULT '',
    "isAwardee" BOOLEAN NOT NULL DEFAULT false,
    "nickname" TEXT NOT NULL DEFAULT '',
    "employeeNo" TEXT NOT NULL DEFAULT '',
    "employeeLink" TEXT NOT NULL DEFAULT '',
    "salaryStep" INTEGER DEFAULT 0,
    "salaryGrade" INTEGER DEFAULT 0,
    "designationId" TEXT,
    "note" TEXT,
    "publicId" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "publicEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publicVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Salary" (
    "id" SERIAL NOT NULL,
    "grade" INTEGER NOT NULL,
    "step" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Salary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmploymentEvent" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" TEXT NOT NULL,
    "type" "EmploymentEventType" NOT NULL,
    "details" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EmploymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Award" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "givenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "issuer" TEXT,
    "thumbnail" TEXT,
    "fileUrl" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Award_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeRequest" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "entityType" "ChangeEntity" NOT NULL,
    "entityId" TEXT,
    "action" "ChangeAction" NOT NULL,
    "status" "ChangeStatus" NOT NULL DEFAULT 'PENDING',
    "oldValues" JSONB,
    "newValues" JSONB,
    "note" TEXT,
    "submittedName" TEXT,
    "submittedEmail" TEXT,
    "ipHash" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Billboard_departmentId_idx" ON "Billboard"("departmentId");

-- CreateIndex
CREATE INDEX "Offices_departmentId_idx" ON "Offices"("departmentId");

-- CreateIndex
CREATE INDEX "Offices_billboardId_idx" ON "Offices"("billboardId");

-- CreateIndex
CREATE INDEX "EmployeeType_departmentId_idx" ON "EmployeeType"("departmentId");

-- CreateIndex
CREATE INDEX "Eligibility_departmentId_idx" ON "Eligibility"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_publicId_key" ON "Employee"("publicId");

-- CreateIndex
CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");

-- CreateIndex
CREATE INDEX "Employee_officeId_idx" ON "Employee"("officeId");

-- CreateIndex
CREATE INDEX "Employee_employeeTypeId_idx" ON "Employee"("employeeTypeId");

-- CreateIndex
CREATE INDEX "Employee_eligibilityId_idx" ON "Employee"("eligibilityId");

-- CreateIndex
CREATE INDEX "Employee_designationId_idx" ON "Employee"("designationId");

-- CreateIndex
CREATE INDEX "Image_employeeId_idx" ON "Image"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Salary_grade_step_key" ON "Salary"("grade", "step");

-- CreateIndex
CREATE INDEX "EmploymentEvent_employeeId_occurredAt_idx" ON "EmploymentEvent"("employeeId", "occurredAt");

-- CreateIndex
CREATE INDEX "Award_employeeId_idx" ON "Award"("employeeId");

-- CreateIndex
CREATE INDEX "changerequest_dept_status_created_idx" ON "ChangeRequest"("departmentId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "changerequest_employeeid_idx" ON "ChangeRequest"("employeeId");

-- CreateIndex
CREATE INDEX "changerequest_entitytype_entityid_idx" ON "ChangeRequest"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Billboard" ADD CONSTRAINT "billboard_departmentid_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Offices" ADD CONSTRAINT "offices_billboardid_fkey" FOREIGN KEY ("billboardId") REFERENCES "Billboard"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Offices" ADD CONSTRAINT "offices_departmentid_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "employee_departmentid_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "employee_designationid_fkey" FOREIGN KEY ("designationId") REFERENCES "Offices"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "employee_eligibilityid_fkey" FOREIGN KEY ("eligibilityId") REFERENCES "Eligibility"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "employee_employeetypeid_fkey" FOREIGN KEY ("employeeTypeId") REFERENCES "EmployeeType"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "employee_officeid_fkey" FOREIGN KEY ("officeId") REFERENCES "Offices"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "image_employeeid_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "EmploymentEvent" ADD CONSTRAINT "EmploymentEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Award" ADD CONSTRAINT "Award_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "changerequest_departmentid_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "changerequest_employeeid_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
