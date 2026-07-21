-- Data-only cleanup: archived employees cannot occupy current plantilla slots.
-- The non-null predicate makes this migration idempotent.
UPDATE "Employee"
SET "plantillaPositionId" = NULL
WHERE "isArchived" = true
  AND "plantillaPositionId" IS NOT NULL;
