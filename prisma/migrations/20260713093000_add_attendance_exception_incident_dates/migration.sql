-- Additive only: store grouped incident date lists on AttendanceException rows.
ALTER TABLE "AttendanceException" ADD COLUMN IF NOT EXISTS "incidentDates" TEXT NOT NULL DEFAULT '';
