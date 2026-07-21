import type { Prisma } from "@prisma/client";

import {
  normalizeOptionalId,
  validateDivisionBelongsToOffice,
  validatePlantillaAssignment,
} from "@/lib/plantilla";

type Tx = Prisma.TransactionClient;

export type PlantillaAssignmentInput = {
  departmentId: string;
  officeId: string;
  officeDivisionId?: unknown;
  plantillaPositionId?: unknown;
  employeeId?: string | null;
};

export type PlantillaAssignmentResult =
  | {
      ok: true;
      officeDivisionId: string | null;
      plantillaPositionId: string | null;
      plantillaTitle: string | null;
    }
  | { ok: false; error: string };

export type ArchivePlantillaUnlinkUpdate =
  | { plantillaPositionId: null }
  | { plantillaPositionId?: never };

/**
 * Returns the minimal employee update needed when changing archive state.
 * Copied plantilla fields remain historical values on the employee record.
 */
export function buildArchivePlantillaUnlinkUpdate(
  archived: boolean
): ArchivePlantillaUnlinkUpdate {
  return archived ? { plantillaPositionId: null } : {};
}

export function buildBulkArchiveEmployeeUpdate(input: {
  archived: boolean;
  terminateDate: string;
  note?: string;
}) {
  return {
    isArchived: input.archived,
    terminateDate: input.terminateDate,
    ...(input.note ? { note: input.note } : {}),
    ...buildArchivePlantillaUnlinkUpdate(input.archived),
  };
}

/**
 * Validates optional structured division + plantilla assignment for employee create/update.
 *
 * - officeDivisionId = optional division under the assignment office
 * - plantillaPositionId may belong to a different office in the same department
 * - plantilla division is NOT copied onto the employee when offices differ
 */
export async function resolvePlantillaAssignment(
  tx: Tx,
  input: PlantillaAssignmentInput
): Promise<PlantillaAssignmentResult> {
  let officeDivisionId = normalizeOptionalId(input.officeDivisionId);
  const plantillaPositionId = normalizeOptionalId(input.plantillaPositionId);

  if (officeDivisionId) {
    const division = await tx.officeDivision.findFirst({
      where: {
        id: officeDivisionId,
        departmentId: input.departmentId,
      },
      select: { id: true, officeId: true },
    });
    const divisionError = validateDivisionBelongsToOffice({
      division,
      officeId: input.officeId,
    });
    if (divisionError) return { ok: false, error: divisionError };
  }

  if (!plantillaPositionId) {
    return {
      ok: true,
      officeDivisionId,
      plantillaPositionId: null,
      plantillaTitle: null,
    };
  }

  const plantilla = await tx.plantillaPosition.findFirst({
    where: {
      id: plantillaPositionId,
      departmentId: input.departmentId,
    },
    select: {
      id: true,
      officeId: true,
      officeDivisionId: true,
      title: true,
      isActive: true,
      employee: { select: { id: true } },
    },
  });

  // Inherit plantilla division only when it lives under the same assignment office.
  if (
    plantilla?.officeDivisionId &&
    !officeDivisionId &&
    plantilla.officeId === input.officeId
  ) {
    officeDivisionId = plantilla.officeDivisionId;
  }

  // If employee currently has a division from another office (stale), clear it
  // when the assignment office does not own that division.
  if (officeDivisionId && plantilla && plantilla.officeId !== input.officeId) {
    const division = await tx.officeDivision.findFirst({
      where: { id: officeDivisionId },
      select: { officeId: true },
    });
    if (division && division.officeId !== input.officeId) {
      officeDivisionId = null;
    }
  }

  const assignError = validatePlantillaAssignment({
    plantilla: plantilla
      ? {
          id: plantilla.id,
          officeId: plantilla.officeId,
          officeDivisionId: plantilla.officeDivisionId,
          title: plantilla.title,
          isActive: plantilla.isActive,
          employee: plantilla.employee,
        }
      : null,
    employeeOfficeId: input.officeId,
    employeeDivisionId: officeDivisionId,
    employeeId: input.employeeId,
  });

  if (assignError) return { ok: false, error: assignError };

  return {
    ok: true,
    officeDivisionId,
    plantillaPositionId,
    plantillaTitle: plantilla?.title ?? null,
  };
}
