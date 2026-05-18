CREATE TYPE "SmsLogStatus" AS ENUM ('SENT', 'FAILED');

CREATE TABLE "SmsLog" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "employeeId" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'unisms',
    "providerMessageId" TEXT,
    "senderId" TEXT,
    "status" "SmsLogStatus" NOT NULL,
    "errorMessage" TEXT,
    "requestMeta" JSONB,
    "responseBody" JSONB,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SmsLog_departmentId_idx" ON "SmsLog"("departmentId");
CREATE INDEX "SmsLog_employeeId_idx" ON "SmsLog"("employeeId");
CREATE INDEX "SmsLog_phoneNumber_idx" ON "SmsLog"("phoneNumber");
CREATE INDEX "SmsLog_status_idx" ON "SmsLog"("status");
CREATE INDEX "SmsLog_createdAt_idx" ON "SmsLog"("createdAt");

ALTER TABLE "SmsLog"
ADD CONSTRAINT "SmsLog_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "SmsLog"
ADD CONSTRAINT "SmsLog_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
ON DELETE SET NULL ON UPDATE NO ACTION;
