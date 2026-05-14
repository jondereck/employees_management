export const GENIO_CAPABILITIES = {
  employeeProfile: {
    answerable: true,
    fields: ["name", "employeeNo", "gender", "birthday", "age", "position", "office", "employeeType", "eligibility"],
  },
  officeAnalytics: {
    answerable: true,
    fields: ["office", "isHead", "employeeCount", "genderDistribution"],
  },
  historySnapshots: {
    answerable: true,
    fields: ["effectiveAt", "office", "employeeType", "eligibility", "position", "status"],
  },
  awards: {
    answerable: true,
    fields: ["title", "description", "givenAt", "issuer", "tags"],
  },
  employmentEvents: {
    answerable: true,
    fields: ["type", "details", "occurredAt"],
  },
  scheduleMetadata: {
    answerable: true,
    fields: ["type", "startTime", "endTime", "effectiveFrom", "effectiveTo", "timezone", "weeklyPattern", "rotationPattern"],
  },
  attendanceAnalytics: {
    answerable: false,
    reason: "No attendance log model is available in the current schema.",
  },
  payrollDecisions: {
    answerable: false,
    reason: "Genio is read-only and should not make final payroll decisions.",
  },
} as const;

export const GENIO_DB_BACKED_SUGGESTIONS = [
  "count by office",
  "employee type distribution",
  "gender distribution",
  "age analytics",
  "tenure analytics",
  "award summaries",
  "employment history",
  "schedule metadata",
] as const;
