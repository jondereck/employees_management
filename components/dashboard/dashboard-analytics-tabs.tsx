"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { HeadcountTrendPoint } from "@/actions/get-headcount-trend";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type MonthlyPoint = {
  name: string;
  total: number;
};

type DashboardAnalyticsTabsProps = {
  monthlyData: MonthlyPoint[];
  trendData: HeadcountTrendPoint[];
  trendSeries: string[];
};

const COLORS = ["#2563eb", "#16a34a", "#db2777", "#f59e0b", "#0891b2", "#7c3aed"];

export function DashboardAnalyticsTabs({
  monthlyData,
  trendData,
  trendSeries,
}: DashboardAnalyticsTabsProps) {
  return (
    <Tabs defaultValue="monthly" className="w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Workforce Analytics
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            One compact chart at a time
          </p>
        </div>
        <TabsList className="h-9 self-start rounded-xl bg-slate-900/5 p-1 dark:bg-white/10">
          <TabsTrigger value="monthly" className="h-7 rounded-lg px-3 text-xs">
            Monthly Adds
          </TabsTrigger>
          <TabsTrigger value="trend" className="h-7 rounded-lg px-3 text-xs">
            Headcount Type
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="monthly" className="mt-4">
        {monthlyData.length ? (
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={monthlyData} margin={{ top: 10, right: 18, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="currentColor" opacity={0.08} strokeDasharray="4 4" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid rgba(148, 163, 184, 0.25)",
                  boxShadow: "0 12px 24px rgba(15, 23, 42, 0.12)",
                }}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#2563eb"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState label="No monthly employee activity found." />
        )}
      </TabsContent>

      <TabsContent value="trend" className="mt-4">
        {trendData.length && trendSeries.length ? (
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={trendData} margin={{ top: 10, right: 18, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="currentColor" opacity={0.08} strokeDasharray="4 4" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid rgba(148, 163, 184, 0.25)",
                  boxShadow: "0 12px 24px rgba(15, 23, 42, 0.12)",
                }}
              />
              {trendSeries.map((key, index) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stackId="total"
                  stroke={COLORS[index % COLORS.length]}
                  fill={COLORS[index % COLORS.length]}
                  fillOpacity={0.18}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState label="No headcount trend data found." />
        )}
      </TabsContent>
    </Tabs>
  );
}

function EmptyChartState({ label }: { label: string }) {
  return (
    <div className="flex h-[230px] items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-500 dark:border-slate-700">
      {label}
    </div>
  );
}
