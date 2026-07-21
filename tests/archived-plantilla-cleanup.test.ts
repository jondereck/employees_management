import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL(
  "../prisma/migrations/20260721090000_unlink_archived_plantilla/migration.sql",
  import.meta.url
);

test("cleanup migration idempotently unlinks archived plantilla occupants", () => {
  const sql = readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").trim();

  assert.match(sql, /UPDATE "Employee"/);
  assert.match(sql, /SET "plantillaPositionId" = NULL/);
  assert.match(sql, /WHERE "isArchived" = true/);
  assert.match(sql, /AND "plantillaPositionId" IS NOT NULL/);
  assert.doesNotMatch(sql, /DROP|ALTER|CREATE/i);
});
