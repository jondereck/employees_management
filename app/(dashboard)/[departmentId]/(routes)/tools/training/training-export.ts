import * as XLSX from "xlsx-js-style";

import type { MfRow, RetirementRow } from "@/lib/hr-planning";
import type { TrainingRecord, TrainingSummaryResponse } from "@/lib/training-types";
import { trainingEmployeeDisplayName } from "@/lib/training-types";

const HEADER_STYLE = {
  font: { bold: true, color: { rgb: "1F2937" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } },
  border: {
    top: { style: "thin", color: { rgb: "D1D5DB" } },
    bottom: { style: "thin", color: { rgb: "D1D5DB" } },
    left: { style: "thin", color: { rgb: "D1D5DB" } },
    right: { style: "thin", color: { rgb: "D1D5DB" } },
  },
} as const;

/** Build a styled sheet from a header row + array-of-arrays body, matching lib/exportToExcel.ts conventions. */
function buildSheet(header: string[], rows: (string | number)[][], colWidths?: number[]) {
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);

  header.forEach((_, i) => {
    const addr = XLSX.utils.encode_cell({ r: 0, c: i });
    const cell: any = (ws as any)[addr];
    if (cell) cell.s = HEADER_STYLE;
  });

  if (colWidths) (ws as any)["!cols"] = colWidths.map((wch) => ({ wch }));
  (ws as any)["!rows"] = [{ hpt: 24 }];

  const ref = ws["!ref"] as string;
  if (ref) {
    const range = XLSX.utils.decode_range(ref);
    for (let R = 1; R <= range.e.r; R++) {
      const zebra = R % 2 === 1;
      for (let C = 0; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell: any = (ws as any)[addr];
        if (!cell) continue;
        cell.s = {
          alignment: { vertical: "center" },
          border: {
            top: { style: "hair", color: { rgb: "E5E7EB" } },
            bottom: { style: "hair", color: { rgb: "E5E7EB" } },
            left: { style: "hair", color: { rgb: "E5E7EB" } },
            right: { style: "hair", color: { rgb: "E5E7EB" } },
          },
          ...(zebra ? { fill: { patternType: "solid", fgColor: { rgb: "FAFAFA" } } } : {}),
        };
      }
    }
  }

  return ws;
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function exportTrainingRegistryExcel(
  trainings: TrainingRecord[],
  registrySummary: TrainingSummaryResponse["registry"],
  year: number,
  totalActiveEmployees?: number
) {
  const wb = XLSX.utils.book_new();

  const registryHeader = [
    "Employee",
    "Position",
    "Office",
    "Training Title",
    "Provider",
    "Date Conducted",
    "No. of Training Hours",
    "Training Type",
    "Competency Addressed",
    "Status",
  ];
  const registryRows = trainings.map((t) => [
    trainingEmployeeDisplayName(t),
    t.employee?.position || t.positionRaw,
    t.employee?.offices?.name || t.officeNameRaw,
    t.certificateTitle,
    t.provider,
    formatDate(t.dateStart),
    t.durationHours,
    t.trainingType,
    t.competencyAddressed,
    t.status,
  ]);
  XLSX.utils.book_append_sheet(
    wb,
    buildSheet(registryHeader, registryRows, [26, 20, 22, 34, 26, 14, 12, 14, 26, 14]),
    "Training Registry"
  );

  const summaryRows: (string | number)[][] = [
    ...(typeof totalActiveEmployees === "number" ? [["Eligible Employees", totalActiveEmployees] as (string | number)[]] : []),
    ["Total Trainings Conducted", registrySummary.totalTrainingsConducted],
    ["Total Employees Trained", registrySummary.totalEmployeesTrained],
    ["Total Training Hours Completed", registrySummary.totalTrainingHoursCompleted],
    ...Object.entries(registrySummary.byIndicator).map(([indicator, count]) => [`${indicator}s`, count]),
    ["Employees with at Least One Training", registrySummary.employeesWithAtLeastOneTraining],
    ["Employees with No Training Intervention", registrySummary.employeesWithNoTrainingIntervention],
  ];
  XLSX.utils.book_append_sheet(wb, buildSheet(["Indicator", "Total"], summaryRows, [40, 14]), "Summary Monitoring");

  XLSX.writeFile(wb, `Annex_6-G_Training_Registry_${year}.xlsx`, { compression: true });
}

export function exportLearningDashboardExcel(summary: TrainingSummaryResponse, year: number) {
  const wb = XLSX.utils.book_new();

  const sectionIRows = summary.sectionI.map((row) => [row.indicator, row.target, row.actual, `${row.percentAccomplishment}%`]);
  XLSX.utils.book_append_sheet(
    wb,
    buildSheet(["Indicator", "Target", "Actual", "% Accomplishment"], sectionIRows, [42, 12, 12, 16]),
    "I. Performance Summary"
  );

  const sectionIIRows = summary.implementationStatus.map((row) => [
    row.certificateTitle,
    row.trainingType,
    row.actualParticipants,
    `${formatDate(row.scheduleStart)} - ${formatDate(row.scheduleEnd)}`,
    row.status,
  ]);
  XLSX.utils.book_append_sheet(
    wb,
    buildSheet(["Training Program", "Type of Training", "Actual Participants", "Schedule", "Status"], sectionIIRows, [40, 16, 16, 24, 14]),
    "II. Implementation Status"
  );

  const sectionIIIRows = summary.officeCoverage.map((row) => [row.officeName, row.totalPersonnel, row.personnelTrained, `${row.coverageRate}%`]);
  XLSX.utils.book_append_sheet(
    wb,
    buildSheet(["Office/Department", "Total Personnel", "Personnel Trained", "Coverage Rate (%)"], sectionIIIRows, [34, 16, 16, 16]),
    "III. Coverage by Office"
  );

  const sectionIVRows = summary.competencyGaps.map((row) => [row.competencyArea, row.employeesAffected]);
  XLSX.utils.book_append_sheet(wb, buildSheet(["Competency Area", "Employees Affected"], sectionIVRows, [40, 18]), "IV. Competency Gaps");

  const sectionVRows = summary.sectionV.map((row) => [
    row.indicator,
    row.target,
    row.actual,
    row.actual >= row.target && row.target > 0 ? "Met" : "In Progress",
  ]);
  XLSX.utils.book_append_sheet(
    wb,
    buildSheet(["Assessment Area", "Target", "Actual", "Status"], sectionVRows, [40, 12, 12, 14]),
    "V. Year-End Assessment"
  );

  XLSX.writeFile(wb, `Annex_6-H_LD_Dashboard_${year}.xlsx`, { compression: true });
}

type HrPlanningExport = {
  personnelComplement: MfRow[];
  officeDistribution: MfRow[];
  ageGroups: MfRow[];
  educationDistribution: MfRow[];
  retirementForecast: RetirementRow[];
};

export function exportHrPlanningExcel(data: HrPlanningExport, year: number) {
  const wb = XLSX.utils.book_new();

  const mfSheet = (rows: MfRow[], firstColumn: string) =>
    buildSheet([firstColumn, "Male", "Female", "Total"], rows.map((r) => [r.label, r.male, r.female, r.total]), [40, 10, 10, 10]);

  XLSX.utils.book_append_sheet(wb, mfSheet(data.personnelComplement, "Employment Status"), "A. Personnel Complement");
  XLSX.utils.book_append_sheet(wb, mfSheet(data.officeDistribution, "Office-Department"), "B. By Office");
  XLSX.utils.book_append_sheet(wb, mfSheet(data.ageGroups, "Age Group"), "C. By Age Group");
  XLSX.utils.book_append_sheet(wb, mfSheet(data.educationDistribution, "Educational Attainment"), "D. By Education");

  XLSX.utils.book_append_sheet(
    wb,
    buildSheet(
      ["Number of Employees Retiring Within", "Total Employees"],
      data.retirementForecast.map((r) => [r.label, r.total]),
      [36, 16]
    ),
    "III. Retirement Forecast"
  );

  XLSX.writeFile(wb, `Annex_3-E_HR_Planning_CY${year}.xlsx`, { compression: true });
}
