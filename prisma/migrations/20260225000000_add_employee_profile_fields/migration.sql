-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'SEPARATED', 'WIDOWED', 'DIVORCED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "Employee"
  ADD COLUMN IF NOT EXISTS "maritalStatus" "MaritalStatus",
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "philSysNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Employee_philSysNumber_key" ON "Employee"("philSysNumber");
