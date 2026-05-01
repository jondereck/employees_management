import assert from "node:assert/strict";
import test from "node:test";

import JSZip from "jszip";

import {
  BACKUP_FORMAT_VERSION,
  BACKUP_MODEL_NAMES,
  BACKUP_SCOPE,
  type DepartmentBackupManifest,
  createEmptyCounts,
  createEmptyModelMap,
} from "../lib/backups/config";
import { BackupValidationError, buildBackupZip, parseBackupZip } from "../lib/backups/zip";

function validFixture() {
  const models = createEmptyModelMap();
  models.Department = [{ id: "dept-1", name: "HR", userId: "user-1" }];

  const counts = createEmptyCounts();
  for (const modelName of BACKUP_MODEL_NAMES) {
    counts[modelName] = models[modelName].length;
  }

  const manifest: DepartmentBackupManifest = {
    formatVersion: BACKUP_FORMAT_VERSION,
    scope: BACKUP_SCOPE,
    departmentId: "dept-1",
    departmentName: "HR",
    createdAt: "2026-05-01T00:00:00.000Z",
    createdBy: "user-1",
    reason: "manual",
    counts,
    app: {
      name: "employee_management",
      version: "0.1.0",
      schemaHash: null,
    },
  };

  return { manifest, models };
}

test("parses a valid department backup zip", async () => {
  const { manifest, models } = validFixture();
  const buffer = await buildBackupZip(manifest, models);

  const parsed = await parseBackupZip(buffer, { expectedDepartmentId: "dept-1" });

  assert.equal(parsed.manifest.departmentId, "dept-1");
  assert.equal(parsed.models.Department.length, 1);
});

test("rejects a backup for the wrong department", async () => {
  const { manifest, models } = validFixture();
  const buffer = await buildBackupZip(manifest, models);

  await assert.rejects(
    () => parseBackupZip(buffer, { expectedDepartmentId: "dept-2" }),
    BackupValidationError
  );
});

test("rejects backups missing a model file", async () => {
  const { manifest, models } = validFixture();
  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify(manifest));

  for (const modelName of BACKUP_MODEL_NAMES) {
    if (modelName !== "Employee") {
      zip.file(`models/${modelName}.json`, JSON.stringify(models[modelName]));
    }
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  await assert.rejects(() => parseBackupZip(buffer), /missing models\/Employee\.json/);
});

test("rejects manifest count mismatches", async () => {
  const { manifest, models } = validFixture();
  const badManifest = {
    ...manifest,
    counts: {
      ...manifest.counts,
      Employee: 99,
    },
  };
  const buffer = await buildBackupZip(badManifest, models);

  await assert.rejects(() => parseBackupZip(buffer), /Backup validation failed/);
});
