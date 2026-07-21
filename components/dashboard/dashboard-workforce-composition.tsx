"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import type {
  DashboardChartSlice,
  DashboardGenderCountRow,
  DashboardGenderCountsNested,
} from "@/actions/get-dashboard-summary";
import { DashboardDonutChart } from "@/components/dashboard/dashboard-donut-chart";
import { DashboardGenderCounts } from "@/components/dashboard/dashboard-gender-counts";
import { cn } from "@/lib/utils";

type CompositionChart = "appointment" | "gender" | "eligibility";

type DashboardWorkforceCompositionProps = {
  appointmentSlices: DashboardChartSlice[];
  genderSlices: DashboardChartSlice[];
  eligibilitySlices: DashboardChartSlice[];
  genderCountsByEmployeeType: DashboardGenderCountRow[];
  genderCountsByEligibility: DashboardGenderCountRow[];
  genderCountsBySupervisory: DashboardGenderCountRow[];
  genderCountsByOffice: DashboardGenderCountRow[];
  genderCountsNested: DashboardGenderCountsNested;
};

const charts = [
  {
    key: "appointment" as const,
    label: "Appointment",
    title: "Appointment Type",
    description: "Active workforce mix",
  },
  {
    key: "gender" as const,
    label: "Gender",
    title: "Gender",
    description: "Active employee split",
  },
  {
    key: "eligibility" as const,
    label: "Eligibility",
    title: "Eligibility",
    description: "Top eligibility groups",
  },
];

export function DashboardWorkforceComposition({
  appointmentSlices,
  genderSlices,
  eligibilitySlices,
  genderCountsByEmployeeType,
  genderCountsByEligibility,
  genderCountsBySupervisory,
  genderCountsByOffice,
  genderCountsNested,
}: DashboardWorkforceCompositionProps) {
  const [activeChart, setActiveChart] =
    useState<CompositionChart>("appointment");
  const [detailsOpen, setDetailsOpen] = useState(false);

  const sliceMap: Record<CompositionChart, DashboardChartSlice[]> = {
    appointment: appointmentSlices,
    gender: genderSlices,
    eligibility: eligibilitySlices,
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl bg-slate-900/5 p-1 lg:hidden dark:bg-white/10">
        {charts.map((chart) => (
          <button
            key={chart.key}
            type="button"
            id={`composition-tab-${chart.key}`}
            aria-pressed={activeChart === chart.key}
            aria-controls={`composition-panel-${chart.key}`}
            onClick={() => setActiveChart(chart.key)}
            className={cn(
              "min-h-11 flex-1 rounded-lg px-3 text-xs font-medium transition",
              activeChart === chart.key
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200",
            )}
          >
            {chart.label}
          </button>
        ))}
      </div>

      <div className="mx-auto grid w-full gap-3 lg:grid-cols-3">
        {charts.map((chart) => (
          <div
            key={chart.key}
            id={`composition-panel-${chart.key}`}
            className={cn(activeChart !== chart.key && "hidden lg:block")}
          >
            <DashboardDonutChart
              title={chart.title}
              description={chart.description}
              data={sliceMap[chart.key]}
              compact
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-center rounded-xl border border-white/30 bg-white/35 px-3 text-sm font-medium text-slate-700 transition hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 lg:hidden dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 dark:hover:bg-white/[0.07]"
        aria-expanded={detailsOpen}
        aria-controls="workforce-gender-counts"
        onClick={() => setDetailsOpen((open) => !open)}
      >
        {detailsOpen ? "Hide detailed breakdown" : "View detailed breakdown"}
        <ChevronDown
          className={cn(
            "ml-2 h-4 w-4 transition-transform",
            detailsOpen && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      <div
        id="workforce-gender-counts"
        className={cn(!detailsOpen && "hidden lg:block")}
      >
        <DashboardGenderCounts
          byEmployeeType={genderCountsByEmployeeType}
          byEligibility={genderCountsByEligibility}
          bySupervisory={genderCountsBySupervisory}
          byOffice={genderCountsByOffice}
          nested={genderCountsNested}
        />
      </div>
    </div>
  );
}
