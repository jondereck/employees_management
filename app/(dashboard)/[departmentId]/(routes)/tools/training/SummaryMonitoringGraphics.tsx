"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { TrainingSummaryResponse } from "@/lib/training-types";
import { TRAINING_INDICATORS } from "@/lib/training-types";
import { cn } from "@/lib/utils";

const numberFormatter = new Intl.NumberFormat("en-US");

const INDICATOR_COLORS: Record<string, string> = {
  "Technical Training": "#4f46e5",
  "Core Competency Training": "#0891b2",
  "Leadership Training": "#db2777",
  "Mandatory Training": "#d97706",
};

const COVERAGE_COLORS = {
  withTraining: "#16a34a",
  noTraining: "#64748b",
};

type SummaryMonitoringGraphicsProps = {
  summary: TrainingSummaryResponse;
  onIndicatorClick: (indicator: string) => void;
  onCoverageClick: (kind: "withTraining" | "noTraining") => void;
};

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{numberFormatter.format(value)}</p>
    </div>
  );
}

export function SummaryMonitoringGraphics({
  summary,
  onIndicatorClick,
  onCoverageClick,
}: SummaryMonitoringGraphicsProps) {
  const indicatorData = useMemo(
    () =>
      TRAINING_INDICATORS.map((indicator) => ({
        name: indicator,
        shortName: indicator.replace(/ Training$/, ""),
        value: summary.registry.byIndicator[indicator] ?? 0,
        color: INDICATOR_COLORS[indicator] ?? "#64748b",
      })).filter((d) => d.value > 0),
    [summary.registry.byIndicator]
  );

  const indicatorTotal = useMemo(() => indicatorData.reduce((sum, d) => sum + d.value, 0), [indicatorData]);

  const coverageData = useMemo(
    () => [
      {
        key: "withTraining" as const,
        name: "With training",
        value: summary.registry.employeesWithAtLeastOneTraining,
        fill: COVERAGE_COLORS.withTraining,
      },
      {
        key: "noTraining" as const,
        name: "No training",
        value: summary.registry.employeesWithNoTrainingIntervention,
        fill: COVERAGE_COLORS.noTraining,
      },
    ],
    [summary.registry.employeesWithAtLeastOneTraining, summary.registry.employeesWithNoTrainingIntervention]
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Eligible Employees" value={summary.totalActiveEmployees} />
        <KpiCard label="Total Trainings Conducted" value={summary.registry.totalTrainingsConducted} />
        <KpiCard label="Total Employees Trained" value={summary.registry.totalEmployeesTrained} />
        <KpiCard label="Total Training Hours" value={summary.registry.totalTrainingHoursCompleted} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold">Trainings by Indicator</h3>
            <p className="text-xs text-muted-foreground">Click a slice or legend item to open the record list</p>
          </div>
          {indicatorTotal > 0 ? (
            <div className="grid grid-cols-[140px_1fr] items-center gap-3">
              <div className="relative h-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={indicatorData}
                      dataKey="value"
                      nameKey="shortName"
                      innerRadius={42}
                      outerRadius={62}
                      paddingAngle={3}
                      stroke="rgba(255,255,255,0.8)"
                      strokeWidth={2}
                      cursor="pointer"
                      onClick={(_, index) => {
                        const row = indicatorData[index];
                        if (row) onIndicatorClick(row.name);
                      }}
                    >
                      {indicatorData.map((item) => (
                        <Cell key={item.name} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, _name, item) => [
                        numberFormatter.format(value),
                        (item?.payload as { name?: string } | undefined)?.name ?? "Trainings",
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold tabular-nums">{numberFormatter.format(indicatorTotal)}</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</span>
                </div>
              </div>
              <div className="space-y-2">
                {indicatorData.map((item) => {
                  const percent = Math.round((item.value / indicatorTotal) * 100);
                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => onIndicatorClick(item.name)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded px-1 py-0.5 text-left text-xs transition-colors hover:bg-muted"
                      )}
                      title={`View ${item.name} records`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="truncate text-muted-foreground">{item.shortName}</span>
                      </div>
                      <span className="font-semibold tabular-nums">
                        {numberFormatter.format(item.value)} · {percent}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex h-[140px] items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
              No indicator data
            </div>
          )}
        </div>

        <div className="rounded-lg border p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold">Employee Training Coverage</h3>
            <p className="text-xs text-muted-foreground">Click a bar to open the employee list</p>
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={coverageData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={40} />
                <Tooltip formatter={(value: number) => numberFormatter.format(value)} />
                <Bar
                  dataKey="value"
                  radius={[6, 6, 0, 0]}
                  cursor="pointer"
                  onClick={(data) => {
                    const key = (data as { key?: "withTraining" | "noTraining" })?.key;
                    if (key) onCoverageClick(key);
                  }}
                >
                  {coverageData.map((item) => (
                    <Cell key={item.key} fill={item.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {coverageData.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onCoverageClick(item.key)}
                className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-muted hover:text-foreground"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                {item.name}: <span className="font-semibold text-foreground">{numberFormatter.format(item.value)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
