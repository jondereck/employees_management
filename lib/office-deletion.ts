export type OfficeDeleteBlockers = {
  assignedEmployees: number;
  designatedEmployees: number;
  plantillaOccupants: number;
  divisionEmployees?: number;
};

export function hasOfficeDeleteBlockers(blockers: OfficeDeleteBlockers) {
  return (
    blockers.assignedEmployees > 0 ||
    blockers.designatedEmployees > 0 ||
    blockers.plantillaOccupants > 0 ||
    (blockers.divisionEmployees ?? 0) > 0
  );
}

export type OfficeDeletionReason =
  | "assigned"
  | "designated"
  | "plantilla"
  | "division";

export type OfficeDeletionEmployeeRelations = {
  id: string;
  officeId: string;
  designationId: string | null;
  officeDivision: { officeId: string } | null;
  plantillaPosition: { officeId: string } | null;
};

export type OfficeReassignment = {
  employeeId: string;
  officeId: string;
  officeDivisionId?: string | null;
};

const stalePreviewError = {
  ok: false as const,
  code: "STALE_OFFICE_DELETION_PREVIEW" as const,
  error:
    "Employee assignments changed since this preview. Review the refreshed list and try again.",
};

const invalidDestinationDivisionError = {
  ok: false as const,
  code: "INVALID_DESTINATION_DIVISION" as const,
  error:
    "Destination divisions must belong to the selected office in this department.",
};

export function classifyOfficeDeletionEmployees(
  employees: OfficeDeletionEmployeeRelations[],
  deletingOfficeId: string
) {
  const reasonsByEmployee = new Map<string, Set<OfficeDeletionReason>>();

  for (const employee of employees) {
    const reasons = reasonsByEmployee.get(employee.id) ?? new Set();
    if (employee.officeId === deletingOfficeId) reasons.add("assigned");
    if (employee.designationId === deletingOfficeId) reasons.add("designated");
    if (employee.officeDivision?.officeId === deletingOfficeId) {
      reasons.add("division");
    }
    if (employee.plantillaPosition?.officeId === deletingOfficeId) {
      reasons.add("plantilla");
    }
    if (reasons.size > 0) reasonsByEmployee.set(employee.id, reasons);
  }

  const reasonOrder: OfficeDeletionReason[] = [
    "assigned",
    "designated",
    "plantilla",
    "division",
  ];

  return [...reasonsByEmployee.entries()].map(([employeeId, reasons]) => ({
    employeeId,
    reasons: reasonOrder.filter((reason) => reasons.has(reason)),
  }));
}

export function hasStaleOfficeDeletionPreview(
  previewEmployeeIds: string[],
  currentEmployeeIds: string[]
) {
  const preview = new Set(previewEmployeeIds);
  const current = new Set(currentEmployeeIds);
  return (
    preview.size !== current.size ||
    [...preview].some((employeeId) => !current.has(employeeId))
  );
}

export function validateOfficeReassignments({
  affectedEmployeeIds,
  assignedEmployeeIds = affectedEmployeeIds,
  reassignments,
  validDestinationOfficeIds,
  validDestinationDivisions = [],
  deletingOfficeId,
}: {
  affectedEmployeeIds: string[];
  assignedEmployeeIds?: string[];
  reassignments: OfficeReassignment[];
  validDestinationOfficeIds: string[];
  validDestinationDivisions?: Array<{ id: string; officeId: string }>;
  deletingOfficeId: string;
}) {
  const reassignedEmployeeIds = reassignments.map(
    (reassignment) => reassignment.employeeId
  );
  if (
    new Set(reassignedEmployeeIds).size !== reassignedEmployeeIds.length ||
    hasStaleOfficeDeletionPreview(reassignedEmployeeIds, affectedEmployeeIds)
  ) {
    return stalePreviewError;
  }

  const validDestinations = new Set(validDestinationOfficeIds);
  if (
    reassignments.some(
      (reassignment) =>
        !validDestinations.has(reassignment.officeId) ||
        reassignment.officeId === deletingOfficeId
    )
  ) {
    return {
      ok: false as const,
      code: "INVALID_DESTINATION_OFFICE" as const,
      error: "Every destination must be another office in the same department.",
    };
  }

  const assignedEmployees = new Set(assignedEmployeeIds);
  const divisionOfficeById = new Map(
    validDestinationDivisions.map((division) => [division.id, division.officeId])
  );
  if (
    reassignments.some(
      (reassignment) =>
        reassignment.officeDivisionId != null &&
        (!assignedEmployees.has(reassignment.employeeId) ||
          divisionOfficeById.get(reassignment.officeDivisionId) !==
            reassignment.officeId)
    )
  ) {
    return invalidDestinationDivisionError;
  }

  return { ok: true as const };
}

export function buildOfficeDeletionEmployeePatch(
  employee: Omit<OfficeDeletionEmployeeRelations, "id">,
  deletingOfficeId: string,
  destinationOfficeId: string,
  destinationOfficeDivisionId?: string | null
) {
  const patch: {
    officeId?: string;
    designationId?: string;
    officeDivisionId?: string | null;
    plantillaPositionId?: null;
  } = {};

  if (employee.officeId === deletingOfficeId) {
    patch.officeId = destinationOfficeId;
    patch.officeDivisionId = destinationOfficeDivisionId ?? null;
  }
  if (employee.designationId === deletingOfficeId) {
    patch.designationId = destinationOfficeId;
  }
  if (
    employee.officeId !== deletingOfficeId &&
    employee.officeDivision?.officeId === deletingOfficeId
  ) {
    patch.officeDivisionId = null;
  }
  if (employee.plantillaPosition?.officeId === deletingOfficeId) {
    patch.plantillaPositionId = null;
  }

  return patch;
}

function employeeCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function joinBlockers(parts: string[]) {
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

export function formatOfficeDeleteBlockedMessage(
  blockers: OfficeDeleteBlockers
) {
  const parts = [
    blockers.assignedEmployees > 0
      ? employeeCount(
          blockers.assignedEmployees,
          "assigned employee",
          "assigned employees"
        )
      : null,
    blockers.designatedEmployees > 0
      ? employeeCount(
          blockers.designatedEmployees,
          "designated employee",
          "designated employees"
        )
      : null,
    blockers.plantillaOccupants > 0
      ? employeeCount(
          blockers.plantillaOccupants,
          "plantilla occupant",
          "plantilla occupants"
        )
      : null,
    (blockers.divisionEmployees ?? 0) > 0
      ? employeeCount(
          blockers.divisionEmployees ?? 0,
          "division-linked employee",
          "division-linked employees"
        )
      : null,
  ].filter((part): part is string => part !== null);

  if (parts.length === 0) return null;
  return `Cannot delete this office. Reassign ${joinBlockers(parts)} first.`;
}
