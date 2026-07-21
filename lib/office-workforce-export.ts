import type { OfficeWorkforceRow } from "./office-workforce";
import type { AuthorizedPositionSummaryRow } from "./office-workforce-position-summary";

export const AUTHORIZED_POSITION_EXPORT_HEADERS = [
  "Office",
  "Authorized Position",
  "Employment Status",
  "Total Authorized",
  "Filled",
  "Vacant",
] as const;

export const VACANT_POSITION_EXPORT_HEADERS = [
  "Office",
  "Item Number",
  "Position",
  "Salary Grade",
  "Division",
  "Employee Type",
] as const;

export type VacantPositionExportItem = {
  officeName: string;
  itemNumber: string | null;
  title: string;
  salaryGrade: number | null;
  divisionName: string | null;
  employeeTypeName: string | null;
};

export const OFFICE_WORKFORCE_EXPORT_HEADERS = [
  "Office",
  "Active Plantilla",
  "Filled",
  "Vacant",
  "Assigned Here / Plantilla Elsewhere",
  "Plantilla Here / Assigned Elsewhere",
  "Vacancy Rate",
] as const;

export function buildOfficeWorkforceExportRows(
  rows: readonly OfficeWorkforceRow[]
): Array<Array<string | number>> {
  return rows.map((row) => [
    row.officeName,
    row.activePlantillaSlots,
    row.filledPlantillaSlots,
    row.vacantPlantillaSlots,
    row.assignedHereButPlantillaElsewhere,
    row.plantillaHereButAssignedElsewhere,
    row.vacancyRate / 100,
  ]);
}

export function buildOfficeWorkforceTotalRow(
  rows: readonly OfficeWorkforceRow[]
): Array<string | number> {
  const totals = rows.reduce(
    (sum, row) => ({
      active: sum.active + row.activePlantillaSlots,
      filled: sum.filled + row.filledPlantillaSlots,
      vacant: sum.vacant + row.vacantPlantillaSlots,
      assignedHere:
        sum.assignedHere + row.assignedHereButPlantillaElsewhere,
      plantillaHere:
        sum.plantillaHere + row.plantillaHereButAssignedElsewhere,
    }),
    {
      active: 0,
      filled: 0,
      vacant: 0,
      assignedHere: 0,
      plantillaHere: 0,
    }
  );

  return [
    "TOTAL",
    totals.active,
    totals.filled,
    totals.vacant,
    totals.assignedHere,
    totals.plantillaHere,
    totals.active === 0 ? 0 : totals.vacant / totals.active,
  ];
}

export function buildVacantPositionExportRows(
  rows: readonly VacantPositionExportItem[]
): Array<Array<string | number>> {
  return rows.map((row) => [
    row.officeName,
    row.itemNumber ?? "",
    row.title,
    row.salaryGrade ?? "",
    row.divisionName ?? "",
    row.employeeTypeName ?? "",
  ]);
}

export function buildAuthorizedPositionExportRows(
  rows: readonly AuthorizedPositionSummaryRow[]
): Array<Array<string | number>> {
  return rows.map((row) => [
    row.officeName,
    row.positionTitle,
    row.employeeTypeName,
    row.totalAuthorized,
    row.filled,
    row.vacant,
  ]);
}

export function officeWorkforceExportFilename(date = new Date()) {
  return `Office_Workforce_${date.toISOString().slice(0, 10)}.xlsx`;
}
