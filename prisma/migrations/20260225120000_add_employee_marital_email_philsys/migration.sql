-- Additive, non-breaking changes for production-safe employee profile fields
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'SEPARATED', 'WIDOWED', 'DIVORCED');

ALTER TABLE "Employee"
  ADD COLUMN "maritalStatus" "MaritalStatus",
  ADD COLUMN "email" TEXT,
  ADD COLUMN "philSysNumber" TEXT;

CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");
CREATE UNIQUE INDEX "Employee_philSysNumber_key" ON "Employee"("philSysNumber");
