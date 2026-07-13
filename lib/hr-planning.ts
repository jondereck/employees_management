// Annex 3-E (Annual Human Resource Planning Report) aggregations.
// Section II of the official form is not built yet — add it here when the
// template for that section is provided.

export type HrPlanningEmployee = {
  gender: "Male" | "Female";
  birthday: Date;
  education: string;
  employeeTypeName: string;
  officeId: string;
  officeName: string;
};

export type MfRow = {
  label: string;
  male: number;
  female: number;
  total: number;
};

function tally(rows: HrPlanningEmployee[], keyOf: (e: HrPlanningEmployee) => string, order?: string[]): MfRow[] {
  const groups = new Map<string, { male: number; female: number }>();
  if (order) for (const label of order) groups.set(label, { male: 0, female: 0 });

  for (const e of rows) {
    const key = keyOf(e);
    const entry = groups.get(key) ?? { male: 0, female: 0 };
    if (e.gender === "Male") entry.male += 1;
    else entry.female += 1;
    groups.set(key, entry);
  }

  const out: MfRow[] = [];
  for (const [label, { male, female }] of groups) {
    if (order && male === 0 && female === 0 && !order.includes(label)) continue;
    out.push({ label, male, female, total: male + female });
  }
  return out;
}

function withTotalRow(rows: MfRow[]): MfRow[] {
  const male = rows.reduce((s, r) => s + r.male, 0);
  const female = rows.reduce((s, r) => s + r.female, 0);
  return [...rows, { label: "Total", male, female, total: male + female }];
}

/** A. Personnel Complement — dynamic rows from the department's actual employee types. */
export function buildPersonnelComplement(rows: HrPlanningEmployee[]): MfRow[] {
  const body = tally(rows, (e) => e.employeeTypeName.trim() || "Unassigned").sort((a, b) => b.total - a.total);
  return withTotalRow(body);
}

/** B. Distribution by Office. */
export function buildOfficeDistribution(rows: HrPlanningEmployee[]): MfRow[] {
  const body = tally(rows, (e) => e.officeName.trim() || "Unassigned").sort((a, b) => a.label.localeCompare(b.label));
  return withTotalRow(body);
}

export function ageAt(birthday: Date, asOf: Date): number {
  let age = asOf.getFullYear() - birthday.getFullYear();
  const monthDiff = asOf.getMonth() - birthday.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < birthday.getDate())) age -= 1;
  return age;
}

const AGE_GROUPS = ["Below 25", "25 - 34", "35 - 44", "45 - 54", "55 - 64", "65 and Above"];

export function getAgeGroupLabel(age: number): string {
  if (age < 25) return AGE_GROUPS[0];
  if (age <= 34) return AGE_GROUPS[1];
  if (age <= 44) return AGE_GROUPS[2];
  if (age <= 54) return AGE_GROUPS[3];
  if (age <= 64) return AGE_GROUPS[4];
  return AGE_GROUPS[5];
}

/** C. Distribution by Age Group. */
export function buildAgeGroups(rows: HrPlanningEmployee[], asOf: Date): MfRow[] {
  const body = tally(rows, (e) => getAgeGroupLabel(ageAt(e.birthday, asOf)), AGE_GROUPS);
  return withTotalRow(body);
}

export const EDUCATION_CATEGORIES = [
  "High School Graduate",
  "Vocational/Technical",
  "College Graduate",
  "Master's Degree",
  "Doctorate Degree",
  // Extra reconciliation rows (not on the official 5-row form; delete from the
  // export if the submitted form must have exactly 5 rows):
  "Elementary",
  "College Undergraduate",
  "Others/Unclassified",
] as const;

/**
 * Classify the free-text `education` field into Annex 3-E categories.
 * The data has ~315 distinct values ("BS in Civil Engineering", "Midwifery",
 * "College (undergraduate)", blanks...), so this is keyword-based.
 */
export function classifyEducation(raw: string): (typeof EDUCATION_CATEGORIES)[number] {
  const text = (raw || "").trim().toLowerCase();
  if (!text) return "Others/Unclassified";

  if (/(doctor|ph\.?d|ed\.?d\b|dr\.)/.test(text)) return "Doctorate Degree";
  if (/(master|m\.?a\.? |maed|mba|mpa|m\.?s\.? in)/.test(text)) return "Master's Degree";
  if (/(vocational|midwifery|tesda|technical course|2[- ]?year)/.test(text)) return "Vocational/Technical";

  const isCollegeDegree = /^(bs|ba|ab|b\.s|b\.a)\b/.test(text) || /bachelor/.test(text);
  const isUndergrad = /under\s?grad/.test(text);
  if (/college/.test(text)) {
    return isUndergrad ? "College Undergraduate" : "College Graduate";
  }
  if (isCollegeDegree) return isUndergrad ? "College Undergraduate" : "College Graduate";

  if (/high school|highschool|hs grad/.test(text)) {
    return isUndergrad ? "Others/Unclassified" : "High School Graduate";
  }
  if (/elementary/.test(text)) return "Elementary";

  return "Others/Unclassified";
}

/** D. Distribution by Educational Attainment. */
export function buildEducationDistribution(rows: HrPlanningEmployee[]): MfRow[] {
  const body = tally(rows, (e) => classifyEducation(e.education), [...EDUCATION_CATEGORIES]);
  // Hide extra rows that ended up empty; the official 5 always show.
  const official = new Set(EDUCATION_CATEGORIES.slice(0, 5));
  const filtered = body.filter((r) => official.has(r.label as any) || r.total > 0);
  return withTotalRow(filtered);
}

export type RetirementRow = { label: string; total: number };

export const MANDATORY_RETIREMENT_AGE = 65;

export const RETIREMENT_WINDOWS = [
  { label: "1 Year", years: 1 },
  { label: "3 Years", years: 3 },
  { label: "5 Years", years: 5 },
  { label: "10 Years", years: 10 },
] as const;

export function retirementDateOf(birthday: Date): Date {
  const d = new Date(birthday);
  d.setFullYear(d.getFullYear() + MANDATORY_RETIREMENT_AGE);
  return d;
}

/** True when Permanent employee reaches age 65 on or before asOf + years. */
export function isRetiringWithin(birthday: Date, asOf: Date, years: number): boolean {
  const horizon = new Date(asOf);
  horizon.setFullYear(horizon.getFullYear() + years);
  return retirementDateOf(birthday) <= horizon;
}

/**
 * III. Retirement Forecast — Permanent employees only (plantilla positions are
 * the ones with government retirement; JO/COS have none). Cumulative counts of
 * employees reaching age 65 within each window.
 */
export function buildRetirementForecast(rows: HrPlanningEmployee[], asOf: Date): RetirementRow[] {
  const permanent = rows.filter((e) => e.employeeTypeName.trim().toLowerCase() === "permanent");

  return RETIREMENT_WINDOWS.map(({ label, years }) => ({
    label,
    total: permanent.filter((e) => isRetiringWithin(e.birthday, asOf, years)).length,
  }));
}
