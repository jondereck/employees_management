-- CreateTable
CREATE TABLE "WorkforceReportCache" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "populationMode" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "selectedGroupHash" TEXT NOT NULL,
    "selectedGroupIds" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkforceReportCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkforceReportCache_departmentId_year_idx" ON "WorkforceReportCache"("departmentId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "WorkforceReportCache_departmentId_year_populationMode_dimension_s_key"
ON "WorkforceReportCache"("departmentId", "year", "populationMode", "dimension", "selectedGroupHash", "version");

-- AddForeignKey
ALTER TABLE "WorkforceReportCache"
ADD CONSTRAINT "WorkforceReportCache_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
