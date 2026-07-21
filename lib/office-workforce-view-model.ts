import type {
  OfficeWorkforceMetrics,
  OfficeWorkforceRow,
  WorkforceDetailsView,
} from "./office-workforce";

export type OfficeWorkforceChartRow = {
  officeId: string;
  officeName: string;
  filled: number;
  vacant: number;
};

const EMPTY_METRICS: OfficeWorkforceMetrics = {
  totalPlantillaSlots: 0,
  activePlantillaSlots: 0,
  filledPlantillaSlots: 0,
  vacantPlantillaSlots: 0,
  vacancyRate: 0,
  assignedHereButPlantillaElsewhere: 0,
  plantillaHereButAssignedElsewhere: 0,
};

export function getCombinedCrossOfficeCount(
  metrics: Pick<
    OfficeWorkforceMetrics,
    | "assignedHereButPlantillaElsewhere"
    | "plantillaHereButAssignedElsewhere"
  >
) {
  return (
    metrics.assignedHereButPlantillaElsewhere +
    metrics.plantillaHereButAssignedElsewhere
  );
}

export function filterOfficeWorkforceComparisonRows(
  rows: readonly OfficeWorkforceRow[]
) {
  return rows.filter((row) => row.activePlantillaSlots > 0);
}

export function buildOfficeWorkforceChartRows(
  rows: readonly OfficeWorkforceRow[]
): OfficeWorkforceChartRow[] {
  return filterOfficeWorkforceComparisonRows(rows)
    .map((row) => ({
      officeId: row.officeId,
      officeName: row.officeName.trim(),
      filled: row.filledPlantillaSlots,
      vacant: row.vacantPlantillaSlots,
    }))
    .sort(
      (left, right) =>
        left.officeName.localeCompare(right.officeName, "en", {
          sensitivity: "base",
        }) || left.officeId.localeCompare(right.officeId, "en")
    );
}

export function shouldRenderChartSegmentLabel(width: number, value: number) {
  if (!Number.isFinite(width) || !Number.isFinite(value) || value <= 0) {
    return false;
  }
  const minimumWidth = Math.max(24, String(value).length * 8 + 12);
  return width >= minimumWidth;
}

export function enrichOfficeRowsWithWorkforce<
  T extends { id: string; name: string; plantillaCount?: number },
>(rows: readonly T[], workforceRows: readonly OfficeWorkforceRow[]) {
  const workforceByOffice = new Map(
    workforceRows.map((row) => [row.officeId, row])
  );

  return rows.map((row) => {
    const liveWorkforce = workforceByOffice.get(row.id);
    const workforce = liveWorkforce ?? EMPTY_METRICS;
    return {
      ...row,
      ...workforce,
      plantillaCount:
        liveWorkforce?.totalPlantillaSlots ?? row.plantillaCount ?? 0,
      crossOfficeCount: getCombinedCrossOfficeCount(workforce),
    };
  });
}

const WORKFORCE_VIEW_LABELS: Record<WorkforceDetailsView, string> = {
  vacant: "Vacant plantilla",
  "assigned-here-plantilla-elsewhere":
    "Assigned here, plantilla elsewhere",
  "plantilla-here-assigned-elsewhere":
    "Plantilla here, assigned elsewhere",
};

export function getWorkforceViewLabel(view: WorkforceDetailsView) {
  return WORKFORCE_VIEW_LABELS[view];
}
