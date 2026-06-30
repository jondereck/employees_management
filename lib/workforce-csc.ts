import { suggestWorkforceIndicator } from "@/lib/workforce-indicators";
import { computeTenure } from "@/utils/tenure";

export const WORKFORCE_CSC_Q39_ROWS = [
  {
    key: "career_first_non_supervisory",
    label: "Career service – First-level / non-supervisory job",
  },
  {
    key: "career_first_supervisory",
    label: "Career service – First-level / supervisory job",
  },
  {
    key: "career_second_non_supervisory",
    label: "Career service – Second-level / non-supervisory job",
  },
  {
    key: "career_second_supervisory",
    label: "Career service – Second-level / supervisory job",
  },
  {
    key: "career_third",
    label: "Career service – Third-level (Career Executive Service)",
  },
  {
    key: "noncareer_elective_confidential_contractual_specialized",
    label:
      "Non-career service – Elective officials/secretaries and their confidential staff; Commission and board members and their confidential staff, contractual personnel with special technical skills",
  },
  {
    key: "noncareer_emergency_seasonal",
    label: "Non-career service – emergency and seasonal personnel",
  },
  {
    key: "others",
    label: "Others",
  },
] as const;

export const WORKFORCE_CSC_Q38_ROWS = [
  { key: "temporary", label: "Temporary employees" },
  { key: "substitute", label: "Substitute employees" },
  { key: "coterminous", label: "Coterminous employees" },
  { key: "fixed_term", label: "Fixed Term employees" },
  { key: "contractual", label: "Contractual employees" },
  { key: "casual", label: "Casual employees" },
  { key: "provisional", label: "Provisional employees (for teachers)" },
] as const;

export type WorkforceCscQ39RowKey = (typeof WORKFORCE_CSC_Q39_ROWS)[number]["key"];
export type WorkforceCscQ38RowKey = (typeof WORKFORCE_CSC_Q38_ROWS)[number]["key"];
export type WorkforceCscSection = "q39" | "q38";
export type WorkforceCscSex = "male" | "female";
export type WorkforceCscSexFilter = WorkforceCscSex | "total";

export type WorkforceCscEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  suffix?: string | null;
  gender?: string | null;
  position?: string | null;
  salaryGrade?: number | null;
  dateHired?: string | Date | null;
  latestAppointment?: string | null;
  terminateDate?: string | Date | null;
  isArchived?: boolean;
  office?: { id?: string; name?: string | null } | null;
  employeeType?: { id?: string; name?: string | null } | null;
  eligibility?: { id?: string; name?: string | null } | null;
  employmentEvents?: Array<{
    type?: string | null;
    occurredAt?: string | Date | null;
    deletedAt?: string | Date | null;
  }> | null;
};

export type WorkforceCscCountRow = {
  rowKey: WorkforceCscQ39RowKey;
  label: string;
  male: number;
  female: number;
  total: number;
};

export type WorkforceCscAverageRow = {
  rowKey: WorkforceCscQ38RowKey;
  label: string;
  male: number;
  female: number;
  total: number;
};

export type WorkforceCscDrilldownEmployee = {
  id: string;
  name: string;
  position: string;
  officeName: string;
  employeeTypeName: string;
  eligibilityName: string;
  sex: WorkforceCscSex;
  serviceMonths: number;
};

const SUPERVISORY_GRADE_CUTOFF = 10;
const THIRD_LEVEL_GRADE_MIN = 25;
const AVERAGE_MONTH_DAYS = 30.4375;

const NONCAREER_SPECIALIZED_KEYWORDS = [
  "elective",
  "confidential",
  "board member",
  "board members",
  "commission",
  "commissioner",
  "contract of service",
  "contractual",
  "special technical",
  "specialized",
  "cos",
];

const EMERGENCY_SEASONAL_KEYWORDS = ["emergency", "seasonal"];

const FIRST_LEVEL_POSITION_KEYWORDS = [
  "clerical",
  "clerk",
  "trades",
  "trade",
  "craft",
  "laborer",
  "janitor",
  "janitorial",
  "utility",
  "driver",
  "maintenance",
  "security",
  "custodial",
  "cleaner",
  "messenger",
  "aide",
  "helper",
];

const FIRST_LEVEL_INDICATORS = new Set([
  "Clerical Services",
  "Janitorial Services",
  "Security Services",
  "Trade and Crafts/Laborer",
]);

const Q38_TYPE_PATTERNS: Array<{ key: WorkforceCscQ38RowKey; patterns: string[] }> = [
  { key: "temporary", patterns: ["temporary"] },
  { key: "substitute", patterns: ["substitute"] },
  { key: "coterminous", patterns: ["coterminous", "co terminous", "co-terminous"] },
  { key: "fixed_term", patterns: ["fixed term", "fixed-term"] },
  { key: "contractual", patterns: ["contractual", "contract of service", "cos"] },
  { key: "casual", patterns: ["casual"] },
  { key: "provisional", patterns: ["provisional"] },
];

function normalizeText(value: string | null | undefined) {
  return ` ${String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

function includesAny(text: string, patterns: readonly string[]) {
  return patterns.some((pattern) => text.includes(normalizeText(pattern)));
}

function getSexBucket(gender: string | null | undefined): WorkforceCscSex {
  return gender === "Female" ? "female" : "male";
}

function isSupervisory(salaryGrade: number | null | undefined) {
  return Number.isFinite(salaryGrade) && Number(salaryGrade) >= SUPERVISORY_GRADE_CUTOFF;
}

function isThirdLevelSalary(salaryGrade: number | null | undefined) {
  return Number.isFinite(salaryGrade) && Number(salaryGrade) >= THIRD_LEVEL_GRADE_MIN;
}

function getFullName(employee: WorkforceCscEmployee) {
  return [
    employee.firstName,
    employee.middleName?.trim(),
    employee.lastName,
    employee.suffix?.trim(),
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyQ39Row(employee: WorkforceCscEmployee): WorkforceCscQ39RowKey {
  const positionText = normalizeText(employee.position);
  const employeeTypeText = normalizeText(employee.employeeType?.name);
  const officeText = normalizeText(employee.office?.name);
  const combinedText = `${positionText}${employeeTypeText}${officeText}`;

  if (includesAny(combinedText, NONCAREER_SPECIALIZED_KEYWORDS)) {
    return "noncareer_elective_confidential_contractual_specialized";
  }

  if (includesAny(employeeTypeText, EMERGENCY_SEASONAL_KEYWORDS)) {
    return "noncareer_emergency_seasonal";
  }

  if (isThirdLevelSalary(employee.salaryGrade)) {
    return "career_third";
  }

  if (!positionText.trim() && !employeeTypeText.trim()) {
    return "others";
  }

  const suggestion = suggestWorkforceIndicator({
    position: employee.position,
    officeName: employee.office?.name ?? "",
    employeeTypeName: employee.employeeType?.name ?? "",
  });

  const firstLevel =
    includesAny(positionText, FIRST_LEVEL_POSITION_KEYWORDS) ||
    FIRST_LEVEL_INDICATORS.has(suggestion.indicatorName);

  if (firstLevel) {
    return isSupervisory(employee.salaryGrade)
      ? "career_first_supervisory"
      : "career_first_non_supervisory";
  }

  if (positionText.trim() || employeeTypeText.trim()) {
    return isSupervisory(employee.salaryGrade)
      ? "career_second_supervisory"
      : "career_second_non_supervisory";
  }

  return "others";
}

export function classifyQ38Row(employee: WorkforceCscEmployee): WorkforceCscQ38RowKey | null {
  const employeeTypeText = normalizeText(employee.employeeType?.name);
  for (const entry of Q38_TYPE_PATTERNS) {
    if (includesAny(employeeTypeText, entry.patterns)) {
      return entry.key;
    }
  }
  return null;
}

export function getEmployeeServiceMonths(employee: WorkforceCscEmployee, now: Date = new Date()) {
  const tenure = computeTenure(
    {
      dateHired: employee.dateHired,
      latestAppointment: employee.latestAppointment,
      terminateDate: employee.terminateDate,
      isArchived: employee.isArchived,
      employmentEvents: employee.employmentEvents ?? [],
    },
    now
  );

  return tenure.totalService.totalDays > 0
    ? tenure.totalService.totalDays / AVERAGE_MONTH_DAYS
    : 0;
}

export function buildWorkforceCscSummary(
  employees: WorkforceCscEmployee[],
  now: Date = new Date()
) {
  const q39Rows = WORKFORCE_CSC_Q39_ROWS.map<WorkforceCscCountRow>((entry) => ({
    rowKey: entry.key,
    label: entry.label,
    male: 0,
    female: 0,
    total: 0,
  }));
  const q38Buckets = WORKFORCE_CSC_Q38_ROWS.map((entry) => ({
    rowKey: entry.key,
    label: entry.label,
    maleValues: [] as number[],
    femaleValues: [] as number[],
    totalValues: [] as number[],
  }));

  const q39ByKey = new Map(q39Rows.map((row) => [row.rowKey, row]));
  const q38ByKey = new Map(q38Buckets.map((row) => [row.rowKey, row]));

  for (const employee of employees) {
    const sex = getSexBucket(employee.gender);

    const q39Row = q39ByKey.get(classifyQ39Row(employee));
    if (q39Row) {
      q39Row[sex] += 1;
      q39Row.total += 1;
    }

    const q38Key = classifyQ38Row(employee);
    if (!q38Key) continue;
    const q38Row = q38ByKey.get(q38Key);
    if (!q38Row) continue;
    const serviceMonths = getEmployeeServiceMonths(employee, now);
    q38Row.totalValues.push(serviceMonths);
    if (sex === "female") q38Row.femaleValues.push(serviceMonths);
    else q38Row.maleValues.push(serviceMonths);
  }

  const q38Rows = q38Buckets.map<WorkforceCscAverageRow>((row) => ({
    rowKey: row.rowKey,
    label: row.label,
    male: average(row.maleValues),
    female: average(row.femaleValues),
    total: average(row.totalValues),
  }));

  return {
    q39: { rows: q39Rows },
    q38: { rows: q38Rows },
    meta: {
      generatedAt: now.toISOString(),
      matchedEmployeeCount: employees.length,
    },
  };
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildWorkforceCscDrilldown(
  employees: WorkforceCscEmployee[],
  input: {
    section: WorkforceCscSection;
    rowKey: string;
    sex: WorkforceCscSexFilter;
    searchText?: string;
  },
  now: Date = new Date()
) {
  const rowLabel =
    input.section === "q39"
      ? WORKFORCE_CSC_Q39_ROWS.find((row) => row.key === input.rowKey)?.label ?? input.rowKey
      : WORKFORCE_CSC_Q38_ROWS.find((row) => row.key === input.rowKey)?.label ?? input.rowKey;

  const normalizedSearch = normalizeText(input.searchText);

  const matches = employees
    .filter((employee) => {
      const sex = getSexBucket(employee.gender);
      if (input.sex !== "total" && sex !== input.sex) return false;

      if (input.section === "q39") {
        return classifyQ39Row(employee) === input.rowKey;
      }

      return classifyQ38Row(employee) === input.rowKey;
    })
    .map<WorkforceCscDrilldownEmployee>((employee) => ({
      id: employee.id,
      name: getFullName(employee),
      position: employee.position?.trim() || "Unspecified",
      officeName: employee.office?.name?.trim() || "Unassigned",
      employeeTypeName: employee.employeeType?.name?.trim() || "Unassigned",
      eligibilityName: employee.eligibility?.name?.trim() || "Unspecified",
      sex: getSexBucket(employee.gender),
      serviceMonths: getEmployeeServiceMonths(employee, now),
    }))
    .filter((employee) => {
      if (!normalizedSearch.trim()) return true;
      const haystack = normalizeText(
        [employee.name, employee.position, employee.officeName, employee.employeeTypeName].join(" ")
      );
      return haystack.includes(normalizedSearch);
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    section: input.section,
    rowKey: input.rowKey,
    rowLabel,
    sex: input.sex,
    employees: matches,
    meta: {
      generatedAt: now.toISOString(),
      resultCount: matches.length,
    },
  };
}
