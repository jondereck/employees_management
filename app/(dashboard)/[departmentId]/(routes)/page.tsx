import Link from "next/link";
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
  ShieldCheck,
  Users,
} from "lucide-react";

import { getDashboardSummary } from "@/actions/get-dashboard-summary";
import { getGraph } from "@/actions/get-graph";
import { getHeadcountTrend } from "@/actions/get-headcount-trend";
import { getMonthlyEmployeeActivity } from "@/actions/get-monthly-employee-activity";
import { getTotalEmployees } from "@/actions/get-total-employee";
import { AnimatedNumber } from "@/components/animated-number";
import { DashboardAnalyticsTabs } from "@/components/dashboard/dashboard-analytics-tabs";
import { DashboardClock } from "@/components/dashboard/dashboard-clock";
import { DashboardDonutChart } from "@/components/dashboard/dashboard-donut-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getCurrentMonthIndexInTimeZone } from "@/lib/birthday";

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
  ] = await Promise.all([
    getTotalEmployees(departmentId),
    getGraph(departmentId),
    getMonthlyEmployeeActivity(departmentId),
    getHeadcountTrend(departmentId),
    getDashboardSummary(departmentId),
  ]);

  const appointmentTotal = dashboardSummary.appointmentSlices.reduce(
    (sum, item) => sum + item.value,
    0,
  );

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

  return (
    <div className="flex-col">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 p-4 pt-6 dark:from-slate-950 dark:to-slate-900 lg:p-6">
        <div className="mx-auto max-w-[1600px] space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Dashboard
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Compact overview of employees, approvals, and HR reminders
              </p>
            </div>
            <DashboardClock />
          </div>

          <Separator className="bg-white/30 dark:bg-white/10" />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Total Employees"
              value={totalEmployee}
              icon={Users}
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
              tone="text-emerald-600 bg-emerald-500/10 ring-emerald-500/20"
            >
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Created or updated employee records.
              </p>
            </MetricCard>
            <MetricCard
              title="Pending Approvals"
              value={dashboardSummary.pendingApprovals}
              icon={ShieldCheck}
              href={`/${departmentId}/approvals`}
              tone="text-amber-600 bg-amber-500/10 ring-amber-500/20"
            >
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Change requests waiting for review.
              </p>
            </MetricCard>
            <MetricCard
              title="Offices"
              value={dashboardSummary.officeCount}
              icon={Building2}
              href={`/${departmentId}/offices`}
              tone="text-cyan-600 bg-cyan-500/10 ring-cyan-500/20"
            >
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Active department office records.
              </p>
            </MetricCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className={`${glassCard} rounded-2xl`}>
              <CardHeader className="p-4 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base text-slate-900 dark:text-slate-100">
                      Appointment Distribution
                    </CardTitle>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Zero-count appointment types are hidden.
                    </p>
                  </div>
                  <Briefcase className="h-5 w-5 text-slate-400" aria-hidden="true" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-0">
                {dashboardSummary.appointmentSlices.length ? (
                  dashboardSummary.appointmentSlices.map((item) => {
                    const percent = appointmentTotal
                      ? Math.round((item.value / appointmentTotal) * 100)
                      : 0;
                    return (
                      <div key={item.name} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                              {item.name}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                            <span className="tabular-nums">{item.value}</span>
                            <span className="text-xs text-slate-500">{percent}%</span>
                          </div>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/50 dark:bg-white/10">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${percent}%`, backgroundColor: item.color }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">
                    No active appointment data found.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className={`${glassCard} rounded-2xl`}>
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
                    <Link
                      key={item.label}
                      href={item.href}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/30 bg-white/35 px-3 py-2.5 transition hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.07]"
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
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className={`${glassCard} rounded-2xl`}>
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
                <Link
                  href={`/${departmentId}/employees`}
                  className="block rounded-xl border border-white/30 bg-white/35 p-3 transition hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.07]"
                >
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                        {dashboardSummary.incompleteRecords.count}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        employees with missing key data
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      Review
                    </span>
                  </div>
                </Link>
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

            <Card className={`${glassCard} rounded-2xl`}>
              <CardHeader className="p-4 pb-3">
                <CardTitle className="text-base text-slate-900 dark:text-slate-100">
                  Employees With Missing Data
                </CardTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  All records with missing key fields.
                </p>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {dashboardSummary.incompleteRecords.employees.length ? (
                  <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                    {dashboardSummary.incompleteRecords.employees.map((employee) => (
                      <Link
                        key={employee.id}
                        href={employee.href}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/30 bg-white/35 px-3 py-2.5 transition hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.07]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {employee.title}
                          </p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            Missing: {employee.subtitle}
                          </p>
                        </div>
                        {employee.meta ? (
                          <span className="shrink-0 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300">
                            {employee.meta}
                          </span>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-[136px] items-center justify-center rounded-xl border border-dashed border-slate-300 px-3 text-center text-sm text-slate-500 dark:border-slate-700">
                    No incomplete employee records detected.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <DashboardDonutChart
              title="Appointment Type"
              description="Active workforce mix"
              data={dashboardSummary.appointmentSlices}
            />
            <DashboardDonutChart
              title="Gender"
              description="Active employee split"
              data={dashboardSummary.genderSlices}
            />
            <DashboardDonutChart
              title="Eligibility"
              description="Top eligibility groups"
              data={dashboardSummary.eligibilitySlices}
            />
          </div>

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
  );
};

type MetricCardProps = {
  title: string;
  value: number;
  icon: typeof Users;
  tone: string;
  href?: string;
  children: React.ReactNode;
};

function MetricCard({
  title,
  value,
  icon: Icon,
  tone,
  href,
  children,
}: MetricCardProps) {
  const content = (
    <Card className={`${glassCard} group relative overflow-hidden rounded-2xl transition hover:bg-white/60 dark:hover:bg-white/[0.07]`}>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/30 to-transparent dark:from-white/[0.04]" />
      <CardHeader className="relative z-10 flex flex-row items-center justify-between space-y-0 p-4 pb-2">
        <CardTitle className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          {title}
        </CardTitle>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${tone}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </CardHeader>
      <CardContent className="relative z-10 p-4 pt-0">
        <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          <AnimatedNumber value={value} />
        </div>
        <div className="mt-1 min-h-[18px]">{children}</div>
      </CardContent>
    </Card>
  );

  if (!href) return content;

  return (
    <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
      {content}
    </Link>
  );
}

export default DashboardPage;
