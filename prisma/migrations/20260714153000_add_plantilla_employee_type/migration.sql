-- Additive: PlantillaPosition.employeeTypeId (Status from EmployeeType catalog)

ALTER TABLE "PlantillaPosition" ADD COLUMN IF NOT EXISTS "employeeTypeId" TEXT;

CREATE INDEX IF NOT EXISTS "PlantillaPosition_employeeTypeId_idx" ON "PlantillaPosition"("employeeTypeId");

ALTER TABLE "PlantillaPosition"
  DROP CONSTRAINT IF EXISTS "PlantillaPosition_employeeTypeId_fkey";

ALTER TABLE "PlantillaPosition"
  ADD CONSTRAINT "PlantillaPosition_employeeTypeId_fkey"
  FOREIGN KEY ("employeeTypeId") REFERENCES "EmployeeType"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
