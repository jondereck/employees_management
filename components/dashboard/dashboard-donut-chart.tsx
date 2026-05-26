"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import type { DashboardChartSlice } from "@/actions/get-dashboard-summary";

type DashboardDonutChartProps = {
  title: string;
  description: string;
  data: DashboardChartSlice[];
  compact?: boolean;
};

export function DashboardDonutChart({
  title,
  description,
  data,
  compact = false,
}: DashboardDonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const shellClass = compact
    ? "rounded-xl border border-white/20 bg-white/20 p-3 dark:border-white/10 dark:bg-white/[0.03]"
    : "rounded-2xl border border-white/30 bg-white/30 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]";

  return (
    <div className={shellClass}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>

      {total > 0 ? (
        <div className="mt-3 grid grid-cols-[120px_1fr] items-center gap-3">
          <div className="relative h-[120px] overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={38}
                  outerRadius={56}
                  paddingAngle={3}
                  stroke="rgba(255,255,255,0.7)"
                  strokeWidth={2}
                >
                  {data.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {total}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-slate-500">Total</span>
            </div>
          </div>

          <div className="space-y-2">
            {data.map((item) => {
              const percent = Math.round((item.value / total) * 100);
              return (
                <div key={item.name} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate text-slate-600 dark:text-slate-300">{item.name}</span>
                  </div>
                  <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {percent}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-3 flex h-[120px] items-center justify-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-500 dark:border-slate-700">
          No active data
        </div>
      )}
    </div>
  );
}
