export type OfficeWorkforceOffice = {
  id: string;
  name: string;
};

export type OfficeWorkforcePlantillaPosition = {
  id: string;
  officeId: string;
  isActive: boolean;
};

export type OfficeWorkforceEmployee = {
  id: string;
  officeId: string;
  plantillaPositionId: string | null;
  isArchived: boolean;
};

export type OfficeWorkforceMetrics = {
  totalPlantillaSlots: number;
  activePlantillaSlots: number;
  filledPlantillaSlots: number;
  vacantPlantillaSlots: number;
  vacancyRate: number;
  assignedHereButPlantillaElsewhere: number;
  plantillaHereButAssignedElsewhere: number;
};

export type OfficeWorkforceRow = OfficeWorkforceMetrics & {
  officeId: string;
  officeName: string;
};

export type OfficeWorkforceSummary = {
  totals: OfficeWorkforceMetrics;
  offices: OfficeWorkforceRow[];
};

export type AggregateOfficeWorkforceInput = {
  offices: readonly OfficeWorkforceOffice[];
  plantillaPositions: readonly OfficeWorkforcePlantillaPosition[];
  employees: readonly OfficeWorkforceEmployee[];
};

export const WORKFORCE_DETAILS_VIEWS = [
  "vacant",
  "assigned-here-plantilla-elsewhere",
  "plantilla-here-assigned-elsewhere",
] as const;

export type WorkforceDetailsView = (typeof WORKFORCE_DETAILS_VIEWS)[number];

export function parseWorkforceDetailsView(
  value: string | null
): WorkforceDetailsView | null {
  return WORKFORCE_DETAILS_VIEWS.includes(value as WorkforceDetailsView)
    ? (value as WorkforceDetailsView)
    : null;
}

export function classifyWorkforceDetailsView(
  view: WorkforceDetailsView
): "plantilla" | "employee-assignment" | "employee-plantilla" {
  if (view === "vacant") return "plantilla";
  return view === "assigned-here-plantilla-elsewhere"
    ? "employee-assignment"
    : "employee-plantilla";
}

type NamedEntity = { id: string; name: string };

export function mapWorkforceOffice(
  office: NamedEntity & Record<string, unknown>
): NamedEntity {
  return { id: office.id, name: office.name };
}

export function buildWorkforceDetailsRelationScopes(
  view: "vacant",
  departmentId: string,
  officeId: string
): { archivedOccupant: { departmentId: string; isArchived: true } };
export function buildWorkforceDetailsRelationScopes(
  view: Exclude<WorkforceDetailsView, "vacant">,
  departmentId: string,
  officeId: string
): {
  plantillaPosition: {
    departmentId: string;
    isActive: true;
    officeId: string | { not: string };
  };
};
export function buildWorkforceDetailsRelationScopes(
  view: WorkforceDetailsView,
  departmentId: string,
  officeId: string
) {
  if (view === "vacant") {
    return {
      archivedOccupant: {
        departmentId,
        isArchived: true,
      },
    };
  }

  return {
    plantillaPosition: {
      departmentId,
      isActive: true,
      officeId:
        view === "assigned-here-plantilla-elsewhere"
          ? { not: officeId }
          : officeId,
    },
  };
}

export type VacantWorkforceDetailInput = {
  id: string;
  title: string;
  itemNumber: string | null;
  salaryGrade: number | null;
  officeDivision: NamedEntity | null;
  employeeType: NamedEntity | null;
};

export function mapVacantWorkforceDetail(
  position: VacantWorkforceDetailInput
) {
  return {
    kind: "vacant" as const,
    plantillaPositionId: position.id,
    title: position.title,
    itemNumber: position.itemNumber,
    salaryGrade: position.salaryGrade,
    division: position.officeDivision,
    employeeType: position.employeeType,
  };
}

export type EmployeeWorkforceDetailInput = {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  suffix?: string | null;
  position: string;
  offices: NamedEntity;
  plantillaPosition: { office: NamedEntity } | null;
};

function formatEmployeeName(employee: EmployeeWorkforceDetailInput) {
  const middleInitial = employee.middleName?.trim()
    ? ` ${employee.middleName.trim().charAt(0).toUpperCase()}.`
    : "";
  const suffix = employee.suffix?.trim() ? ` ${employee.suffix.trim()}` : "";
  return `${employee.lastName}, ${employee.firstName}${middleInitial}${suffix}`;
}

export function mapEmployeeWorkforceDetail(
  employee: EmployeeWorkforceDetailInput
) {
  return {
    kind: "employee" as const,
    employeeId: employee.id,
    name: formatEmployeeName(employee),
    position: employee.position,
    assignedOffice: employee.offices,
    plantillaOffice: employee.plantillaPosition?.office ?? null,
  };
}

function emptyMetrics(): OfficeWorkforceMetrics {
  return {
    totalPlantillaSlots: 0,
    activePlantillaSlots: 0,
    filledPlantillaSlots: 0,
    vacantPlantillaSlots: 0,
    vacancyRate: 0,
    assignedHereButPlantillaElsewhere: 0,
    plantillaHereButAssignedElsewhere: 0,
  };
}

function finishMetrics(metrics: OfficeWorkforceMetrics): OfficeWorkforceMetrics {
  metrics.vacantPlantillaSlots =
    metrics.activePlantillaSlots - metrics.filledPlantillaSlots;
  metrics.vacancyRate =
    metrics.activePlantillaSlots === 0
      ? 0
      : (metrics.vacantPlantillaSlots * 100) / metrics.activePlantillaSlots;
  return metrics;
}

/**
 * Aggregates current office assignment and plantilla ownership.
 * Vacancy rates are percentages in the inclusive range 0–100.
 */
export function aggregateOfficeWorkforce(
  input: AggregateOfficeWorkforceInput
): OfficeWorkforceSummary {
  const totals = emptyMetrics();
  const metricsByOfficeId = new Map(
    input.offices.map((office) => [office.id, emptyMetrics()])
  );
  const plantillaById = new Map(
    input.plantillaPositions.map((position) => [position.id, position])
  );
  const occupiedActivePositionIds = new Set<string>();

  for (const position of input.plantillaPositions) {
    totals.totalPlantillaSlots += 1;
    const officeMetrics = metricsByOfficeId.get(position.officeId);
    if (officeMetrics) officeMetrics.totalPlantillaSlots += 1;

    if (position.isActive) {
      totals.activePlantillaSlots += 1;
      if (officeMetrics) officeMetrics.activePlantillaSlots += 1;
    }
  }

  for (const employee of input.employees) {
    if (employee.isArchived || !employee.plantillaPositionId) continue;

    const position = plantillaById.get(employee.plantillaPositionId);
    if (!position?.isActive) continue;

    occupiedActivePositionIds.add(position.id);
    if (employee.officeId !== position.officeId) {
      totals.assignedHereButPlantillaElsewhere += 1;
      totals.plantillaHereButAssignedElsewhere += 1;

      const assignmentOfficeMetrics = metricsByOfficeId.get(employee.officeId);
      if (assignmentOfficeMetrics) {
        assignmentOfficeMetrics.assignedHereButPlantillaElsewhere += 1;
      }

      const plantillaOfficeMetrics = metricsByOfficeId.get(position.officeId);
      if (plantillaOfficeMetrics) {
        plantillaOfficeMetrics.plantillaHereButAssignedElsewhere += 1;
      }
    }
  }

  for (const positionId of occupiedActivePositionIds) {
    totals.filledPlantillaSlots += 1;
    const position = plantillaById.get(positionId);
    const officeMetrics = position
      ? metricsByOfficeId.get(position.officeId)
      : undefined;
    if (officeMetrics) officeMetrics.filledPlantillaSlots += 1;
  }

  const offices = input.offices
    .map((office, index) => ({
      index,
      sortName: office.name.trim().toLocaleLowerCase("en"),
      row: {
        officeId: office.id,
        officeName: office.name,
        ...finishMetrics(metricsByOfficeId.get(office.id) ?? emptyMetrics()),
      },
    }))
    .sort(
      (left, right) =>
        left.sortName.localeCompare(right.sortName, "en") ||
        left.index - right.index
    )
    .map(({ row }) => row);

  return {
    totals: finishMetrics(totals),
    offices,
  };
}
