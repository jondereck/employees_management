ALTER TYPE "SmsLogStatus" ADD VALUE IF NOT EXISTS 'QUEUED';
ALTER TYPE "SmsLogStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "SmsLogStatus" ADD VALUE IF NOT EXISTS 'UNDELIVERED';
ALTER TYPE "SmsLogStatus" ADD VALUE IF NOT EXISTS 'RECEIVED';

CREATE INDEX IF NOT EXISTS "SmsLog_providerMessageId_idx" ON "SmsLog"("providerMessageId");

CREATE TABLE "SmsInboundMessage" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT,
    "employeeId" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "toNumber" TEXT,
    "message" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'twilio',
    "providerMessageId" TEXT,
    "requestMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsInboundMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SmsInboundMessage_providerMessageId_key" ON "SmsInboundMessage"("providerMessageId");
CREATE INDEX "SmsInboundMessage_departmentId_idx" ON "SmsInboundMessage"("departmentId");
CREATE INDEX "SmsInboundMessage_employeeId_idx" ON "SmsInboundMessage"("employeeId");
CREATE INDEX "SmsInboundMessage_phoneNumber_idx" ON "SmsInboundMessage"("phoneNumber");
CREATE INDEX "SmsInboundMessage_createdAt_idx" ON "SmsInboundMessage"("createdAt");

ALTER TABLE "SmsInboundMessage"
ADD CONSTRAINT "SmsInboundMessage_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "SmsInboundMessage"
ADD CONSTRAINT "SmsInboundMessage_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
ON DELETE SET NULL ON UPDATE NO ACTION;
