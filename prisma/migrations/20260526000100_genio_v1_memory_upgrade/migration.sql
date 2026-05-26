-- Genio v1 memory upgrade
ALTER TABLE "GenioResultContext"
  ALTER COLUMN "question" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "languageHint" TEXT,
  ADD COLUMN IF NOT EXISTS "localeHint" TEXT,
  ADD COLUMN IF NOT EXISTS "recencyScore" DOUBLE PRECISION NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS "GenioResultContext_departmentId_userId_expiresAt_idx"
  ON "GenioResultContext"("departmentId", "userId", "expiresAt");
