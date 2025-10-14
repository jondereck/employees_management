-- AddColumn
ALTER TABLE "Employee" ADD COLUMN "biometricsUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Employee_biometricsUserId_key" ON "Employee"("biometricsUserId");
