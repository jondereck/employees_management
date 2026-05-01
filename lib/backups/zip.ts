import JSZip from "jszip";

import {
  BACKUP_FORMAT_VERSION,
  BACKUP_MODEL_NAMES,
  BACKUP_SCOPE,
  type BackupModelMap,
  type BackupModelName,
  type DepartmentBackupManifest,
  type ParsedDepartmentBackup,
  createEmptyModelMap,
} from "./config";

const DEFAULT_MAX_BACKUP_BYTES = 100 * 1024 * 1024;

export class BackupValidationError extends Error {
  details: string[];

  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = "BackupValidationError";
    this.details = details;
  }
}

function maxBackupBytes() {
  const raw = Number(process.env.BACKUP_MAX_BYTES);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_BACKUP_BYTES;
}

function parseJson<T>(raw: string, label: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new BackupValidationError(`${label} is not valid JSON.`);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeManifest(value: unknown): DepartmentBackupManifest {
  if (!isObject(value)) {
    throw new BackupValidationError("manifest.json must contain an object.");
  }

  const errors: string[] = [];
  if (value.formatVersion !== BACKUP_FORMAT_VERSION) {
    errors.push(`Unsupported formatVersion: ${String(value.formatVersion)}`);
  }
  if (value.scope !== BACKUP_SCOPE) {
    errors.push(`Unsupported scope: ${String(value.scope)}`);
  }
  if (typeof value.departmentId !== "string" || !value.departmentId) {
    errors.push("manifest.departmentId is required.");
  }
  if (typeof value.createdAt !== "string" || !value.createdAt) {
    errors.push("manifest.createdAt is required.");
  }
  if (typeof value.createdBy !== "string" || !value.createdBy) {
    errors.push("manifest.createdBy is required.");
  }
  if (!isObject(value.counts)) {
    errors.push("manifest.counts is required.");
  }

  if (errors.length) {
    throw new BackupValidationError("Invalid backup manifest.", errors);
  }

  const counts = value.counts as Record<string, unknown>;
  const normalizedCounts = Object.fromEntries(
    BACKUP_MODEL_NAMES.map((modelName) => {
      const count = Number(counts[modelName]);
      return [modelName, Number.isInteger(count) && count >= 0 ? count : 0];
    })
  ) as DepartmentBackupManifest["counts"];

  const app = isObject(value.app) ? value.app : {};

  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    scope: BACKUP_SCOPE,
    departmentId: String(value.departmentId),
    departmentName:
      typeof value.departmentName === "string" ? value.departmentName : "",
    createdAt: String(value.createdAt),
    createdBy: String(value.createdBy),
    reason: value.reason === "pre-restore" ? "pre-restore" : "manual",
    counts: normalizedCounts,
    app: {
      name: typeof app.name === "string" ? app.name : "employee_management",
      version: typeof app.version === "string" ? app.version : "0.0.0",
      schemaHash: typeof app.schemaHash === "string" ? app.schemaHash : null,
    },
  };
}

function assertArrayPayload(value: unknown, modelName: BackupModelName) {
  if (!Array.isArray(value)) {
    throw new BackupValidationError(`models/${modelName}.json must contain an array.`);
  }

  return value as Record<string, unknown>[];
}

function idsFrom(rows: Record<string, unknown>[], field = "id") {
  return new Set(
    rows
      .map((row) => row[field])
      .filter((value): value is string => typeof value === "string" && value.length > 0)
  );
}

function requireDepartmentId(
  modelName: BackupModelName,
  rows: Record<string, unknown>[],
  expectedDepartmentId: string,
  errors: string[]
) {
  for (const row of rows) {
    if (row.departmentId !== expectedDepartmentId) {
      errors.push(`${modelName} contains a row for another department.`);
      return;
    }
  }
}

function requireEmployeeReference(
  modelName: BackupModelName,
  rows: Record<string, unknown>[],
  employeeIds: Set<string>,
  errors: string[]
) {
  for (const row of rows) {
    const employeeId = row.employeeId;
    if (typeof employeeId !== "string" || !employeeIds.has(employeeId)) {
      errors.push(`${modelName} contains a row for an employee outside the backup.`);
      return;
    }
  }
}

function validateConsistency(
  manifest: DepartmentBackupManifest,
  models: BackupModelMap,
  expectedDepartmentId?: string
) {
  const errors: string[] = [];
  const departmentId = expectedDepartmentId ?? manifest.departmentId;

  if (manifest.departmentId !== departmentId) {
    errors.push("Backup department does not match the current department.");
  }

  const departments = models.Department;
  if (departments.length !== 1) {
    errors.push("Backup must contain exactly one Department row.");
  } else if (departments[0].id !== departmentId) {
    errors.push("Department row id does not match the manifest departmentId.");
  }

  for (const modelName of BACKUP_MODEL_NAMES) {
    const expectedCount = manifest.counts[modelName];
    const actualCount = models[modelName].length;
    if (expectedCount !== actualCount) {
      errors.push(`${modelName} count mismatch: manifest=${expectedCount}, file=${actualCount}.`);
    }
  }

  for (const modelName of [
    "Billboard",
    "Offices",
    "EmployeeType",
    "Eligibility",
    "Employee",
    "OrgChartVersion",
    "ChangeRequest",
  ] as BackupModelName[]) {
    requireDepartmentId(modelName, models[modelName], departmentId, errors);
  }

  const billboardIds = idsFrom(models.Billboard);
  const officeIds = idsFrom(models.Offices);
  const employeeTypeIds = idsFrom(models.EmployeeType);
  const eligibilityIds = idsFrom(models.Eligibility);
  const employeeIds = idsFrom(models.Employee);

  for (const office of models.Offices) {
    if (typeof office.billboardId !== "string" || !billboardIds.has(office.billboardId)) {
      errors.push("Offices contains a billboardId outside the backup.");
      break;
    }
  }

  for (const employee of models.Employee) {
    if (typeof employee.officeId !== "string" || !officeIds.has(employee.officeId)) {
      errors.push("Employee contains an officeId outside the backup.");
      break;
    }
    if (
      typeof employee.employeeTypeId !== "string" ||
      !employeeTypeIds.has(employee.employeeTypeId)
    ) {
      errors.push("Employee contains an employeeTypeId outside the backup.");
      break;
    }
    if (
      typeof employee.eligibilityId !== "string" ||
      !eligibilityIds.has(employee.eligibilityId)
    ) {
      errors.push("Employee contains an eligibilityId outside the backup.");
      break;
    }
    if (
      employee.designationId != null &&
      (typeof employee.designationId !== "string" || !officeIds.has(employee.designationId))
    ) {
      errors.push("Employee contains a designationId outside the backup.");
      break;
    }
  }

  for (const modelName of [
    "Image",
    "EmploymentEvent",
    "Award",
    "BiometricsIdentityMap",
    "WorkSchedule",
    "ScheduleException",
    "WeeklyExclusion",
    "ChangeRequest",
  ] as BackupModelName[]) {
    requireEmployeeReference(modelName, models[modelName], employeeIds, errors);
  }

  if (errors.length) {
    throw new BackupValidationError("Backup validation failed.", errors);
  }
}

export async function buildBackupZip(
  manifest: DepartmentBackupManifest,
  models: BackupModelMap
): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  for (const modelName of BACKUP_MODEL_NAMES) {
    zip.file(`models/${modelName}.json`, JSON.stringify(models[modelName], null, 2));
  }

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export async function parseBackupZip(
  buffer: Buffer,
  options: { expectedDepartmentId?: string } = {}
): Promise<ParsedDepartmentBackup> {
  if (buffer.byteLength > maxBackupBytes()) {
    throw new BackupValidationError("Backup file is too large.");
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new BackupValidationError("Backup file is not a valid ZIP archive.");
  }

  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) {
    throw new BackupValidationError("Backup is missing manifest.json.");
  }

  const manifest = normalizeManifest(
    parseJson<unknown>(await manifestFile.async("string"), "manifest.json")
  );

  const models = createEmptyModelMap();
  for (const modelName of BACKUP_MODEL_NAMES) {
    const file = zip.file(`models/${modelName}.json`);
    if (!file) {
      throw new BackupValidationError(`Backup is missing models/${modelName}.json.`);
    }

    models[modelName] = assertArrayPayload(
      parseJson<unknown>(await file.async("string"), `models/${modelName}.json`),
      modelName
    );
  }

  validateConsistency(manifest, models, options.expectedDepartmentId);
  return { manifest, models };
}
