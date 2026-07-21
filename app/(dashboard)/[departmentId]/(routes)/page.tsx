import {
  AlertCircle,
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  Cake,
  Clock3,
  FileWarning,
  Medal,
  Users,
} from "lucide-react";

import { getDashboardSummary } from "@/actions/get-dashboard-summary";
import { getDepartmentDataLastActivity } from "@/actions/get-department-data-last-activity";
import { getGraph } from "@/actions/get-graph";
import { getHeadcountTrend } from "@/actions/get-headcount-trend";
import { getMonthlyEmployeeActivity } from "@/actions/get-monthly-employee-activity";
import { getTotalEmployees } from "@/actions/get-total-employee";
import { AnimatedNumber } from "@/components/animated-number";
import { DashboardAnalyticsTabs } from "@/components/dashboard/dashboard-analytics-tabs";
import { DashboardClock } from "@/components/dashboard/dashboard-clock";
import { DashboardDataFreshness } from "@/components/dashboard/dashboard-data-freshness";
import { DashboardWorkforceComposition } from "@/components/dashboard/dashboard-workforce-composition";
import {
  DashboardNavLink,
  DashboardNavProvider,
} from "@/components/dashboard/dashboard-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getCurrentMonthIndexInTimeZone } from "@/lib/birthday";
import { cn } from "@/lib/utils";

interface DashboardProps {
  params: { departmentId: string };
}

const glassCard =
  "border border-white/30 bg-white/40 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]";

const DashboardPage = async ({ params }: DashboardProps) => {
  const { departmentId } = params;
  const birthdayMonth = getCurrentMonthIndexInTimeZone();

  const [
    totalEmployee,
    graphEmployee,
    monthlyActivity,
    headcountTrend,
    dashboardSummary,
    dataLastActivityAt,
  ] = await Promise.all([
    getTotalEmployees(departmentId),
    getGraph(departmentId),
    getMonthlyEmployeeActivity(departmentId),
    getHeadcountTrend(departmentId),
    getDashboardSummary(departmentId),
    getDepartmentDataLastActivity(departmentId),
  ]);

  const attentionItems = [
    {
      label: "Pending approvals",
      value: dashboardSummary.pendingApprovals,
      href: `/${departmentId}/approvals`,
      icon: AlertCircle,
      tone: "text-amber-600 bg-amber-500/10 ring-amber-500/20",
    },
    {
      label: "Birthdays today",
      value: dashboardSummary.birthdaysToday,
      href: `/${departmentId}/birthdays?month=${birthdayMonth}`,
      icon: Cake,
      tone: "text-pink-600 bg-pink-500/10 ring-pink-500/20",
    },
    {
      label: "Birthdays this month",
      value: dashboardSummary.birthdaysThisMonth,
      href: `/${departmentId}/birthdays?month=${birthdayMonth}`,
      icon: CalendarDays,
      tone: "text-blue-600 bg-blue-500/10 ring-blue-500/20",
    },
    {
      label: "Upcoming retirements",
      value: dashboardSummary.upcomingRetirements,
      href: `/${departmentId}/retirements`,
      icon: Clock3,
      tone: "text-slate-700 bg-slate-500/10 ring-slate-500/20 dark:text-slate-200",
    },
    {
      label: "Loyalty milestones",
      value: dashboardSummary.upcomingLoyaltyMilestones,
      href: `/${departmentId}/anniversaries`,
      icon: Medal,
      tone: "text-emerald-600 bg-emerald-500/10 ring-emerald-500/20",
    },
  ];

  const incompleteEmployeePreview =
    dashboardSummary.incompleteRecords.employees.slice(0, 6);

  return (
    <DashboardNavProvider>
    <div className="flex-col">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 p-4 pt-6 dark:from-slate-950 dark:to-slate-900 lg:p-6">
        <div className="mx-auto max-w-[1600px] space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Dashboard
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Compact overview of employees, approvals, and HR reminders
              </p>
              <DashboardDataFreshness updatedAt={dataLastActivityAt} />
            </div>
            <DashboardClock />
          </div>

          <Separator className="bg-white/30 dark:bg-white/10" />

          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <MetricCard
              title="Total Employees"
              value={totalEmployee}
              icon={Users}
              href={`/${departmentId}/employees`}
              borderTone="border-blue-400/80 dark:border-blue-500/50"
              tone="text-blue-600 bg-blue-500/10 ring-blue-500/20"
            >
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Current active employee records.
              </p>
            </MetricCard>
            <MetricCard
              title="Active This Month"
              value={monthlyActivity.currentCount}
              icon={Bell}
              borderTone="border-emerald-400/80 dark:border-emerald-500/50"
              tone="text-emerald-600 bg-emerald-500/10 ring-emerald-500/20"
            >
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Created or updated employee records.
              </p>
            </MetricCard>
            <PlantillaMetricCard
              departmentId={departmentId}
              {...dashboardSummary.plantilla}
            />
            <MetricCard
              title="Offices"
              value={dashboardSummary.officeCount}
              icon={Building2}
              href={`/${departmentId}/offices`}
              borderTone="border-cyan-400/80 dark:border-cyan-500/50"
              tone="text-cyan-600 bg-cyan-500/10 ring-cyan-500/20"
            >
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Active department office records.
              </p>
            </MetricCard>
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-[1.5fr_0.85fr] xl:gap-6">
            <Card className={`${glassCard} min-w-0 h-full rounded-2xl`}>
              <CardHeader className="p-4 pb-3">
                <CardTitle className="text-base text-slate-900 dark:text-slate-100">
                  Workforce Composition
                </CardTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Appointment type, gender, and eligibility breakdown.
                </p>
              </CardHeader>
              <CardContent className="space-y-4 p-4 pt-8">
                <DashboardWorkforceComposition
                  appointmentSlices={dashboardSummary.appointmentSlices}
                  genderSlices={dashboardSummary.genderSlices}
                  eligibilitySlices={dashboardSummary.eligibilitySlices}
                  genderCountsByEmployeeType={
                    dashboardSummary.genderCountsByEmployeeType
                  }
                  genderCountsByEligibility={
                    dashboardSummary.genderCountsByEligibility
                  }
                  genderCountsBySupervisory={
                    dashboardSummary.genderCountsBySupervisory
                  }
                  genderCountsByOffice={dashboardSummary.genderCountsByOffice}
                  genderCountsNested={dashboardSummary.genderCountsNested}
                />
              </CardContent>
            </Card>

            <div
              data-dashboard-right-rail
              className="grid min-w-0 content-start gap-4"
            >
              <Card className={`${glassCard} min-w-0 h-full rounded-2xl`}>
                <CardHeader className="p-4 pb-3">
                  <CardTitle className="text-base text-slate-900 dark:text-slate-100">
                    Needs Attention
                  </CardTitle>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Quick HR reminders for the current cycle.
                  </p>
                </CardHeader>
                <CardContent className="space-y-2 p-4 pt-0">
                  {attentionItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <DashboardNavLink
                        key={item.label}
                        href={item.href}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/30 bg-white/35 px-3 py-2.5 transition hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.07]"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${item.tone}`}>
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                            {item.label}
                          </span>
                        </div>
                        <span className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
                          {item.value}
                        </span>
                      </DashboardNavLink>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className={`${glassCard} min-w-0 h-full rounded-2xl`}>
                <CardHeader className="p-4 pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base text-slate-900 dark:text-slate-100">
                        Incomplete Records
                      </CardTitle>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Data cleanup items to review.
                      </p>
                    </div>
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 ring-1 ring-rose-500/20">
                      <FileWarning className="h-5 w-5" aria-hidden="true" />
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <DashboardNavLink
                    href={`/${departmentId}/employees`}
                    className="block w-full rounded-xl border border-white/30 bg-white/35 p-3 transition hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.07]"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
                      <div className="min-w-0">
                        <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                          {dashboardSummary.incompleteRecords.count}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          employees with missing key data
                        </p>
                      </div>
                      <span className="self-start text-xs font-semibold text-emerald-700 sm:self-auto dark:text-emerald-300">
                        Review
                      </span>
                    </div>
                  </DashboardNavLink>
                  <div className="mt-3 space-y-2">
                    {dashboardSummary.incompleteRecords.fields.length ? (
                      dashboardSummary.incompleteRecords.fields.map((field) => (
                        <div
                          key={field.label}
                          className="flex items-center justify-between gap-3 text-xs"
                        >
                          <span className="truncate text-slate-600 dark:text-slate-300">
                            {field.label}
                          </span>
                          <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                            {field.count}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        No missing key data detected.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className={`${glassCard} min-w-0 rounded-2xl`}>
            <CardHeader className="p-4 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base text-slate-900 dark:text-slate-100">
                    Employees With Missing Data
                  </CardTitle>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Preview of records with missing key fields.
                  </p>
                </div>
                <DashboardNavLink
                  href={`/${departmentId}/employees`}
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-emerald-300"
                >
                  View all {dashboardSummary.incompleteRecords.count}
                </DashboardNavLink>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {incompleteEmployeePreview.length ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {incompleteEmployeePreview.map((employee, index) => (
                    <DashboardNavLink
                      key={employee.id}
                      href={employee.href}
                      className={cn(
                        "flex w-full flex-col gap-2 rounded-xl border border-white/30 bg-white/35 px-3 py-2.5 transition hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:flex-row sm:items-center sm:justify-between sm:gap-3 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.07]",
                        index >= 4 && "hidden sm:flex",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {employee.title}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          Missing: {employee.subtitle}
                        </p>
                      </div>
                      {employee.meta ? (
                        <span className="shrink-0 self-start rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-700 sm:self-auto dark:text-rose-300">
                          {employee.meta}
                        </span>
                      ) : null}
                    </DashboardNavLink>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[136px] items-center justify-center rounded-xl border border-dashed border-slate-300 px-3 text-center text-sm text-slate-500 dark:border-slate-700">
                  No incomplete employee records detected.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={`${glassCard} rounded-2xl`}>
            <CardContent className="p-4">
              <DashboardAnalyticsTabs
                monthlyData={graphEmployee}
                trendData={headcountTrend.data}
                trendSeries={headcountTrend.series}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </DashboardNavProvider>
  );
};

type PlantillaMetricCardProps = {
  departmentId: string;
  total: number;
  filled: number;
  vacant: number;
  occupancyRate: number;
};

function PlantillaMetricCard({
  departmentId,
  total,
  filled,
  vacant,
  occupancyRate,
}: PlantillaMetricCardProps) {
  const formattedOccupancy = `${occupancyRate.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}%`;

  return (
    <DashboardNavLink
      href={`/${departmentId}/offices`}
      className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
    >
      <Card
        className={`${glassCard} group relative h-full overflow-hidden rounded-2xl border-violet-400/80 transition hover:bg-white/60 dark:border-violet-500/50 dark:hover:bg-white/[0.07]`}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/30 to-transparent dark:from-white/[0.04]" />
        <CardHeader className="relative z-10 flex flex-row items-center justify-between space-y-0 p-3 pb-1.5 sm:p-4 sm:pb-2">
          <CardTitle className="text-xs font-semibold text-slate-700 dark:text-slate-200 sm:text-sm">
            Plantilla
          </CardTitle>
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 ring-1 ring-violet-500/20 dark:text-violet-300 sm:h-10 sm:w-10">
            <Briefcase className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
          </span>
        </CardHeader>
        <CardContent className="relative z-10 p-3 pt-0 sm:p-4 sm:pt-0">
          <div className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums dark:text-slate-100">
            <AnimatedNumber value={total} />
          </div>

          <div className="mt-2 flex items-start gap-5">
            <div>
              <AnimatedNumber
                value={filled}
                className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400"
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Filled</p>
            </div>
            <div>
              <AnimatedNumber
                value={vacant}
                className="text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400"
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Vacant</p>
            </div>
          </div>

          <div
            role="progressbar"
            aria-label={`Plantilla occupancy ${formattedOccupancy}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={occupancyRate}
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300"
              style={{ width: `${occupancyRate}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
            <span>Occupancy</span>
            <span className="font-medium tabular-nums text-slate-700 dark:text-slate-200">
              {formattedOccupancy}
            </span>
          </div>
        </CardContent>
      </Card>
    </DashboardNavLink>
  );
}

type MetricCardProps = {
  title: string;
  value: number;
  icon: typeof Users;
  tone: string;
  borderTone: string;
  href?: string;
  children: React.ReactNode;
};

function MetricCard({
  title,
  value,
  icon: Icon,
  tone,
  borderTone,
  href,
  children,
}: MetricCardProps) {
  const content = (
    <Card className={`${glassCard} group relative h-full overflow-hidden rounded-2xl ${borderTone} transition hover:bg-white/60 dark:hover:bg-white/[0.07]`}>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/30 to-transparent dark:from-white/[0.04]" />
      <CardHeader className="relative z-10 flex flex-row items-center justify-between space-y-0 p-3 pb-1.5 sm:p-4 sm:pb-2">
        <CardTitle className="text-xs font-semibold text-slate-600 dark:text-slate-300 sm:text-sm">
          {title}
        </CardTitle>
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ring-1 sm:h-10 sm:w-10 ${tone}`}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
        </span>
      </CardHeader>
      <CardContent className="relative z-10 p-3 pt-0 sm:p-4 sm:pt-0">
        <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          <AnimatedNumber value={value} />
        </div>
        <div className="mt-1 min-h-[18px]">{children}</div>
      </CardContent>
    </Card>
  );

  if (!href) return content;

  return (
    <DashboardNavLink
      href={href}
      className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
    >
      {content}
    </DashboardNavLink>
  );
}

export default DashboardPage;
