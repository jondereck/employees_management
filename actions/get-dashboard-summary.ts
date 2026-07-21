import prismadb from "@/lib/prismadb";
import {
  getCurrentMonthIndexInTimeZone,
  getCurrentYearInTimeZone,
  getMonthDayInTimeZone,
} from "@/lib/birthday";
import {
  buildDashboardPlantillaSummary,
  type DashboardPlantillaSummary,
} from "@/lib/dashboard-plantilla";

export type DashboardChartSlice = {
  name: string;
  value: number;
  color: string;
};

export type DashboardListItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  meta?: string;
};

export type DashboardIncompleteSummary = {
  count: number;
  fields: { label: string; count: number }[];
  employees: DashboardListItem[];
};

export type DashboardGenderCountRow = {
  id: string;
  name: string;
  male: number;
  female: number;
  total: number;
  children?: DashboardGenderCountRow[];
};

export type DashboardGenderGroupKey =
  | "employeeType"
  | "eligibility"
  | "supervisory"
  | "office";

export type DashboardGenderCountsNested = {
  employeeType: {
    byEligibility: DashboardGenderCountRow[];
    bySupervisory: DashboardGenderCountRow[];
    byOffice: DashboardGenderCountRow[];
  };
  eligibility: {
    byEmployeeType: DashboardGenderCountRow[];
    bySupervisory: DashboardGenderCountRow[];
    byOffice: DashboardGenderCountRow[];
  };
  supervisory: {
    byEmployeeType: DashboardGenderCountRow[];
    byEligibility: DashboardGenderCountRow[];
    byOffice: DashboardGenderCountRow[];
  };
  office: {
    byEmployeeType: DashboardGenderCountRow[];
    byEligibility: DashboardGenderCountRow[];
    bySupervisory: DashboardGenderCountRow[];
  };
};

export type DashboardSummary = {
  pendingApprovals: number;
  officeCount: number;
  birthdaysToday: number;
  birthdaysThisMonth: number;
  upcomingRetirements: number;
  upcomingLoyaltyMilestones: number;
  incompleteRecords: DashboardIncompleteSummary;
  appointmentSlices: DashboardChartSlice[];
  genderSlices: DashboardChartSlice[];
  eligibilitySlices: DashboardChartSlice[];
  genderCountsByEmployeeType: DashboardGenderCountRow[];
  genderCountsByEligibility: DashboardGenderCountRow[];
  genderCountsBySupervisory: DashboardGenderCountRow[];
  genderCountsByOffice: DashboardGenderCountRow[];
  genderCountsNested: DashboardGenderCountsNested;
  plantilla: DashboardPlantillaSummary;
};

const FALLBACK_COLORS = [
  "#2563eb",
  "#16a34a",
  "#db2777",
  "#f59e0b",
  "#0891b2",
  "#7c3aed",
  "#dc2626",
  "#64748b",
];
const ELIGIBILITY_CHART_COLORS = [
  "#0ea5e9",
  "#22c55e",
  "#f97316",
  "#a855f7",
  "#ef4444",
  "#14b8a6",
  "#eab308",
  "#3b82f6",
];

const MILESTONE_YEARS = [10, 15, 20, 25, 30, 35, 40];
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const cleanHexColor = (value: string | null | undefined, fallback: string) => {
  const color = value?.trim();
  if (!color || color.toLowerCase() === "unassigned") return fallback;
  return /^#[0-9a-f]{3,8}$/i.test(color) ? color : fallback;
};

const countById = <T extends string | null>(
  rows: { id: T; count: number }[],
) =>
  rows.reduce<Record<string, number>>((acc, row) => {
    if (row.id) acc[row.id] = row.count;
    return acc;
  }, {});

const buildOtherLimitedSlices = (
  slices: DashboardChartSlice[],
  limit = 5,
): DashboardChartSlice[] => {
  const visible = slices.filter((slice) => slice.value > 0);
  if (visible.length <= limit) return visible;

  const top = visible.slice(0, limit - 1);
  const otherTotal = visible
    .slice(limit - 1)
    .reduce((sum, slice) => sum + slice.value, 0);

  return [
    ...top,
    {
      name: "Others",
      value: otherTotal,
      color: "#94a3b8",
    },
  ];
};

const fullNameFromParts = (employee: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  suffix?: string | null;
  prefix?: string | null;
  nickname?: string | null;
}) => {
  if (employee.nickname?.trim()) {
    return [employee.firstName, `"${employee.nickname.trim()}"`, employee.lastName]
      .filter(Boolean)
      .join(" ");
  }

  return [
    employee.prefix,
    employee.firstName,
    employee.middleName,
    employee.lastName,
    employee.suffix,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
};

const isRetirementUpcomingThisYear = (employee: {
  birthday: Date;
  dateHired: Date;
}) => {
  const today = new Date();
  const currentYear = getCurrentYearInTimeZone();
  const birthDate = new Date(employee.birthday);
  const hireDate = new Date(employee.dateHired);

  if (Number.isNaN(birthDate.getTime()) || Number.isNaN(hireDate.getTime())) {
    return false;
  }

  const retirementYear = birthDate.getFullYear() + 65;
  if (retirementYear !== currentYear) return false;

  const retirementDate = new Date(
    retirementYear,
    birthDate.getMonth(),
    birthDate.getDate(),
  );
  if (retirementDate < today) return false;

  let serviceYears = retirementYear - hireDate.getFullYear();
  const serviceAnniversary = new Date(
    retirementYear,
    hireDate.getMonth(),
    hireDate.getDate(),
  );
  if (serviceAnniversary > retirementDate) serviceYears -= 1;

  return serviceYears >= 10;
};

const countUpcomingLoyaltyMilestones = (dateHired: Date) => {
  const today = new Date();
  const currentYear = getCurrentYearInTimeZone();
  const hireDate = new Date(dateHired);

  if (Number.isNaN(hireDate.getTime())) return 0;

  return MILESTONE_YEARS.filter((milestone) => {
    const milestoneYear = hireDate.getFullYear() + milestone;
    if (milestoneYear !== currentYear) return false;

    const milestoneDate = new Date(
      milestoneYear,
      hireDate.getMonth(),
      hireDate.getDate(),
    );

    return milestoneDate >= today;
  }).length;
};

export const getDashboardSummary = async (
  departmentId: string,
): Promise<DashboardSummary> => {
  const [
    pendingApprovals,
    officeCount,
    appointmentRows,
    genderRows,
    eligibilityRows,
    employeeTypeGenderRows,
    eligibilityGenderRows,
    employeeTypes,
    eligibilities,
    activeEmployees,
    plantillaPositions,
    plantillaEmployees,
  ] = await Promise.all([
    prismadb.changeRequest.count({
      where: { departmentId, status: "PENDING" },
    }),
    prismadb.offices.count({ where: { departmentId } }),
    prismadb.employee.groupBy({
      by: ["employeeTypeId"],
      where: { departmentId, isArchived: false },
      _count: { _all: true },
    }),
    prismadb.employee.groupBy({
      by: ["gender"],
      where: { departmentId, isArchived: false },
      _count: { _all: true },
    }),
    prismadb.employee.groupBy({
      by: ["eligibilityId"],
      where: { departmentId, isArchived: false },
      _count: { _all: true },
    }),
    prismadb.employee.groupBy({
      by: ["employeeTypeId", "gender"],
      where: { departmentId, isArchived: false },
      _count: { _all: true },
    }),
    prismadb.employee.groupBy({
      by: ["eligibilityId", "gender"],
      where: { departmentId, isArchived: false },
      _count: { _all: true },
    }),
    prismadb.employeeType.findMany({
      where: { departmentId },
      select: { id: true, name: true, value: true },
      orderBy: { name: "asc" },
    }),
    prismadb.eligibility.findMany({
      where: { departmentId },
      select: { id: true, name: true, value: true },
      orderBy: { name: "asc" },
    }),
    prismadb.employee.findMany({
      where: { departmentId, isArchived: false },
      select: {
        id: true,
        prefix: true,
        firstName: true,
        middleName: true,
        lastName: true,
        suffix: true,
        nickname: true,
        birthday: true,
        dateHired: true,
        employeeNo: true,
        contactNumber: true,
        emergencyContactName: true,
        emergencyContactNumber: true,
        publicEnabled: true,
        salaryGrade: true,
        gender: true,
        employeeTypeId: true,
        eligibilityId: true,
        offices: { select: { id: true, name: true } },
      },
    }),
    prismadb.plantillaPosition.findMany({
      where: { departmentId },
      select: { id: true, officeId: true, isActive: true },
    }),
    prismadb.employee.findMany({
      where: {
        departmentId,
        isArchived: false,
        plantillaPositionId: { not: null },
      },
      select: {
        id: true,
        officeId: true,
        plantillaPositionId: true,
        isArchived: true,
      },
    }),
  ]);

  const appointmentCounts = countById(
    appointmentRows.map((row) => ({
      id: row.employeeTypeId,
      count: row._count._all,
    })),
  );
  const eligibilityCounts = countById(
    eligibilityRows.map((row) => ({
      id: row.eligibilityId,
      count: row._count._all,
    })),
  );
  const currentMonth = getCurrentMonthIndexInTimeZone() + 1;
  const todayMonthDay = getMonthDayInTimeZone(new Date());

  const appointmentSlices = employeeTypes
    .map((type, index) => ({
      name: type.name.trim() || "Unassigned",
      value: appointmentCounts[type.id] ?? 0,
      color: cleanHexColor(type.value, FALLBACK_COLORS[index % FALLBACK_COLORS.length]),
    }))
    .filter((slice) => slice.value > 0);

  const genderSlices = genderRows
    .map((row) => ({
      name: row.gender,
      value: row._count._all,
      color: row.gender === "Female" ? "#db2777" : "#2563eb",
    }))
    .filter((slice) => slice.value > 0);

  const buildGenderCountRows = <T extends { id: string; name: string }>(
    categories: T[],
    genderRows: { id: string | null; gender: string; count: number }[],
  ): DashboardGenderCountRow[] =>
    categories
      .map((category) => {
        const male = genderRows
          .filter((row) => row.id === category.id && row.gender === "Male")
          .reduce((sum, row) => sum + row.count, 0);
        const female = genderRows
          .filter((row) => row.id === category.id && row.gender === "Female")
          .reduce((sum, row) => sum + row.count, 0);
        return {
          id: category.id,
          name: category.name.trim() || "Unassigned",
          male,
          female,
          total: male + female,
        };
      })
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total);

  const genderCountsByEmployeeType = buildGenderCountRows(
    employeeTypes,
    employeeTypeGenderRows.map((row) => ({
      id: row.employeeTypeId,
      gender: row.gender,
      count: row._count._all,
    })),
  );

  const genderCountsByEligibility = buildGenderCountRows(
    eligibilities,
    eligibilityGenderRows.map((row) => ({
      id: row.eligibilityId,
      gender: row.gender,
      count: row._count._all,
    })),
  );

  const SUPERVISORY_GRADE_CUTOFF = 10;

  const buildSupervisoryRows = (
    employees: Pick<(typeof activeEmployees)[number], "salaryGrade" | "gender">[],
  ): DashboardGenderCountRow[] => {
    const buckets: Record<
      "supervisory" | "nonSupervisory" | "unspecified",
      { name: string; male: number; female: number }
    > = {
      supervisory: { name: `Supervisory (SG ${SUPERVISORY_GRADE_CUTOFF}+)`, male: 0, female: 0 },
      nonSupervisory: { name: "Non-Supervisory (SG 1–9)", male: 0, female: 0 },
      unspecified: { name: "No Salary Grade", male: 0, female: 0 },
    };

    for (const employee of employees) {
      const grade = employee.salaryGrade;
      const bucketKey =
        grade == null || grade <= 0
          ? "unspecified"
          : grade >= SUPERVISORY_GRADE_CUTOFF
            ? "supervisory"
            : "nonSupervisory";
      const bucket = buckets[bucketKey];
      if (employee.gender === "Female") bucket.female += 1;
      else bucket.male += 1;
    }

    return (["supervisory", "nonSupervisory", "unspecified"] as const)
      .map((key) => {
        const bucket = buckets[key];
        return {
          id: key,
          name: bucket.name,
          male: bucket.male,
          female: bucket.female,
          total: bucket.male + bucket.female,
        };
      })
      .filter((row) => row.total > 0);
  };

  const genderCountsBySupervisory = buildSupervisoryRows(activeEmployees);

  const SUPERVISORY_BUCKET_NAMES: Record<string, string> = {
    supervisory: `Supervisory (SG ${SUPERVISORY_GRADE_CUTOFF}+)`,
    nonSupervisory: "Non-Supervisory (SG 1–9)",
    unspecified: "No Salary Grade",
  };

  type GenderDimension = DashboardGenderGroupKey;

  type GenderEmployee = Pick<
    (typeof activeEmployees)[number],
    "salaryGrade" | "gender" | "employeeTypeId" | "eligibilityId" | "offices"
  >;

  const employeeTypeNameById = new Map(
    employeeTypes.map((type) => [type.id, type.name.trim() || "Unassigned"]),
  );
  const eligibilityNameById = new Map(
    eligibilities.map((item) => [item.id, item.name.trim() || "Unassigned"]),
  );

  const genderKey = (gender: string) => (gender === "Female" ? "female" : "male") as "male" | "female";

  const supervisoryBucketId = (grade: number | null) => {
    if (grade == null || grade <= 0) return "unspecified";
    if (grade >= SUPERVISORY_GRADE_CUTOFF) return "supervisory";
    return "nonSupervisory";
  };

  const dimensionOf = (
    employee: GenderEmployee,
    dimension: GenderDimension,
  ): { id: string; name: string } => {
    if (dimension === "employeeType") {
      return {
        id: employee.employeeTypeId,
        name: employeeTypeNameById.get(employee.employeeTypeId) ?? "Unassigned",
      };
    }
    if (dimension === "eligibility") {
      return {
        id: employee.eligibilityId,
        name: eligibilityNameById.get(employee.eligibilityId) ?? "Unassigned",
      };
    }
    if (dimension === "office") {
      const officeId = employee.offices?.id?.trim() || "unassigned-office";
      const officeName = employee.offices?.name?.trim() || "Unassigned Office";
      return { id: officeId, name: officeName };
    }
    const id = supervisoryBucketId(employee.salaryGrade);
    return { id, name: SUPERVISORY_BUCKET_NAMES[id] ?? id };
  };

  const buildOfficeRows = (employees: GenderEmployee[]): DashboardGenderCountRow[] => {
    const buckets = new Map<string, { name: string; male: number; female: number }>();
    for (const employee of employees) {
      const { id, name } = dimensionOf(employee, "office");
      let bucket = buckets.get(id);
      if (!bucket) {
        bucket = { name, male: 0, female: 0 };
        buckets.set(id, bucket);
      }
      if (employee.gender === "Female") bucket.female += 1;
      else bucket.male += 1;
    }
    return Array.from(buckets.entries())
      .map(([id, bucket]) => ({
        id,
        name: bucket.name,
        male: bucket.male,
        female: bucket.female,
        total: bucket.male + bucket.female,
      }))
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  };

  const genderCountsByOffice = buildOfficeRows(activeEmployees);

  const buildNestedRows = (
    employees: GenderEmployee[],
    primary: GenderDimension,
    nested: GenderDimension,
  ): DashboardGenderCountRow[] => {
    type Acc = {
      name: string;
      male: number;
      female: number;
      children: Map<string, { name: string; male: number; female: number }>;
    };
    const primaryMap = new Map<string, Acc>();

    const ensurePrimary = (id: string, name: string) => {
      let entry = primaryMap.get(id);
      if (!entry) {
        entry = { name, male: 0, female: 0, children: new Map() };
        primaryMap.set(id, entry);
      }
      return entry;
    };

    const ensureChild = (entry: Acc, id: string, name: string) => {
      let child = entry.children.get(id);
      if (!child) {
        child = { name, male: 0, female: 0 };
        entry.children.set(id, child);
      }
      return child;
    };

    for (const employee of employees) {
      const primaryDim = dimensionOf(employee, primary);
      const nestedDim = dimensionOf(employee, nested);
      const entry = ensurePrimary(primaryDim.id, primaryDim.name);
      const child = ensureChild(entry, nestedDim.id, nestedDim.name);
      const key = genderKey(employee.gender);
      entry[key] += 1;
      child[key] += 1;
    }

    const toSortedChildren = (children: Acc["children"]): DashboardGenderCountRow[] =>
      Array.from(children.entries())
        .map(([id, child]) => ({
          id,
          name: child.name,
          male: child.male,
          female: child.female,
          total: child.male + child.female,
        }))
        .filter((row) => row.total > 0)
        .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

    return Array.from(primaryMap.entries())
      .map(([id, entry]) => ({
        id,
        name: entry.name,
        male: entry.male,
        female: entry.female,
        total: entry.male + entry.female,
        children: toSortedChildren(entry.children),
      }))
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  };

  const genderCountsNested: DashboardGenderCountsNested = {
    employeeType: {
      byEligibility: buildNestedRows(activeEmployees, "employeeType", "eligibility"),
      bySupervisory: buildNestedRows(activeEmployees, "employeeType", "supervisory"),
      byOffice: buildNestedRows(activeEmployees, "employeeType", "office"),
    },
    eligibility: {
      byEmployeeType: buildNestedRows(activeEmployees, "eligibility", "employeeType"),
      bySupervisory: buildNestedRows(activeEmployees, "eligibility", "supervisory"),
      byOffice: buildNestedRows(activeEmployees, "eligibility", "office"),
    },
    supervisory: {
      byEmployeeType: buildNestedRows(activeEmployees, "supervisory", "employeeType"),
      byEligibility: buildNestedRows(activeEmployees, "supervisory", "eligibility"),
      byOffice: buildNestedRows(activeEmployees, "supervisory", "office"),
    },
    office: {
      byEmployeeType: buildNestedRows(activeEmployees, "office", "employeeType"),
      byEligibility: buildNestedRows(activeEmployees, "office", "eligibility"),
      bySupervisory: buildNestedRows(activeEmployees, "office", "supervisory"),
    },
  };

  const rawEligibilitySlices = buildOtherLimitedSlices(
    eligibilities
      .map((eligibility, index) => ({
        name: eligibility.name.trim() || "Unspecified",
        value: eligibilityCounts[eligibility.id] ?? 0,
        color: cleanHexColor(
          eligibility.value,
          FALLBACK_COLORS[(index + 2) % FALLBACK_COLORS.length],
        ),
      }))
      .sort((a, b) => b.value - a.value),
  );
  const eligibilitySlices = rawEligibilitySlices.map((slice, index) => ({
    ...slice,
    color:
      slice.name === "Others"
        ? "#94a3b8"
        : ELIGIBILITY_CHART_COLORS[index % ELIGIBILITY_CHART_COLORS.length],
  }));

  const birthdaysToday = activeEmployees.filter((employee) => {
    const monthDay = getMonthDayInTimeZone(employee.birthday);
    return (
      monthDay?.month === todayMonthDay?.month &&
      monthDay?.day === todayMonthDay?.day
    );
  }).length;

  const birthdaysThisMonth = activeEmployees.filter((employee) => {
    const monthDay = getMonthDayInTimeZone(employee.birthday);
    return monthDay?.month === currentMonth;
  }).length;

  const upcomingRetirements = activeEmployees.filter(isRetirementUpcomingThisYear).length;
  const upcomingLoyaltyMilestones = activeEmployees.reduce(
    (sum, employee) => sum + countUpcomingLoyaltyMilestones(employee.dateHired),
    0,
  );
  const incompleteFieldChecks = [
    {
      label: "Employee No.",
      isMissing: (employee: (typeof activeEmployees)[number]) => !employee.employeeNo.trim(),
    },
    {
      label: "Contact Number",
      isMissing: (employee: (typeof activeEmployees)[number]) => !employee.contactNumber.trim(),
    },
    {
      label: "Emergency Contact",
      isMissing: (employee: (typeof activeEmployees)[number]) =>
        !employee.emergencyContactName.trim() || !employee.emergencyContactNumber.trim(),
    },
    {
      label: "Public QR",
      isMissing: (employee: (typeof activeEmployees)[number]) => !employee.publicEnabled,
    },
    {
      label: "Salary Grade",
      isMissing: (employee: (typeof activeEmployees)[number]) =>
        employee.salaryGrade == null || employee.salaryGrade <= 0,
    },
  ];

  const incompleteRecordIds = new Set<string>();
  const missingFieldsByEmployee = new Map<string, string[]>();
  const incompleteFields = incompleteFieldChecks
    .map((field) => {
      const count = activeEmployees.filter((employee) => {
        const missing = field.isMissing(employee);
        if (missing) {
          incompleteRecordIds.add(employee.id);
          const current = missingFieldsByEmployee.get(employee.id) ?? [];
          current.push(field.label);
          missingFieldsByEmployee.set(employee.id, current);
        }
        return missing;
      }).length;
      return { label: field.label, count };
    })
    .filter((field) => field.count > 0)
    .sort((a, b) => b.count - a.count);

  const incompleteEmployees = activeEmployees
    .filter((employee) => missingFieldsByEmployee.has(employee.id))
    .sort((a, b) => {
      const aMissing = missingFieldsByEmployee.get(a.id)?.length ?? 0;
      const bMissing = missingFieldsByEmployee.get(b.id)?.length ?? 0;
      return bMissing - aMissing || a.lastName.localeCompare(b.lastName);
    })
    .map((employee) => {
      const missingFields = missingFieldsByEmployee.get(employee.id) ?? [];
      return {
        id: employee.id,
        title: fullNameFromParts(employee) || "Unnamed employee",
        subtitle: missingFields.join(", "),
        href: `/${departmentId}/employees/${employee.id}`,
        meta: `${missingFields.length} missing`,
      };
    });

  return {
    pendingApprovals,
    officeCount,
    birthdaysToday,
    birthdaysThisMonth,
    upcomingRetirements,
    upcomingLoyaltyMilestones,
    incompleteRecords: {
      count: incompleteRecordIds.size,
      fields: incompleteFields.slice(0, 3),
      employees: incompleteEmployees,
    },
    appointmentSlices,
    genderSlices,
    eligibilitySlices,
    genderCountsByEmployeeType,
    genderCountsByEligibility,
    genderCountsBySupervisory,
    genderCountsByOffice,
    genderCountsNested,
    plantilla: buildDashboardPlantillaSummary({
      offices: [],
      plantillaPositions,
      employees: plantillaEmployees,
    }),
  };
};
