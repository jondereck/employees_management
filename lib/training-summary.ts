import { sortByAnnexOfficeOrder } from "@/lib/annex-order";
import { TRAINING_INDICATORS } from "@/lib/training-types";

type TrainingRow = {
  id: string;
  employeeId: string | null;
  durationHours: number;
  indicator: string;
  competencyAddressed: string;
  certificateTitle: string;
  provider: string;
  trainingType: string;
  status: string;
  dateStart: Date;
  dateEnd: Date;
};

type EmployeeRow = {
  id: string;
  officeId: string;
  officeName: string;
};

export type CoverageEmployeeRow = {
  employeeId: string;
  name: string;
  officeName: string;
  position: string;
  employeeTypeName: string;
  trainingCount: number;
  totalHours: number;
};

export type RegistrySummary = {
  totalTrainingsConducted: number;
  totalEmployeesTrained: number;
  totalTrainingHoursCompleted: number;
  byIndicator: Record<string, number>;
  employeesWithAtLeastOneTraining: number;
  employeesWithNoTrainingIntervention: number;
};

function formatEmployeeName(e: {
  lastName: string;
  firstName: string;
  middleName?: string | null;
  suffix?: string | null;
}): string {
  const mi = e.middleName?.trim() ? ` ${e.middleName.trim().charAt(0).toUpperCase()}.` : "";
  const suffix = e.suffix?.trim() ? ` ${e.suffix.trim()}` : "";
  return `${e.lastName}, ${e.firstName}${mi}${suffix}`;
}

/** Split eligible employees into trained vs no-training lists for summary drilldowns. */
export function buildCoverageEmployeeLists(
  employees: Array<{
    id: string;
    firstName: string;
    lastName: string;
    middleName?: string | null;
    suffix?: string | null;
    position: string;
    officeName: string;
    employeeTypeName: string;
  }>,
  trainings: TrainingRow[],
  eligibleEmployeeIds: Set<string>
): { withTraining: CoverageEmployeeRow[]; withNoTraining: CoverageEmployeeRow[] } {
  const stats = new Map<string, { count: number; hours: number }>();
  for (const t of trainings) {
    if (!t.employeeId || !eligibleEmployeeIds.has(t.employeeId)) continue;
    const entry = stats.get(t.employeeId) ?? { count: 0, hours: 0 };
    entry.count += 1;
    entry.hours += t.durationHours || 0;
    stats.set(t.employeeId, entry);
  }

  const withTraining: CoverageEmployeeRow[] = [];
  const withNoTraining: CoverageEmployeeRow[] = [];

  for (const e of employees) {
    if (!eligibleEmployeeIds.has(e.id)) continue;
    const row: CoverageEmployeeRow = {
      employeeId: e.id,
      name: formatEmployeeName(e),
      officeName: e.officeName,
      position: e.position || "",
      employeeTypeName: e.employeeTypeName || "Unassigned",
      trainingCount: stats.get(e.id)?.count ?? 0,
      totalHours: stats.get(e.id)?.hours ?? 0,
    };
    if (row.trainingCount > 0) withTraining.push(row);
    else withNoTraining.push(row);
  }

  withTraining.sort((a, b) => a.name.localeCompare(b.name));
  withNoTraining.sort((a, b) => a.name.localeCompare(b.name));
  return { withTraining, withNoTraining };
}

export function buildRegistrySummary(
  trainings: TrainingRow[],
  totalActiveEmployees: number,
  /** When set, coverage metrics only count trainings linked to these eligible employees. */
  eligibleEmployeeIds?: Set<string>
): RegistrySummary {
  const byIndicator: Record<string, number> = Object.fromEntries(TRAINING_INDICATORS.map((i) => [i, 0]));
  const trainedEmployeeIds = new Set<string>();
  let totalHours = 0;

  for (const t of trainings) {
    totalHours += t.durationHours || 0;
    if (t.indicator in byIndicator) byIndicator[t.indicator] += 1;
    if (!t.employeeId) continue;
    if (eligibleEmployeeIds && !eligibleEmployeeIds.has(t.employeeId)) continue;
    trainedEmployeeIds.add(t.employeeId);
  }

  const employeesWithAtLeastOneTraining = trainedEmployeeIds.size;

  return {
    totalTrainingsConducted: trainings.length,
    totalEmployeesTrained: employeesWithAtLeastOneTraining,
    totalTrainingHoursCompleted: totalHours,
    byIndicator,
    employeesWithAtLeastOneTraining,
    employeesWithNoTrainingIntervention: Math.max(0, totalActiveEmployees - employeesWithAtLeastOneTraining),
  };
}

export type TrainingImplementationRow = {
  certificateTitle: string;
  provider: string;
  trainingType: string;
  scheduleStart: string;
  scheduleEnd: string;
  actualParticipants: number;
  status: string;
};

/** Annex 6-H Section II: one row per distinct training program (certificateTitle + provider). */
export function buildTrainingImplementationStatus(trainings: TrainingRow[]): TrainingImplementationRow[] {
  const groups = new Map<
    string,
    { certificateTitle: string; provider: string; trainingType: string; dateStart: Date; dateEnd: Date; participants: Set<string>; statuses: Set<string> }
  >();

  for (const t of trainings) {
    const key = `${t.certificateTitle.trim().toLowerCase()}|${t.provider.trim().toLowerCase()}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        certificateTitle: t.certificateTitle,
        provider: t.provider,
        trainingType: t.trainingType,
        dateStart: t.dateStart,
        dateEnd: t.dateEnd,
        participants: new Set(),
        statuses: new Set(),
      };
      groups.set(key, group);
    }
    if (t.dateStart < group.dateStart) group.dateStart = t.dateStart;
    if (t.dateEnd > group.dateEnd) group.dateEnd = t.dateEnd;
    if (t.employeeId) group.participants.add(t.employeeId);
    group.statuses.add(t.status);
  }

  return Array.from(groups.values())
    .map((g) => ({
      certificateTitle: g.certificateTitle,
      provider: g.provider,
      trainingType: g.trainingType,
      scheduleStart: g.dateStart.toISOString(),
      scheduleEnd: g.dateEnd.toISOString(),
      actualParticipants: g.participants.size,
      status: g.statuses.size === 1 ? Array.from(g.statuses)[0] : "Mixed",
    }))
    .sort((a, b) => (a.scheduleStart < b.scheduleStart ? 1 : -1));
}

export type OfficeCoverageRow = {
  officeId: string;
  officeName: string;
  totalPersonnel: number;
  personnelTrained: number;
  coverageRate: number;
};

/** Annex 6-H Section III: coverage per real office in the department. */
export function buildOfficeCoverage(employees: EmployeeRow[], trainings: TrainingRow[]): OfficeCoverageRow[] {
  const trainedByOffice = new Map<string, Set<string>>();
  const employeeOffice = new Map<string, string>();
  for (const e of employees) employeeOffice.set(e.id, e.officeId);

  for (const t of trainings) {
    if (!t.employeeId) continue;
    const officeId = employeeOffice.get(t.employeeId);
    if (!officeId) continue;
    if (!trainedByOffice.has(officeId)) trainedByOffice.set(officeId, new Set());
    trainedByOffice.get(officeId)!.add(t.employeeId);
  }

  const officeTotals = new Map<string, { officeName: string; total: number }>();
  for (const e of employees) {
    const entry = officeTotals.get(e.officeId) ?? { officeName: e.officeName, total: 0 };
    entry.total += 1;
    officeTotals.set(e.officeId, entry);
  }

  const rows = Array.from(officeTotals.entries()).map(([officeId, { officeName, total }]) => {
    const trained = trainedByOffice.get(officeId)?.size ?? 0;
    return {
      officeId,
      officeName,
      totalPersonnel: total,
      personnelTrained: trained,
      coverageRate: total > 0 ? Math.round((trained / total) * 1000) / 10 : 0,
    };
  });

  // Same LGU annex office sequence as Annex 3-E section B.
  return sortByAnnexOfficeOrder(rows, (r) => r.officeName);
}

export type CompetencyGapRow = {
  competencyArea: string;
  employeesAffected: number;
};

/** Annex 6-H Section IV: distinct competencies mentioned in the training records. */
export function buildCompetencyGaps(trainings: TrainingRow[]): CompetencyGapRow[] {
  const groups = new Map<string, Set<string>>();
  for (const t of trainings) {
    const area = t.competencyAddressed.trim();
    if (!area) continue;
    if (!groups.has(area)) groups.set(area, new Set());
    if (t.employeeId) groups.get(area)!.add(t.employeeId);
  }

  return Array.from(groups.entries())
    .map(([competencyArea, employeeIds]) => ({ competencyArea, employeesAffected: employeeIds.size }))
    .sort((a, b) => b.employeesAffected - a.employeesAffected);
}
