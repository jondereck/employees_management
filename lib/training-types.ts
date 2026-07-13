/** One row parsed client-side from the SKILLPATH training export ("SOURCE" sheet). */
export type TrainingImportRow = {
  bioNumberRaw: string;
  nameRaw: string;
  officeNameRaw: string;
  positionRaw: string;
  appointmentRaw: string;
  certificateTitle: string;
  trainingType: string;
  provider: string;
  dateStart: string; // ISO date
  dateEnd: string; // ISO date
  durationHours: number;
  certificateOf: string;
  relevanceToJob: string;
  competencyAddressed: string;
  status: string;
  indicator: string;
  remarks: string;
};

export type TrainingResolvedRow = TrainingImportRow & {
  matchStatus: "matched" | "unmatched";
  matchedBy: "bio" | "name" | null;
  employeeId: string | null;
  employeeName: string | null;
  officeName: string | null;
};

export const TRAINING_INDICATORS = [
  "Technical Training",
  "Core Competency Training",
  "Leadership Training",
  "Mandatory Training",
] as const;

export type TrainingIndicator = (typeof TRAINING_INDICATORS)[number];

/** A saved Training row as returned by GET /api/[departmentId]/training, joined to its matched employee. */
export type TrainingRecord = {
  id: string;
  certificateTitle: string;
  provider: string;
  trainingType: string;
  dateStart: string;
  durationHours: number;
  competencyAddressed: string;
  status: string;
  indicator: string;
  nameRaw: string;
  positionRaw: string;
  officeNameRaw: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    middleName: string;
    suffix: string;
    position: string;
    offices: { id: string; name: string } | null;
  } | null;
};

export function trainingEmployeeDisplayName(t: TrainingRecord): string {
  if (t.employee) {
    const mi = t.employee.middleName?.trim() ? ` ${t.employee.middleName.trim().charAt(0).toUpperCase()}.` : "";
    const suffix = t.employee.suffix?.trim() ? ` ${t.employee.suffix.trim()}` : "";
    return `${t.employee.lastName}, ${t.employee.firstName}${mi}${suffix}`;
  }
  return t.nameRaw || "(Unmatched)";
}

/** Response shape of GET /api/[departmentId]/training/summary. */
export type TrainingSummaryResponse = {
  year: number;
  totalActiveEmployees: number;
  registry: {
    totalTrainingsConducted: number;
    totalEmployeesTrained: number;
    totalTrainingHoursCompleted: number;
    byIndicator: Record<string, number>;
    employeesWithAtLeastOneTraining: number;
    employeesWithNoTrainingIntervention: number;
  };
  employeesWithTraining: Array<{
    employeeId: string;
    name: string;
    officeName: string;
    position: string;
    employeeTypeName: string;
    trainingCount: number;
    totalHours: number;
  }>;
  employeesWithNoTraining: Array<{
    employeeId: string;
    name: string;
    officeName: string;
    position: string;
    employeeTypeName: string;
    trainingCount: number;
    totalHours: number;
  }>;
  includedEmployeeTypes?: string[];
  implementationStatus: Array<{
    certificateTitle: string;
    provider: string;
    trainingType: string;
    scheduleStart: string;
    scheduleEnd: string;
    actualParticipants: number;
    status: string;
  }>;
  officeCoverage: Array<{
    officeId: string;
    officeName: string;
    totalPersonnel: number;
    personnelTrained: number;
    coverageRate: number;
  }>;
  competencyGaps: Array<{ competencyArea: string; employeesAffected: number }>;
  target: Record<string, number>;
  sectionI: Array<{ indicator: string; target: number; actual: number; percentAccomplishment: number }>;
  sectionV: Array<{ indicator: string; target: number; actual: number; percentAccomplishment: number }>;
};
