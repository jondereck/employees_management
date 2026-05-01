import { createHash, randomUUID } from "crypto";
import { readFile } from "fs/promises";
import path from "path";

import prismadb from "@/lib/prismadb";

import {
  BACKUP_MODEL_NAMES,
  type BackupCounts,
  type BackupModelMap,
  type BackupModelName,
  type BackupReason,
  type DepartmentBackupManifest,
  type ParsedDepartmentBackup,
  createEmptyCounts,
  createEmptyModelMap,
} from "./config";
import { LocalBackupStorage, type StoredBackupSummary } from "./storage";
import { BackupValidationError, buildBackupZip, parseBackupZip } from "./zip";

export type BackupSummary = StoredBackupSummary & {
  manifest: DepartmentBackupManifest;
};

type CreateBackupOptions = {
  departmentId: string;
  createdBy: string;
  reason?: BackupReason;
};

type RestoreBackupOptions = {
  departmentId: string;
  restoredBy: string;
  buffer: Buffer;
};

const DEFAULT_RESTORE_TRANSACTION_TIMEOUT_MS = 5 * 60 * 1000;

const DATE_FIELDS: Partial<Record<BackupModelName, string[]>> = {
  Department: ["createdAt", "updatedAt"],
  Billboard: ["createdAt", "updatedAt"],
  Offices: ["createdAt", "updatedAt"],
  EmployeeType: ["createdAt", "updatedAt"],
  Eligibility: ["createdAt", "updatedAt"],
  Employee: ["birthday", "dateHired", "createdAt", "updatedAt"],
  Image: ["createdAt", "updatedAt"],
  EmploymentEvent: ["occurredAt", "createdAt", "updatedAt", "deletedAt"],
  Award: ["givenAt", "createdAt", "updatedAt", "deletedAt"],
  BiometricsIdentityMap: ["createdAt", "updatedAt"],
  WorkSchedule: ["effectiveFrom", "effectiveTo"],
  ScheduleException: ["date"],
  WeeklyExclusion: ["ignoreUntil", "effectiveFrom", "effectiveTo", "createdAt", "updatedAt"],
  OrgChartVersion: ["createdAt"],
  ChangeRequest: ["reviewedAt", "createdAt", "updatedAt"],
};

function nowBackupStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function backupIdFor(departmentId: string, reason: BackupReason) {
  const prefix = reason === "pre-restore" ? "pre-restore" : "backup";
  return `${prefix}-${departmentId.slice(0, 8)}-${nowBackupStamp()}-${randomUUID().slice(0, 8)}`;
}

function restoreTransactionTimeoutMs() {
  const raw = Number(process.env.BACKUP_RESTORE_TRANSACTION_TIMEOUT_MS);
  return Number.isFinite(raw) && raw >= 60_000
    ? raw
    : DEFAULT_RESTORE_TRANSACTION_TIMEOUT_MS;
}

function countsFor(models: BackupModelMap) {
  const counts = createEmptyCounts();
  for (const modelName of BACKUP_MODEL_NAMES) {
    counts[modelName] = models[modelName].length;
  }
  return counts;
}

async function packageMetadata() {
  try {
    const raw = await readFile(path.join(process.cwd(), "package.json"), "utf8");
    const parsed = JSON.parse(raw) as { name?: string; version?: string };
    return {
      name: parsed.name ?? "employee_management",
      version: parsed.version ?? "0.0.0",
    };
  } catch {
    return { name: "employee_management", version: "0.0.0" };
  }
}

async function prismaSchemaHash() {
  try {
    const raw = await readFile(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8");
    return createHash("sha256").update(raw).digest("hex");
  } catch {
    return null;
  }
}

function restoreDateFields(modelName: BackupModelName, rows: Record<string, unknown>[]) {
  const fields = DATE_FIELDS[modelName] ?? [];
  return rows.map((row) => {
    const copy: Record<string, unknown> = { ...row };
    for (const field of fields) {
      const value = copy[field];
      if (typeof value === "string" && value) {
        copy[field] = new Date(value);
      }
    }
    return copy;
  });
}

function forceDepartmentId(rows: Record<string, unknown>[], departmentId: string) {
  return rows.map((row) => ({ ...row, departmentId }));
}

async function createMany(
  delegate: any,
  rows: Record<string, unknown>[]
) {
  if (!rows.length) return;
  await delegate.createMany({ data: rows });
}

export async function collectDepartmentBackupData(departmentId: string) {
  const department = await prismadb.department.findUnique({
    where: { id: departmentId },
  });

  if (!department) {
    throw new Error("Department not found.");
  }

  const models = createEmptyModelMap();
  models.Department = [department as unknown as Record<string, unknown>];
  models.Billboard = (await prismadb.billboard.findMany({
    where: { departmentId },
    orderBy: { id: "asc" },
  })) as unknown as Record<string, unknown>[];
  models.Offices = (await prismadb.offices.findMany({
    where: { departmentId },
    orderBy: { id: "asc" },
  })) as unknown as Record<string, unknown>[];
  models.EmployeeType = (await prismadb.employeeType.findMany({
    where: { departmentId },
    orderBy: { id: "asc" },
  })) as unknown as Record<string, unknown>[];
  models.Eligibility = (await prismadb.eligibility.findMany({
    where: { departmentId },
    orderBy: { id: "asc" },
  })) as unknown as Record<string, unknown>[];
  models.Employee = (await prismadb.employee.findMany({
    where: { departmentId },
    orderBy: { id: "asc" },
  })) as unknown as Record<string, unknown>[];

  const employeeIds = models.Employee
    .map((employee) => employee.id)
    .filter((id): id is string => typeof id === "string");
  const employeeWhere = { employeeId: { in: employeeIds } };

  models.Image = (await prismadb.image.findMany({
    where: employeeWhere,
    orderBy: { id: "asc" },
  })) as unknown as Record<string, unknown>[];
  models.EmploymentEvent = (await prismadb.employmentEvent.findMany({
    where: employeeWhere,
    orderBy: { id: "asc" },
  })) as unknown as Record<string, unknown>[];
  models.Award = (await prismadb.award.findMany({
    where: employeeWhere,
    orderBy: { id: "asc" },
  })) as unknown as Record<string, unknown>[];
  models.BiometricsIdentityMap = (await prismadb.biometricsIdentityMap.findMany({
    where: employeeWhere,
    orderBy: { token: "asc" },
  })) as unknown as Record<string, unknown>[];
  models.WorkSchedule = (await prismadb.workSchedule.findMany({
    where: employeeWhere,
    orderBy: { id: "asc" },
  })) as unknown as Record<string, unknown>[];
  models.ScheduleException = (await prismadb.scheduleException.findMany({
    where: employeeWhere,
    orderBy: { id: "asc" },
  })) as unknown as Record<string, unknown>[];
  models.WeeklyExclusion = (await prismadb.weeklyExclusion.findMany({
    where: employeeWhere,
    orderBy: { id: "asc" },
  })) as unknown as Record<string, unknown>[];
  models.OrgChartVersion = (await prismadb.orgChartVersion.findMany({
    where: { departmentId },
    orderBy: { id: "asc" },
  })) as unknown as Record<string, unknown>[];
  models.ChangeRequest = (await prismadb.changeRequest.findMany({
    where: { departmentId },
    orderBy: { id: "asc" },
  })) as unknown as Record<string, unknown>[];

  return { department, models };
}

export async function createDepartmentBackup({
  departmentId,
  createdBy,
  reason = "manual",
}: CreateBackupOptions) {
  const { department, models } = await collectDepartmentBackupData(departmentId);
  const [pkg, schemaHash] = await Promise.all([packageMetadata(), prismaSchemaHash()]);

  const manifest: DepartmentBackupManifest = {
    formatVersion: 1,
    scope: "department",
    departmentId,
    departmentName: department.name,
    createdAt: new Date().toISOString(),
    createdBy,
    reason,
    counts: countsFor(models),
    app: {
      name: pkg.name,
      version: pkg.version,
      schemaHash,
    },
  };

  const buffer = await buildBackupZip(manifest, models);
  const storage = new LocalBackupStorage();
  const stored = await storage.save(backupIdFor(departmentId, reason), buffer);

  return {
    backup: {
      ...stored,
      manifest,
    } satisfies BackupSummary,
  };
}

export async function listDepartmentBackups(departmentId: string) {
  const storage = new LocalBackupStorage();
  const storedBackups = await storage.list();
  const backups: BackupSummary[] = [];

  for (const stored of storedBackups) {
    try {
      const buffer = await storage.read(stored.id);
      const parsed = await parseBackupZip(buffer, { expectedDepartmentId: departmentId });
      backups.push({ ...stored, manifest: parsed.manifest });
    } catch {
      // Invalid backups and backups for another department are intentionally hidden.
    }
  }

  return backups;
}

export async function readLocalBackup(backupId: string) {
  const storage = new LocalBackupStorage();
  try {
    return await storage.read(backupId);
  } catch (error: any) {
    if (error?.message === "Invalid backup id.") {
      throw new BackupValidationError("Invalid backup id.");
    }
    if (error?.code === "ENOENT") {
      throw new BackupValidationError("Backup not found.");
    }
    throw error;
  }
}

export async function validateDepartmentBackupBuffer(
  buffer: Buffer,
  departmentId: string
) {
  return parseBackupZip(buffer, { expectedDepartmentId: departmentId });
}

async function deleteCurrentDepartmentData(tx: any, departmentId: string) {
  const existingEmployees = await tx.employee.findMany({
    where: { departmentId },
    select: { id: true },
  });
  const employeeIds = existingEmployees.map((employee: { id: string }) => employee.id);
  const employeeWhere = { employeeId: { in: employeeIds } };

  await tx.changeRequest.deleteMany({ where: { departmentId } });
  await tx.orgChartVersion.deleteMany({ where: { departmentId } });

  if (employeeIds.length) {
    await tx.weeklyExclusion.deleteMany({ where: employeeWhere });
    await tx.scheduleException.deleteMany({ where: employeeWhere });
    await tx.workSchedule.deleteMany({ where: employeeWhere });
    await tx.biometricsIdentityMap.deleteMany({ where: employeeWhere });
    await tx.award.deleteMany({ where: employeeWhere });
    await tx.employmentEvent.deleteMany({ where: employeeWhere });
    await tx.image.deleteMany({ where: employeeWhere });
  }

  await tx.employee.deleteMany({ where: { departmentId } });
  await tx.offices.deleteMany({ where: { departmentId } });
  await tx.billboard.deleteMany({ where: { departmentId } });
  await tx.employeeType.deleteMany({ where: { departmentId } });
  await tx.eligibility.deleteMany({ where: { departmentId } });
}

async function restoreParsedBackup(
  parsed: ParsedDepartmentBackup,
  departmentId: string,
  ownerUserId: string
) {
  const models = parsed.models;

  await prismadb.$transaction(
    async (tx) => {
      await deleteCurrentDepartmentData(tx, departmentId);

      const [department] = restoreDateFields("Department", models.Department);
      const { id: _id, ...departmentData } = department;
      await tx.department.update({
        where: { id: departmentId },
        data: {
          ...departmentData,
          userId: ownerUserId,
        },
      });

      await createMany(
        tx.billboard,
        forceDepartmentId(restoreDateFields("Billboard", models.Billboard), departmentId)
      );
      await createMany(
        tx.employeeType,
        forceDepartmentId(restoreDateFields("EmployeeType", models.EmployeeType), departmentId)
      );
      await createMany(
        tx.eligibility,
        forceDepartmentId(restoreDateFields("Eligibility", models.Eligibility), departmentId)
      );
      await createMany(
        tx.offices,
        forceDepartmentId(restoreDateFields("Offices", models.Offices), departmentId)
      );
      await createMany(
        tx.employee,
        forceDepartmentId(restoreDateFields("Employee", models.Employee), departmentId)
      );
      await createMany(
        tx.orgChartVersion,
        forceDepartmentId(restoreDateFields("OrgChartVersion", models.OrgChartVersion), departmentId)
      );
      await createMany(tx.image, restoreDateFields("Image", models.Image));
      await createMany(
        tx.employmentEvent,
        restoreDateFields("EmploymentEvent", models.EmploymentEvent)
      );
      await createMany(tx.award, restoreDateFields("Award", models.Award));
      await createMany(
        tx.biometricsIdentityMap,
        restoreDateFields("BiometricsIdentityMap", models.BiometricsIdentityMap)
      );
      await createMany(
        tx.workSchedule,
        restoreDateFields("WorkSchedule", models.WorkSchedule)
      );
      await createMany(
        tx.scheduleException,
        restoreDateFields("ScheduleException", models.ScheduleException)
      );
      await createMany(
        tx.weeklyExclusion,
        restoreDateFields("WeeklyExclusion", models.WeeklyExclusion)
      );
      await createMany(
        tx.changeRequest,
        forceDepartmentId(restoreDateFields("ChangeRequest", models.ChangeRequest), departmentId)
      );
    },
    { maxWait: 20_000, timeout: restoreTransactionTimeoutMs() }
  );
}

export async function restoreDepartmentBackup({
  departmentId,
  restoredBy,
  buffer,
}: RestoreBackupOptions) {
  const currentDepartment = await prismadb.department.findUnique({
    where: { id: departmentId },
    select: { userId: true },
  });

  if (!currentDepartment) {
    throw new Error("Department not found.");
  }

  const parsed = await validateDepartmentBackupBuffer(buffer, departmentId);
  const safetyBackup = await createDepartmentBackup({
    departmentId,
    createdBy: restoredBy,
    reason: "pre-restore",
  });

  await restoreParsedBackup(parsed, departmentId, currentDepartment.userId);

  return {
    restored: {
      manifest: parsed.manifest,
      counts: parsed.manifest.counts as BackupCounts,
    },
    safetyBackup: safetyBackup.backup,
  };
}
