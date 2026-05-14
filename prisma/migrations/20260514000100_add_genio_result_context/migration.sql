-- CreateTable
CREATE TABLE "GenioResultContext" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "toolArgsJson" JSONB NOT NULL,
    "resultKind" TEXT NOT NULL,
    "rowIdsJson" JSONB,
    "aggregateJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenioResultContext_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GenioResultContext_departmentId_userId_createdAt_idx" ON "GenioResultContext"("departmentId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "GenioResultContext_expiresAt_idx" ON "GenioResultContext"("expiresAt");

-- AddForeignKey
ALTER TABLE "GenioResultContext" ADD CONSTRAINT "GenioResultContext_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
