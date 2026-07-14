-- Allow empty/missing plantilla item numbers (e.g. Casual slots).
-- PostgreSQL UNIQUE treats NULL as distinct, so multiple NULL itemNumbers are allowed.

ALTER TABLE "PlantillaPosition" ALTER COLUMN "itemNumber" DROP NOT NULL;

-- Normalize blank strings to NULL so they don't collide on the unique constraint.
UPDATE "PlantillaPosition" SET "itemNumber" = NULL WHERE TRIM(COALESCE("itemNumber", '')) = '';
