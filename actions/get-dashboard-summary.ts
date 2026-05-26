import prismadb from "@/lib/prismadb";
import {
  getCurrentMonthIndexInTimeZone,
  getCurrentYearInTimeZone,
  getMonthDayInTimeZone,
} from "@/lib/birthday";

export type DashboardChartSlice = {
  name: string;
  value: number;
  color: string;
};

export type DashboardSummary = {
  pendingApprovals: number;
  officeCount: number;
  birthdaysToday: number;
  birthdaysThisMonth: number;
  upcomingRetirements: number;
  upcomingLoyaltyMilestones: number;
  appointmentSlices: DashboardChartSlice[];
  genderSlices: DashboardChartSlice[];
  eligibilitySlices: DashboardChartSlice[];
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
    employeeTypes,
    eligibilities,
    activeEmployees,
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
      select: { birthday: true, dateHired: true },
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

  const eligibilitySlices = buildOtherLimitedSlices(
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

  return {
    pendingApprovals,
    officeCount,
    birthdaysToday,
    birthdaysThisMonth,
    upcomingRetirements,
    upcomingLoyaltyMilestones,
    appointmentSlices,
    genderSlices,
    eligibilitySlices,
  };
};
