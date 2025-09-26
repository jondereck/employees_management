-- AlterTable
ALTER TABLE "Offices" ADD COLUMN     "bioIndexCode" VARCHAR(16);

-- CreateIndex
CREATE INDEX "Offices_bioIndexCode_idx" ON "Offices"("bioIndexCode");
