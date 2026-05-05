import type { Gender, MaritalStatus, PrismaClient } from "@prisma/client";

import prismadb from "@/lib/prismadb";

export const WORKFORCE_ACTIVE_STATUS = "ACTIVE";
export const WORKFORCE_INACTIVE_STATUS = "INACTIVE";

export const WORKFORCE_DIMENSIONS = [
  "employeeType",
  "gender",
  "maritalStatus",
  "eligibility",
  "office",
  "position",
  "status",
  "headStatus",
] as const;

export type WorkforceDimension = (typeof WORKFORCE_DIMENSIONS)[number];
export type WorkforcePopulationMode = "active" | "all";

export type WorkforceSnapshotEmployee = {
  id: string;
  departmentId: string;
  officeId: string;
  employeeTypeId: string;
  eligibilityId: string;
  position: string;
  gender: Gender;
  maritalStatus: MaritalStatus | null;
  isHead: boolean;
  isArchived: boolean;
  dateHired: Date;
  terminateDate: string;
  updatedAt?: Date;
};

type PrismaLike = PrismaClient | Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export function endOfReportYear(year: number) {
  return new Date(year, 11, 31, 23, 59, 59, 999);
}

export function parseEmployeeTerminationDate(value?: string | null): Date | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;

  const slashParts = trimmed.split("/");
  if (slashParts.length === 3) {
    const [month, day, year] = slashParts.map(Number);
    if (month && day && year) {
      const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toSnapshotStatus(isArchived: boolean) {
  return isArchived ? WORKFORCE_INACTIVE_STATUS : WORKFORCE_ACTIVE_STATUS;
}

export function snapshotFieldsChanged(
  before: Pick<
    WorkforceSnapshotEmployee,
    | "officeId"
    | "employeeTypeId"
    | "eligibilityId"
    | "position"
    | "gender"
    | "maritalStatus"
    | "isHead"
    | "isArchived"
    | "terminateDate"
  >,
  after: Pick<
    WorkforceSnapshotEmployee,
    | "officeId"
    | "employeeTypeId"
    | "eligibilityId"
    | "position"
    | "gender"
    | "maritalStatus"
    | "isHead"
    | "isArchived"
    | "terminateDate"
  >
) {
  return (
    before.officeId !== after.officeId ||
    before.employeeTypeId !== after.employeeTypeId ||
    before.eligibilityId !== after.eligibilityId ||
    before.position !== after.position ||
    before.gender !== after.gender ||
    before.maritalStatus !== after.maritalStatus ||
    before.isHead !== after.isHead ||
    before.isArchived !== after.isArchived ||
    before.terminateDate !== after.terminateDate
  );
}

export async function createEmployeeHistorySnapshot(
  db: PrismaLike,
  employee: WorkforceSnapshotEmployee,
  options: {
    effectiveAt?: Date;
    status?: string;
    source: string;
    note?: string;
  }
) {
  const status = options.status ?? toSnapshotStatus(employee.isArchived);
  const effectiveAt =
    options.effectiveAt ??
    (status === WORKFORCE_INACTIVE_STATUS
      ? parseEmployeeTerminationDate(employee.terminateDate) ?? employee.updatedAt ?? new Date()
      : employee.dateHired ?? new Date());

  return db.employeeHistorySnapshot.create({
    data: {
      departmentId: employee.departmentId,
      employeeId: employee.id,
      effectiveAt,
      officeId: employee.officeId || null,
      employeeTypeId: employee.employeeTypeId || null,
      eligibilityId: employee.eligibilityId || null,
      position: employee.position ?? "",
      gender: employee.gender,
      maritalStatus: employee.maritalStatus ?? null,
      isHead: Boolean(employee.isHead),
      status,
      source: options.source,
      note: options.note ?? null,
    },
  });
}

export async function backfillWorkforceHistorySnapshots(departmentId: string) {
  const employees = await prismadb.employee.findMany({
    where: { departmentId },
    select: {
      id: true,
      departmentId: true,
      officeId: true,
      employeeTypeId: true,
      eligibilityId: true,
      position: true,
      gender: true,
      maritalStatus: true,
      isHead: true,
      isArchived: true,
      dateHired: true,
      terminateDate: true,
      updatedAt: true,
      historySnapshots: {
        where: { source: "BACKFILL" },
        select: {
          status: true,
        },
      },
    },
  });

  const snapshots = employees.flatMap((employee) => {
    const baseSnapshot = {
      departmentId: employee.departmentId,
      employeeId: employee.id,
      effectiveAt: employee.dateHired,
      officeId: employee.officeId || null,
      employeeTypeId: employee.employeeTypeId || null,
      eligibilityId: employee.eligibilityId || null,
      position: employee.position ?? "",
      gender: employee.gender,
      maritalStatus: employee.maritalStatus ?? null,
      isHead: Boolean(employee.isHead),
      status: WORKFORCE_ACTIVE_STATUS,
      source: "BACKFILL",
      note: "Baseline snapshot generated from current employee record and date hired.",
    };

    const existingBackfillStatuses = new Set(employee.historySnapshots.map((snapshot) => snapshot.status));
    const missingSnapshots = existingBackfillStatuses.has(WORKFORCE_ACTIVE_STATUS) ? [] : [baseSnapshot];
    const termination = parseEmployeeTerminationDate(employee.terminateDate);

    if (!employee.isArchived && !termination) {
      return missingSnapshots;
    }

    if (!existingBackfillStatuses.has(WORKFORCE_INACTIVE_STATUS)) {
      missingSnapshots.push({
        ...baseSnapshot,
        effectiveAt: termination ?? employee.updatedAt,
        status: WORKFORCE_INACTIVE_STATUS,
        note: "Inactive snapshot generated from termination/archive data.",
      });
    }

    return missingSnapshots;
  });

  let created = 0;
  const batchSize = 500;

  for (let index = 0; index < snapshots.length; index += batchSize) {
    const batch = snapshots.slice(index, index + batchSize);
    if (batch.length === 0) continue;

    const result = await prismadb.employeeHistorySnapshot.createMany({
      data: batch,
    });
    created += result.count;
  }

  return {
    employeesChecked: employees.length,
    snapshotsCreated: created,
  };
}
