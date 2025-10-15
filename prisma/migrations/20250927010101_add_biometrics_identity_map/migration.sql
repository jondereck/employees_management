-- CreateTable
CREATE TABLE "BiometricsIdentityMap" (
    "token" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BiometricsIdentityMap_pkey" PRIMARY KEY ("token")
);

-- CreateIndex
CREATE INDEX "BiometricsIdentityMap_employeeId_idx" ON "BiometricsIdentityMap"("employeeId");

-- AddForeignKey
ALTER TABLE "BiometricsIdentityMap" ADD CONSTRAINT "BiometricsIdentityMap_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
