-- CreateTable
CREATE TABLE "Training" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "employeeId" TEXT,
    "bioNumberRaw" TEXT NOT NULL,
    "officeNameRaw" TEXT NOT NULL DEFAULT '',
    "positionRaw" TEXT NOT NULL DEFAULT '',
    "appointmentRaw" TEXT NOT NULL DEFAULT '',
    "certificateTitle" TEXT NOT NULL,
    "trainingType" TEXT NOT NULL DEFAULT '',
    "provider" TEXT NOT NULL DEFAULT '',
    "dateStart" TIMESTAMP(3) NOT NULL,
    "dateEnd" TIMESTAMP(3) NOT NULL,
    "durationHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "certificateOf" TEXT NOT NULL DEFAULT '',
    "relevanceToJob" TEXT NOT NULL DEFAULT '',
    "competencyAddressed" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT '',
    "indicator" TEXT NOT NULL DEFAULT '',
    "remarks" TEXT,
    "sourceRowHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Training_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningDevelopmentTarget" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "targetEmployeesCoveredByTNA" INTEGER NOT NULL DEFAULT 0,
    "targetApprovedTrainingPrograms" INTEGER NOT NULL DEFAULT 0,
    "targetTrainingsConducted" INTEGER NOT NULL DEFAULT 0,
    "targetEmployeesTrained" INTEGER NOT NULL DEFAULT 0,
    "targetMandatoryTrainingsCompleted" INTEGER NOT NULL DEFAULT 0,
    "targetCompetencyGapsAddressed" INTEGER NOT NULL DEFAULT 0,
    "targetPostTrainingReports" INTEGER NOT NULL DEFAULT 0,
    "targetTrainingBudget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualTrainingBudgetUtilized" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningDevelopmentTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Training_departmentId_idx" ON "Training"("departmentId");

-- CreateIndex
CREATE INDEX "Training_employeeId_idx" ON "Training"("employeeId");

-- CreateIndex
CREATE INDEX "Training_indicator_idx" ON "Training"("indicator");

-- CreateIndex
CREATE UNIQUE INDEX "Training_departmentId_sourceRowHash_key" ON "Training"("departmentId", "sourceRowHash");

-- CreateIndex
CREATE INDEX "LearningDevelopmentTarget_departmentId_idx" ON "LearningDevelopmentTarget"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningDevelopmentTarget_departmentId_year_key" ON "LearningDevelopmentTarget"("departmentId", "year");

-- AddForeignKey
ALTER TABLE "Training" ADD CONSTRAINT "Training_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Training" ADD CONSTRAINT "Training_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "LearningDevelopmentTarget" ADD CONSTRAINT "LearningDevelopmentTarget_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

