export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_SCOPE = "department";

export const BACKUP_MODEL_NAMES = [
  "Department",
  "Billboard",
  "Offices",
  "EmployeeType",
  "Eligibility",
  "Employee",
  "Image",
  "EmploymentEvent",
  "Award",
  "BiometricsIdentityMap",
  "WorkSchedule",
  "ScheduleException",
  "WeeklyExclusion",
  "OrgChartVersion",
  "ChangeRequest",
] as const;

export type BackupModelName = (typeof BACKUP_MODEL_NAMES)[number];
export type BackupCounts = Record<BackupModelName, number>;
export type BackupModelMap = Record<BackupModelName, Record<string, unknown>[]>;

export type BackupReason = "manual" | "pre-restore";

export type DepartmentBackupManifest = {
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  scope: typeof BACKUP_SCOPE;
  departmentId: string;
  departmentName: string;
  createdAt: string;
  createdBy: string;
  reason: BackupReason;
  counts: BackupCounts;
  app: {
    name: string;
    version: string;
    schemaHash: string | null;
  };
};

export type ParsedDepartmentBackup = {
  manifest: DepartmentBackupManifest;
  models: BackupModelMap;
};

export function createEmptyCounts(): BackupCounts {
  return Object.fromEntries(
    BACKUP_MODEL_NAMES.map((modelName) => [modelName, 0])
  ) as BackupCounts;
}

export function createEmptyModelMap(): BackupModelMap {
  return Object.fromEntries(
    BACKUP_MODEL_NAMES.map((modelName) => [modelName, []])
  ) as unknown as BackupModelMap;
}
