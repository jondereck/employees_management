CREATE TABLE "DepartmentBackup" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "manifest" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentBackup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DepartmentBackup_departmentId_createdAt_idx" ON "DepartmentBackup"("departmentId", "createdAt");

ALTER TABLE "DepartmentBackup"
ADD CONSTRAINT "DepartmentBackup_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
ON DELETE CASCADE ON UPDATE NO ACTION;
