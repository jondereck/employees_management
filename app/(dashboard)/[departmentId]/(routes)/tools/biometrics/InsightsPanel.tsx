"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveAs } from "file-saver";
import { toPng } from "html-to-image";
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  Download,
  FileImage,
  LayoutGrid,
  RefreshCcw,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  LineChart,
  Line,
  Brush,
  ScatterChart,
  Scatter,
  ReferenceLine,
  Cell,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useSummaryFilters } from "@/hooks/use-summary-filters";

import type { PerDayRow, PerEmployeeRow } from "@/utils/parseBioAttendance";
import {
  UNASSIGNED_OFFICE_LABEL,
  UNKNOWN_OFFICE_LABEL,
  UNMATCHED_LABEL,
} from "@/utils/biometricsShared";
import {
  ALL_CHART_IDS,
  DEFAULT_VISIBLE_CHARTS,
  type ChartId,
  type MetricMode,
} from "./insights-types";

const MAX_LEADERBOARD_ITEMS = 20;
const MAX_ARRIVAL_GROUPS = 12;
const MAX_SCATTER_POINTS = 800;
const MAX_TOP_EMPLOYEES = 12;
const MINUTES_IN_DAY = 24 * 60;
const HEATMAP_ROW_HEIGHT = 44;
const HEATMAP_BUFFER_ROWS = 4;
const HEATMAP_MAX_HEIGHT = 360;
const MIN_SCATTER_SPAN = 60;
const SCATTER_PADDING_MIN = 30;

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const CHART_LABELS: Record<ChartId, string> = {
  "office-leaderboard": "Office Leaderboard",
  "arrival-distribution": "Arrival Distribution",
  "calendar-heatmap": "Daily Calendar Heatmap",
  "top-late-ut": "Top Late / Undertime",
  "trend-lines": "Trend Lines",
  "first-last-scatter": "First-in vs Last-out",
};

const CHART_DESCRIPTIONS: Partial<Record<ChartId, string>> = {
  "office-leaderboard": "Compare late and undertime percentages across offices.",
  "arrival-distribution": "Visualize arrival spread (median and IQR) per office.",
  "calendar-heatmap": "Daily lateness or undertime intensity by office.",
  "top-late-ut": "Employees with the highest late/undertime impact.",
  "trend-lines": "Daily trend of late and undertime percentages.",
  "first-last-scatter": "Earliest vs latest punch distribution per day.",
};

type ChartCardProps = {
  id: ChartId;
  title: string;
  description?: string;
  hasData: boolean;
  onExportCsv: () => void;
  onExportPng: () => Promise<void> | void;
  onReset?: () => void;
  resetDisabled?: boolean;
  children: React.ReactNode;
};

type ArrivalStat = {
  office: string;
  count: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
};

type HeatmapCell = {
  office: string;
  values: number[];
  totals: {
    lateDays: number;
    utDays: number;
    lateMinutes: number;
    utMinutes: number;
  };
};

type TopEmployee = {
  key: string;
  row: PerEmployeeRow;
  score: number;
  sparkline: Array<{
    date: string;
    late: boolean;
    undertime: boolean;
  }>;
};

type TrendPoint = {
  date: string;
  label: string;
  lateDaysPercent: number;
  utDaysPercent: number;
  lateMinutesPercent: number | null;
  utMinutesPercent: number | null;
  lateDaysMA: number | null;
  utDaysMA: number | null;
  lateMinutesMA: number | null;
  utMinutesMA: number | null;
  lateCount: number;
  utCount: number;
  daysEvaluated: number;
};

type ScatterPoint = {
  employee: string;
  office: string;
  earliest: number;
  latest: number;
  late: boolean;
  undertime: boolean;
};

type InsightsPanelProps = {
  collapsed: boolean;
  onCollapsedChange: (next: boolean) => void;
  visibleCharts: ChartId[];
  onVisibleChartsChange: (value: ChartId[] | ((prev: ChartId[]) => ChartId[])) => void;
  perEmployee: PerEmployeeRow[];
  perDay: PerDayRow[];
  filteredPerEmployee: PerEmployeeRow[];
  filteredPerDay: PerDayRow[];
};

const escapeCsvValue = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const downloadCsv = (filename: string, headers: string[], rows: Array<Array<string | number | null>>) => {
  const csv = [headers.map(escapeCsvValue).join(","), ...rows.map((row) => row.map(escapeCsvValue).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  saveAs(blob, filename);
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const exportNodeAsPng = async (node: HTMLElement | null, filename: string) => {
  if (!node || typeof window === "undefined") return;
  const dataUrl = await toPng(node, { cacheBust: true, backgroundColor: "#ffffff", pixelRatio: 2 });
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  saveAs(blob, filename);
};

const toMinuteOfDay = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const [hh, mm] = value.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
};

const formatMinutes = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const minutes = Math.max(0, Math.round(value));
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

const minuteToTimeLabel = (value: number) => {
  const normalized = ((value % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const quantile = (values: number[], percentile: number): number => {
  if (!values.length) return 0;
  if (values.length === 1) return values[0];
  const index = (values.length - 1) * percentile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return values[lower];
  const weight = index - lower;
  return values[lower] * (1 - weight) + values[upper] * weight;
};

const resolveOfficeLabel = (row: { officeName?: string | null; resolvedEmployeeId?: string | null; identityStatus?: string }) => {
  if (row.officeName && row.officeName.trim().length) return row.officeName.trim();
  if (row.identityStatus === "unmatched") return UNKNOWN_OFFICE_LABEL;
  if (row.resolvedEmployeeId) return UNASSIGNED_OFFICE_LABEL;
  return UNKNOWN_OFFICE_LABEL;
};

const resolveEmployeeKey = (row: { employeeToken?: string | null; employeeId?: string | null; employeeName?: string | null }) =>
  (row.employeeToken || row.employeeId || row.employeeName || "").trim();

const resolveLateMinutes = (
  row: Pick<PerDayRow, "lateMinutes" | "earliest" | "scheduleStart" | "scheduleGraceMinutes">
): number | null => {
  if (typeof row.lateMinutes === "number") return row.lateMinutes;
  const earliest = toMinuteOfDay(row.earliest ?? null);
  const start = toMinuteOfDay(row.scheduleStart ?? null);
  if (earliest == null || start == null) return null;
  const grace = row.scheduleGraceMinutes ?? 0;
  return Math.max(0, earliest - (start + grace));
};

const resolveUndertimeMinutes = (
  row: Pick<PerDayRow, "undertimeMinutes" | "requiredMinutes" | "workedMinutes">
): number | null => {
  if (typeof row.undertimeMinutes === "number") return row.undertimeMinutes;
  if (row.requiredMinutes == null) return null;
  if (typeof row.workedMinutes === "number") {
    return Math.max(0, row.requiredMinutes - row.workedMinutes);
  }
  return row.requiredMinutes;
};

const formatPercent = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
};

const metricLabel = (mode: MetricMode) => (mode === "minutes" ? "Minutes" : "Days");

const sparklineColor = (late: boolean, undertime: boolean) => {
  if (late && undertime) return "bg-amber-600";
  if (late) return "bg-orange-500";
  if (undertime) return "bg-sky-500";
  return "bg-muted";
};

const chartIsVisible = (chartId: ChartId, visible: Set<ChartId>) => visible.has(chartId);

function ChartCard({
  id,
  title,
  description,
  hasData,
  onExportCsv,
  onExportPng,
  onReset,
  resetDisabled,
  children,
}: ChartCardProps) {
  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-3 rounded-xl border bg-background p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 id={`${id}-heading`} className="text-base font-semibold">
              {title}
            </h3>
            {!hasData ? (
              <Badge variant="outline" className="text-xs uppercase tracking-wide">
                No data
              </Badge>
            ) : null}
          </div>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onExportCsv} disabled={!hasData}>
            <Download className="mr-2 h-4 w-4" aria-hidden="true" /> CSV
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onExportPng} disabled={!hasData}>
            <FileImage className="mr-2 h-4 w-4" aria-hidden="true" /> PNG
          </Button>
          {onReset ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onReset}
              disabled={resetDisabled || !hasData}
            >
              <RefreshCcw className="mr-2 h-4 w-4" aria-hidden="true" /> Reset
            </Button>
          ) : null}
        </div>
      </div>
      <div
        className={cn(
          "min-h-[200px] w-full",
          !hasData && "flex items-center justify-center text-sm text-muted-foreground"
        )}
      >
        {hasData ? children : "Not enough data for this chart."}
      </div>
    </section>
  );
}

export default function InsightsPanel({
  collapsed,
  onCollapsedChange,
  visibleCharts,
  onVisibleChartsChange,
  perEmployee,
  perDay,
  filteredPerEmployee,
  filteredPerDay,
}: InsightsPanelProps) {
  const { filters } = useSummaryFilters();
  const { metricMode } = filters;
  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];
    const trimmedSearch = filters.search.trim();
    if (trimmedSearch.length) {
      chips.push(`Search: “${trimmedSearch}”`);
    }
    if (filters.heads === "heads") {
      chips.push("Heads only");
    } else if (filters.heads === "nonHeads") {
      chips.push("Exclude heads");
    }
    if (filters.offices.length) {
      chips.push(`Offices (${filters.offices.length})`);
    }
    if (filters.schedules.length) {
      chips.push(`Schedules (${filters.schedules.length})`);
    }
    if (!filters.showUnmatched) {
      chips.push("Unmatched hidden");
    }
    if (filters.showNoPunch) {
      chips.push("No-punch column");
    }
    chips.push(filters.metricMode === "minutes" ? "Minutes view" : "Days % view");
    return chips;
  }, [filters]);
  const visibleChartSet = useMemo(() => new Set(visibleCharts), [visibleCharts]);
  const filteredEmployeeCount = filteredPerEmployee.length;
  const filteredDayCount = filteredPerDay.length;

  const toggleCollapsed = useCallback(() => {
    onCollapsedChange(!collapsed);
  }, [collapsed, onCollapsedChange]);

  const handleChartToggle = useCallback(
    (chartId: ChartId, next: boolean) => {
      onVisibleChartsChange((prev) => {
        const baseline = prev?.length ? prev : [...DEFAULT_VISIBLE_CHARTS];
        const set = new Set(baseline);
        if (next) {
          set.add(chartId);
        } else {
          set.delete(chartId);
        }
        if (!set.size) {
          return [chartId];
        }
        return Array.from(set);
      });
    },
    [onVisibleChartsChange]
  );

  const handleShowAllCharts = useCallback(() => {
    onVisibleChartsChange([...DEFAULT_VISIBLE_CHARTS]);
  }, [onVisibleChartsChange]);

  const officeLeaderboardData = useMemo(() => {
    if (!filteredPerEmployee.length)
      return [] as Array<{
        office: string;
        key: string;
        days: number;
        lateDays: number;
        utDays: number;
        latePercentDays: number;
        utPercentDays: number;
        latePercentMinutes: number | null;
        utPercentMinutes: number | null;
        totalLateMinutes: number;
        totalUndertimeMinutes: number;
        totalRequiredMinutes: number;
      }>;
    const map = new Map<
      string,
      {
        office: string;
        key: string;
        days: number;
        lateDays: number;
        utDays: number;
        lateMinutes: number;
        utMinutes: number;
        requiredMinutes: number;
      }
    >();
    for (const row of filteredPerEmployee) {
      const office = resolveOfficeLabel(row);
      const key = row.officeId ?? office;
      const entry = map.get(key) ?? {
        office,
        key,
        days: 0,
        lateDays: 0,
        utDays: 0,
        lateMinutes: 0,
        utMinutes: 0,
        requiredMinutes: 0,
      };
      entry.days += row.daysWithLogs;
      entry.lateDays += row.lateDays;
      entry.utDays += row.undertimeDays;
      entry.lateMinutes += row.totalLateMinutes ?? 0;
      entry.utMinutes += row.totalUndertimeMinutes ?? 0;
      entry.requiredMinutes += row.totalRequiredMinutes ?? 0;
      map.set(key, entry);
    }
    const results = Array.from(map.values()).map((entry) => {
      const latePercentDays = entry.days ? (entry.lateDays / entry.days) * 100 : 0;
      const utPercentDays = entry.days ? (entry.utDays / entry.days) * 100 : 0;
      const latePercentMinutes = entry.requiredMinutes > 0
        ? (entry.lateMinutes / entry.requiredMinutes) * 100
        : null;
      const utPercentMinutes = entry.requiredMinutes > 0
        ? (entry.utMinutes / entry.requiredMinutes) * 100
        : null;
      return {
        office: entry.office,
        key: entry.key,
        days: entry.days,
        lateDays: entry.lateDays,
        utDays: entry.utDays,
        latePercentDays,
        utPercentDays,
        latePercentMinutes,
        utPercentMinutes,
        totalLateMinutes: entry.lateMinutes,
        totalUndertimeMinutes: entry.utMinutes,
        totalRequiredMinutes: entry.requiredMinutes,
      };
    });
    results.sort((a, b) => {
      const aScore =
        metricMode === "minutes"
          ? (a.latePercentMinutes ?? 0) + (a.utPercentMinutes ?? 0)
          : a.latePercentDays + a.utPercentDays;
      const bScore =
        metricMode === "minutes"
          ? (b.latePercentMinutes ?? 0) + (b.utPercentMinutes ?? 0)
          : b.latePercentDays + b.utPercentDays;
      return bScore - aScore;
    });
    return results.slice(0, MAX_LEADERBOARD_ITEMS);
  }, [filteredPerEmployee, metricMode]);

  const arrivalStats = useMemo(() => {
    if (!filteredPerDay.length) return [] as ArrivalStat[];
    const map = new Map<string, { office: string; values: number[] }>();
    for (const row of filteredPerDay) {
      const earliest = row.earliest ?? row.allTimes?.[0] ?? null;
      const minute = toMinuteOfDay(earliest);
      if (minute == null) continue;
      const office = resolveOfficeLabel(row);
      const key = row.officeId ?? office;
      const entry = map.get(key);
      if (entry) {
        entry.values.push(minute);
      } else {
        map.set(key, { office, values: [minute] });
      }
    }
    const stats: ArrivalStat[] = [];
    map.forEach((value) => {
      if (!value.values.length) return;
      const sorted = value.values.slice().sort((a, b) => a - b);
      stats.push({
        office: value.office,
        count: sorted.length,
        min: sorted[0],
        q1: quantile(sorted, 0.25),
        median: quantile(sorted, 0.5),
        q3: quantile(sorted, 0.75),
        max: sorted[sorted.length - 1],
      });
    });
    stats.sort((a, b) => b.count - a.count);
    return stats.slice(0, MAX_ARRIVAL_GROUPS);
  }, [filteredPerDay]);

  const arrivalDomain = useMemo(() => {
    if (!arrivalStats.length) {
      return { min: 5 * 60, max: 21 * 60 };
    }
    const mins = arrivalStats.map((stat) => stat.min);
    const maxs = arrivalStats.map((stat) => stat.max);
    return {
      min: Math.min(...mins, 5 * 60),
      max: Math.max(...maxs, 21 * 60),
    };
  }, [arrivalStats]);

  const calendarHeatmap = useMemo(() => {
    if (!filteredPerDay.length) {
      return {
        dates: [] as string[],
        offices: [] as HeatmapCell[],
        maxValue: 0,
      };
    }
    const datesSet = new Set<string>();
    const officeMap = new Map<
      string,
      {
        office: string;
        totals: HeatmapCell["totals"];
        values: Map<string, { late: number; ut: number; lateMinutes: number; utMinutes: number }>;
      }
    >();

    for (const row of filteredPerDay) {
      const office = resolveOfficeLabel(row);
      const key = row.officeId ?? office;
      const date = row.dateISO;
      datesSet.add(date);
      const officeEntry = officeMap.get(key) ?? {
        office,
        totals: { lateDays: 0, utDays: 0, lateMinutes: 0, utMinutes: 0 },
        values: new Map(),
      };
      const cell = officeEntry.values.get(date) ?? { late: 0, ut: 0, lateMinutes: 0, utMinutes: 0 };
      if (row.isLate) {
        cell.late += 1;
        officeEntry.totals.lateDays += 1;
      }
      if (row.isUndertime) {
        cell.ut += 1;
        officeEntry.totals.utDays += 1;
      }
      const lateMinutes = resolveLateMinutes(row);
      if (lateMinutes != null) {
        cell.lateMinutes += lateMinutes;
        officeEntry.totals.lateMinutes += lateMinutes;
      }
      const undertimeMinutes = resolveUndertimeMinutes(row);
      if (undertimeMinutes != null) {
        cell.utMinutes += undertimeMinutes;
        officeEntry.totals.utMinutes += undertimeMinutes;
      }
      officeEntry.values.set(date, cell);
      officeMap.set(key, officeEntry);
    }

    const sortedDates = Array.from(datesSet).sort((a, b) => a.localeCompare(b));

    const offices = Array.from(officeMap.values())
      .map((entry) => {
        const values = sortedDates.map((date) => {
          const cell = entry.values.get(date);
          if (!cell) return 0;
          if (metricMode === "minutes") {
            return cell.lateMinutes + cell.utMinutes;
          }
          return cell.late + cell.ut;
        });
        return {
          office: entry.office,
          values,
          totals: entry.totals,
        } as HeatmapCell;
      })
      .sort((a, b) => {
        const aScore = metricMode === "minutes"
          ? a.totals.lateMinutes + a.totals.utMinutes
          : a.totals.lateDays + a.totals.utDays;
        const bScore = metricMode === "minutes"
          ? b.totals.lateMinutes + b.totals.utMinutes
          : b.totals.lateDays + b.totals.utDays;
        return bScore - aScore;
      });

    const maxValue = offices.reduce((max, cell) => {
      const cellMax = cell.values.reduce((m, value) => Math.max(m, value), 0);
      return Math.max(max, cellMax);
    }, 0);

    return { dates: sortedDates, offices, maxValue };
  }, [filteredPerDay, metricMode]);

  const perDayByEmployee = useMemo(() => {
    if (!filteredPerDay.length) return new Map<string, PerDayRow[]>();
    const map = new Map<string, PerDayRow[]>();
    for (const row of filteredPerDay) {
      const key = resolveEmployeeKey(row);
      if (!key) continue;
      const list = map.get(key);
      if (list) {
        list.push(row);
      } else {
        map.set(key, [row]);
      }
    }
    map.forEach((rows) => {
      rows.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
    });
    return map;
  }, [filteredPerDay]);

  const topEmployees = useMemo(() => {
    if (!filteredPerEmployee.length) return [] as TopEmployee[];
    const employees = filteredPerEmployee
      .map((row) => {
        const key = resolveEmployeeKey(row);
        const score = metricMode === "minutes"
          ? (row.totalLateMinutes ?? 0) + (row.totalUndertimeMinutes ?? 0)
          : row.lateDays + row.undertimeDays;
        const sparkRows = perDayByEmployee.get(key) ?? [];
        const sparkline = sparkRows.map((day) => ({
          date: day.dateISO,
          late: Boolean(day.isLate),
          undertime: Boolean(day.isUndertime),
        }));
        return { key, row, score, sparkline };
      })
      .filter((item) => item.key);

    employees.sort((a, b) => b.score - a.score);
    return employees.slice(0, MAX_TOP_EMPLOYEES);
  }, [filteredPerEmployee, metricMode, perDayByEmployee]);

  const trendSeries = useMemo(() => {
    if (!filteredPerDay.length) return [] as TrendPoint[];
    const map = new Map<
      string,
      {
        lateCount: number;
        utCount: number;
        daysEvaluated: number;
        lateMinutes: number;
        utMinutes: number;
        requiredMinutes: number;
      }
    >();
    for (const row of filteredPerDay) {
      const date = row.dateISO;
      const entry = map.get(date) ?? {
        lateCount: 0,
        utCount: 0,
        daysEvaluated: 0,
        lateMinutes: 0,
        utMinutes: 0,
        requiredMinutes: 0,
      };
      entry.daysEvaluated += 1;
      if (row.isLate) entry.lateCount += 1;
      if (row.isUndertime) entry.utCount += 1;
      const lateMinutes = resolveLateMinutes(row);
      if (lateMinutes != null) entry.lateMinutes += lateMinutes;
      const undertimeMinutes = resolveUndertimeMinutes(row);
      if (undertimeMinutes != null) entry.utMinutes += undertimeMinutes;
      if (row.requiredMinutes != null) entry.requiredMinutes += row.requiredMinutes;
      map.set(date, entry);
    }
    const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const base = sorted.map(([date, entry]) => {
      const lateDaysPercent = entry.daysEvaluated ? (entry.lateCount / entry.daysEvaluated) * 100 : 0;
      const utDaysPercent = entry.daysEvaluated ? (entry.utCount / entry.daysEvaluated) * 100 : 0;
      const lateMinutesPercent = entry.requiredMinutes > 0
        ? (entry.lateMinutes / entry.requiredMinutes) * 100
        : null;
      const utMinutesPercent = entry.requiredMinutes > 0
        ? (entry.utMinutes / entry.requiredMinutes) * 100
        : null;
      return {
        date,
        label: dateFormatter.format(new Date(`${date}T00:00:00`)),
        lateDaysPercent,
        utDaysPercent,
        lateMinutesPercent,
        utMinutesPercent,
        lateCount: entry.lateCount,
        utCount: entry.utCount,
        daysEvaluated: entry.daysEvaluated,
      };
    });

    const computeMovingAverage = (values: Array<number | null>) =>
      values.map((_, index) => {
        const slice = values
          .slice(Math.max(0, index - 2), index + 1)
          .filter((value): value is number => value != null);
        if (!slice.length) return null;
        const sum = slice.reduce((total, value) => total + value, 0);
        return sum / slice.length;
      });

    const lateDaysMA = computeMovingAverage(base.map((point) => point.lateDaysPercent));
    const utDaysMA = computeMovingAverage(base.map((point) => point.utDaysPercent));
    const lateMinutesMA = computeMovingAverage(base.map((point) => point.lateMinutesPercent ?? null));
    const utMinutesMA = computeMovingAverage(base.map((point) => point.utMinutesPercent ?? null));

    return base.map((point, index) => ({
      ...point,
      lateDaysMA: lateDaysMA[index],
      utDaysMA: utDaysMA[index],
      lateMinutesMA: lateMinutesMA[index],
      utMinutesMA: utMinutesMA[index],
    }));
  }, [filteredPerDay]);

  const scatterPoints = useMemo(() => {
    if (!filteredPerDay.length) return [] as ScatterPoint[];
    const points: ScatterPoint[] = [];
    for (const row of filteredPerDay) {
      const earliest = toMinuteOfDay(row.earliest ?? row.allTimes?.[0] ?? null);
      const latest = toMinuteOfDay(row.latest ?? row.allTimes?.[row.allTimes.length - 1] ?? null);
      if (earliest == null || latest == null) continue;
      points.push({
        employee: row.employeeName || row.employeeId || row.employeeToken || UNMATCHED_LABEL,
        office: resolveOfficeLabel(row),
        earliest,
        latest,
        late: Boolean(row.isLate),
        undertime: Boolean(row.isUndertime),
      });
      if (points.length >= MAX_SCATTER_POINTS) break;
    }
    return points;
  }, [filteredPerDay]);

  const officeChartRef = useRef<HTMLDivElement | null>(null);
  const arrivalChartRef = useRef<HTMLDivElement | null>(null);
  const heatmapRef = useRef<HTMLDivElement | null>(null);
  const heatmapViewportRef = useRef<HTMLDivElement | null>(null);
  const heatmapScrollRestoreRef = useRef(0);
  const [heatmapScrollTop, setHeatmapScrollTop] = useState(0);
  const [heatmapViewportHeight, setHeatmapViewportHeight] = useState(HEATMAP_MAX_HEIGHT);
  const [heatmapForceAll, setHeatmapForceAll] = useState(false);
  const topEmployeesRef = useRef<HTMLDivElement | null>(null);
  const trendRef = useRef<HTMLDivElement | null>(null);
  const scatterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = heatmapViewportRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHeatmapViewportHeight(entry.contentRect.height || HEATMAP_ROW_HEIGHT);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setHeatmapScrollTop(0);
    const element = heatmapViewportRef.current;
    if (element) {
      element.scrollTop = 0;
    }
  }, [calendarHeatmap.offices.length]);

  const handleOfficeCsv = useCallback(() => {
    if (!officeLeaderboardData.length) return;
    downloadCsv(
      `office-leaderboard-${metricMode}.csv`,
      [
        "Office",
        "Days with logs",
        "Late days",
        "Undertime days",
        "Late % (days)",
        "UT % (days)",
        "Late minutes",
        "UT minutes",
        "Late % (minutes)",
        "UT % (minutes)",
      ],
      officeLeaderboardData.map((entry) => [
        entry.office,
        entry.days,
        entry.lateDays,
        entry.utDays,
        entry.latePercentDays,
        entry.utPercentDays,
        entry.totalLateMinutes,
        entry.totalUndertimeMinutes,
        entry.latePercentMinutes,
        entry.utPercentMinutes,
      ])
    );
  }, [metricMode, officeLeaderboardData]);

  const handleOfficePng = useCallback(async () => {
    await exportNodeAsPng(officeChartRef.current, `office-leaderboard-${metricMode}.png`);
  }, [metricMode]);

  const handleArrivalCsv = useCallback(() => {
    if (!arrivalStats.length) return;
    downloadCsv(
      `arrival-distribution.csv`,
      ["Office", "Samples", "Min", "Q1", "Median", "Q3", "Max"],
      arrivalStats.map((stat) => [
        stat.office,
        stat.count,
        minuteToTimeLabel(stat.min),
        minuteToTimeLabel(stat.q1),
        minuteToTimeLabel(stat.median),
        minuteToTimeLabel(stat.q3),
        minuteToTimeLabel(stat.max),
      ])
    );
  }, [arrivalStats]);

  const handleArrivalPng = useCallback(async () => {
    await exportNodeAsPng(arrivalChartRef.current, "arrival-distribution.png");
  }, []);

  const handleHeatmapCsv = useCallback(() => {
    if (!calendarHeatmap.offices.length) return;
    const headers = ["Office", ...calendarHeatmap.dates];
    const rows = calendarHeatmap.offices.map((office) => [office.office, ...office.values]);
    downloadCsv(`calendar-heatmap-${metricMode}.csv`, headers, rows);
  }, [calendarHeatmap.dates, calendarHeatmap.offices, metricMode]);

  const handleHeatmapPng = useCallback(async () => {
    const viewport = heatmapViewportRef.current;
    heatmapScrollRestoreRef.current = viewport?.scrollTop ?? 0;
    setHeatmapForceAll(true);
    if (viewport) {
      viewport.scrollTop = 0;
    }
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    try {
      await exportNodeAsPng(heatmapRef.current, `calendar-heatmap-${metricMode}.png`);
    } finally {
      setHeatmapForceAll(false);
      requestAnimationFrame(() => {
        const element = heatmapViewportRef.current;
        if (element) {
          element.scrollTop = heatmapScrollRestoreRef.current;
          setHeatmapScrollTop(element.scrollTop);
        }
      });
    }
  }, [metricMode]);

  const handleTopEmployeesCsv = useCallback(() => {
    if (!topEmployees.length) return;
    downloadCsv(
      `top-late-ut-${metricMode}.csv`,
      [
        "Employee",
        "Office",
        "Late days",
        "Undertime days",
        "Late % (days)",
        "UT % (days)",
        "Late minutes",
        "UT minutes",
      ],
      topEmployees.map(({ row }) => [
        row.employeeName || row.employeeId || row.employeeToken || UNMATCHED_LABEL,
        resolveOfficeLabel(row),
        row.lateDays,
        row.undertimeDays,
        row.lateRate,
        row.undertimeRate,
        row.totalLateMinutes,
        row.totalUndertimeMinutes,
      ])
    );
  }, [metricMode, topEmployees]);

  const handleTopEmployeesPng = useCallback(async () => {
    await exportNodeAsPng(topEmployeesRef.current, `top-late-ut-${metricMode}.png`);
  }, [metricMode]);

  const [trendBrushKey, setTrendBrushKey] = useState(0);

  const handleTrendCsv = useCallback(() => {
    if (!trendSeries.length) return;
    downloadCsv(
      `trend-lines-${metricMode}.csv`,
      [
        "Date",
        "Late % (days)",
        "UT % (days)",
        "Late % (minutes)",
        "UT % (minutes)",
        "Late count",
        "UT count",
        "Days evaluated",
      ],
      trendSeries.map((point) => [
        point.date,
        point.lateDaysPercent,
        point.utDaysPercent,
        point.lateMinutesPercent,
        point.utMinutesPercent,
        point.lateCount,
        point.utCount,
        point.daysEvaluated,
      ])
    );
  }, [metricMode, trendSeries]);

  const handleTrendPng = useCallback(async () => {
    await exportNodeAsPng(trendRef.current, `trend-lines-${metricMode}.png`);
  }, [metricMode]);

  const handleTrendReset = useCallback(() => {
    setTrendBrushKey((prev) => prev + 1);
  }, []);

  const handleScatterCsv = useCallback(() => {
    if (!scatterPoints.length) return;
    downloadCsv(
      `first-last-scatter.csv`,
      ["Employee", "Office", "Earliest", "Latest", "Late", "Undertime"],
      scatterPoints.map((point) => [
        point.employee,
        point.office,
        minuteToTimeLabel(point.earliest),
        minuteToTimeLabel(point.latest),
        point.late ? "Yes" : "No",
        point.undertime ? "Yes" : "No",
      ])
    );
  }, [scatterPoints]);

  const handleScatterPng = useCallback(async () => {
    await exportNodeAsPng(scatterRef.current, "first-last-scatter.png");
  }, []);

  const filteredSummary = useMemo(() => {
    if (!perEmployee.length && !perDay.length) return "";
    const totalEmployees = perEmployee.length;
    const totalDays = perDay.length;
    if (!filteredEmployeeCount && !filteredDayCount) {
      return `No rows match current filters (out of ${totalEmployees} employees, ${totalDays} days).`;
    }
    return `${filteredEmployeeCount} of ${totalEmployees} employees · ${filteredDayCount} of ${totalDays} day entries`;
  }, [filteredDayCount, filteredEmployeeCount, perDay.length, perEmployee.length]);

  const renderChartVisibility = () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="inline-flex items-center gap-2">
          <LayoutGrid className="h-4 w-4" aria-hidden="true" /> Charts
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="flex items-center justify-between pb-2">
          <p className="text-sm font-medium">Visible charts</p>
          <Button variant="ghost" size="sm" onClick={handleShowAllCharts}>
            Show all
          </Button>
        </div>
        <div className="space-y-2">
          {ALL_CHART_IDS.map((chartId) => {
            const active = visibleChartSet.has(chartId);
            return (
              <label key={chartId} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <Checkbox
                    checked={active}
                    onCheckedChange={(checked) => handleChartToggle(chartId, Boolean(checked))}
                  />
                  {CHART_LABELS[chartId]}
                </span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );

  const officeChartData = useMemo(() => {
    return officeLeaderboardData.map((entry) => ({
      office: entry.office,
      latePercent: metricMode === "minutes" ? entry.latePercentMinutes ?? 0 : entry.latePercentDays,
      utPercent: metricMode === "minutes" ? entry.utPercentMinutes ?? 0 : entry.utPercentDays,
      lateDays: entry.lateDays,
      utDays: entry.utDays,
      days: entry.days,
      lateMinutes: entry.totalLateMinutes,
      utMinutes: entry.totalUndertimeMinutes,
      requiredMinutes: entry.totalRequiredMinutes,
    }));
  }, [officeLeaderboardData, metricMode]);

  const officeChartHeight = Math.max(240, Math.min(600, 60 + officeChartData.length * 44));
  const officeXAxisMax = useMemo(() => {
    const max = officeChartData.reduce((acc, item) => Math.max(acc, item.latePercent + item.utPercent), 0);
    if (max <= 0) return 25;
    return Math.min(100, Math.ceil(max / 10) * 10 + 10);
  }, [officeChartData]);

  const renderOfficeTooltip = useCallback(
    ({ active, payload }: { active?: boolean; payload?: any[] }) => {
      if (!active || !payload?.length) return null;
      const data = payload[0].payload as (typeof officeChartData)[number];
      return (
        <div className="min-w-[220px] rounded-md border bg-background p-3 text-xs shadow">
          <p className="font-medium">{data.office}</p>
          <p className="mt-1">Days evaluated: {data.days}</p>
          <p>Late: {data.lateDays} ({formatPercent(payload[0].value as number)})</p>
          <p>Undertime: {data.utDays} ({formatPercent(payload[1]?.value as number)})</p>
          {metricMode === "minutes" ? (
            <div className="mt-1 space-y-1">
              <p>Late minutes: {Math.round(data.lateMinutes).toLocaleString()}</p>
              <p>Undertime minutes: {Math.round(data.utMinutes).toLocaleString()}</p>
            </div>
          ) : null}
        </div>
      );
    },
    [metricMode, officeChartData]
  );

  const arrivalRange = Math.max(1, arrivalDomain.max - arrivalDomain.min);
  const heatmapHasData = calendarHeatmap.offices.length > 0 && calendarHeatmap.dates.length > 0;
  const topEmployeesHasData = topEmployees.length > 0;
  const trendHasData = trendSeries.length > 0;
  const scatterData = useMemo(
    () =>
      scatterPoints.map((point) => ({
        ...point,
        fill: point.late && point.undertime ? "#dc2626" : point.late ? "#f97316" : point.undertime ? "#2563eb" : "#16a34a",
      })),
    [scatterPoints]
  );
  const scatterHasData = scatterData.length > 0;

  const heatmapVirtual = useMemo(() => {
    const total = calendarHeatmap.offices.length;
    if (!total) {
      return {
        start: 0,
        end: 0,
        offset: 0,
        items: [] as HeatmapCell[],
        totalHeight: 0,
      };
    }
    if (heatmapForceAll) {
      return {
        start: 0,
        end: total,
        offset: 0,
        items: calendarHeatmap.offices,
        totalHeight: total * HEATMAP_ROW_HEIGHT,
      };
    }
    const viewport = Math.max(HEATMAP_ROW_HEIGHT, heatmapViewportHeight);
    const start = Math.max(0, Math.floor(heatmapScrollTop / HEATMAP_ROW_HEIGHT) - HEATMAP_BUFFER_ROWS);
    const visibleCount = Math.ceil(viewport / HEATMAP_ROW_HEIGHT) + HEATMAP_BUFFER_ROWS * 2;
    const end = Math.min(total, start + visibleCount);
    return {
      start,
      end,
      offset: start * HEATMAP_ROW_HEIGHT,
      items: calendarHeatmap.offices.slice(start, end),
      totalHeight: total * HEATMAP_ROW_HEIGHT,
    };
  }, [
    calendarHeatmap.offices,
    heatmapForceAll,
    heatmapScrollTop,
    heatmapViewportHeight,
  ]);

  const scatterDomain = useMemo(() => {
    if (!scatterPoints.length) {
      return {
        x: { min: 360, max: 1320 },
        y: { min: 360, max: 1320 },
      };
    }
    const earliestValues = scatterPoints.map((point) => point.earliest);
    const latestValues = scatterPoints.map((point) => point.latest);

    const expandRange = (values: number[]) => {
      const minValue = Math.min(...values);
      const maxValue = Math.max(...values);
      const span = Math.max(MIN_SCATTER_SPAN, maxValue - minValue);
      const padding = Math.max(SCATTER_PADDING_MIN, span * 0.1);
      let min = clamp(minValue - padding, 0, MINUTES_IN_DAY);
      let max = clamp(maxValue + padding, 0, MINUTES_IN_DAY);
      if (max - min < MIN_SCATTER_SPAN) {
        const shortfall = MIN_SCATTER_SPAN - (max - min);
        min = clamp(min - shortfall / 2, 0, MINUTES_IN_DAY);
        max = clamp(min + MIN_SCATTER_SPAN, 0, MINUTES_IN_DAY);
      }
      if (max <= min) {
        max = clamp(min + MIN_SCATTER_SPAN, 0, MINUTES_IN_DAY);
      }
      return { min, max };
    };

    return {
      x: expandRange(earliestValues),
      y: expandRange(latestValues),
    };
  }, [scatterPoints]);

  const renderHeatmapRow = useCallback(
    (office: HeatmapCell, rowIndex: number) => (
      <div
        key={`${office.office}-${rowIndex}`}
        className="grid items-center gap-1"
        style={{
          gridTemplateColumns: `140px repeat(${office.values.length}, minmax(0, 1fr))`,
          minHeight: HEATMAP_ROW_HEIGHT,
        }}
      >
        <span className="text-sm font-medium text-foreground">{office.office}</span>
        {office.values.map((value, index) => {
          const intensity = calendarHeatmap.maxValue ? Math.min(1, value / calendarHeatmap.maxValue) : 0;
          const color = metricMode === "minutes"
            ? `rgba(8, 145, 178, ${Math.max(0.08, intensity)})`
            : `rgba(217, 119, 6, ${Math.max(0.08, intensity)})`;
          const tooltipContent = metricMode === "minutes"
            ? `${Math.round(value)} deficit minutes`
            : `${value} late/UT events`;
          const date = calendarHeatmap.dates[index];
          return (
            <Tooltip key={`${office.office}-${date}-${index}`}>
              <TooltipTrigger asChild>
                <div className="h-8 rounded" style={{ backgroundColor: color }} />
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                <p className="font-medium">{office.office}</p>
                <p>{date}</p>
                <p>{tooltipContent}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    ),
    [calendarHeatmap.dates, calendarHeatmap.maxValue, metricMode]
  );

  const trendLateKey = metricMode === "minutes" ? "lateMinutesPercent" : "lateDaysPercent";
  const trendUtKey = metricMode === "minutes" ? "utMinutesPercent" : "utDaysPercent";
  const trendLateMaKey = metricMode === "minutes" ? "lateMinutesMA" : "lateDaysMA";
  const trendUtMaKey = metricMode === "minutes" ? "utMinutesMA" : "utDaysMA";

  const renderTrendTooltip = useCallback(
    ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) => {
      if (!active || !payload?.length) return null;
      const data = payload[0].payload as TrendPoint;
      return (
        <div className="min-w-[220px] rounded-md border bg-background p-3 text-xs shadow">
          <p className="font-medium">{label}</p>
          <p>Late: {formatPercent(data[trendLateKey as keyof TrendPoint] as number)}</p>
          <p>Undertime: {formatPercent(data[trendUtKey as keyof TrendPoint] as number)}</p>
          <p className="mt-1 text-muted-foreground">Evaluated days: {data.daysEvaluated}</p>
        </div>
      );
    },
    [trendLateKey, trendUtKey]
  );

  return (
    <section className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand insights" : "Collapse insights"}
          >
            {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Insights</h2>
            </div>
            <p className="text-sm text-muted-foreground">Interactive metrics and charts for the current filters.</p>
          </div>
        </div>
        <div className="flex flex-col items-start gap-1 text-xs text-muted-foreground sm:items-end">
          <span>{filteredSummary}</span>
          {activeFilterChips.length ? (
            <div className="flex flex-wrap gap-1 sm:justify-end">
              {activeFilterChips.map((chip) => (
                <Badge
                  key={chip}
                  variant="outline"
                  className="border-dashed px-2 py-0.5 text-[10px] uppercase tracking-wide"
                >
                  {chip}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      {!collapsed && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {renderChartVisibility()}
          </div>

          <div className="space-y-4">
            {chartIsVisible("office-leaderboard", visibleChartSet) && (
              <ChartCard
                id="office-leaderboard"
                title={CHART_LABELS["office-leaderboard"]}
                description={CHART_DESCRIPTIONS["office-leaderboard"]}
                hasData={officeChartData.length > 0}
                onExportCsv={handleOfficeCsv}
                onExportPng={handleOfficePng}
              >
                <div ref={officeChartRef} className="h-full w-full">
                  {officeChartData.length ? (
                    <ResponsiveContainer width="100%" height={officeChartHeight}>
                      <BarChart data={officeChartData} layout="vertical" margin={{ left: 80, right: 16, top: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
                        <XAxis type="number" domain={[0, officeXAxisMax]} hide={false} tickFormatter={(value) => `${value}%`} />
                        <YAxis type="category" dataKey="office" width={160} />
                        <RechartsTooltip content={renderOfficeTooltip} />
                        <Legend formatter={(value) => (value === "latePercent" ? "Late %" : "UT %")} />
                        <Bar dataKey="latePercent" stackId="a" fill="#f97316" name={`Late % (${metricLabel(metricMode)})`} />
                        <Bar dataKey="utPercent" stackId="a" fill="#2563eb" name={`UT % (${metricLabel(metricMode)})`} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground">No offices available for this dataset.</p>
                  )}
                </div>
              </ChartCard>
            )}

            {chartIsVisible("arrival-distribution", visibleChartSet) && (
              <ChartCard
                id="arrival-distribution"
                title={CHART_LABELS["arrival-distribution"]}
                description={CHART_DESCRIPTIONS["arrival-distribution"]}
                hasData={arrivalStats.length > 0}
                onExportCsv={handleArrivalCsv}
                onExportPng={handleArrivalPng}
              >
                <div ref={arrivalChartRef} className="space-y-4">
                  {arrivalStats.length ? (
                    arrivalStats.map((stat) => {
                      const minPct = ((stat.min - arrivalDomain.min) / arrivalRange) * 100;
                      const maxPct = ((stat.max - arrivalDomain.min) / arrivalRange) * 100;
                      const boxStart = ((stat.q1 - arrivalDomain.min) / arrivalRange) * 100;
                      const boxWidth = Math.max(2, ((stat.q3 - stat.q1) / arrivalRange) * 100);
                      const medianPct = ((stat.median - arrivalDomain.min) / arrivalRange) * 100;
                      return (
                        <div key={stat.office} className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="text-sm font-medium text-foreground">{stat.office}</span>
                            <span>{stat.count.toLocaleString()} samples</span>
                          </div>
                          <div className="relative h-8 rounded bg-muted">
                            <div
                              className="absolute top-1/2 h-[22px] -translate-y-1/2 rounded bg-primary/20"
                              style={{ left: `${boxStart}%`, width: `${boxWidth}%` }}
                            />
                            <div
                              className="absolute top-1/2 h-[26px] w-0.5 -translate-y-1/2 bg-primary"
                              style={{ left: `${medianPct}%` }}
                            />
                            <div
                              className="absolute top-[6px] h-[calc(100%-12px)] w-0.5 bg-primary/70"
                              style={{ left: `${minPct}%` }}
                            />
                            <div
                              className="absolute top-[6px] h-[calc(100%-12px)] w-0.5 bg-primary/70"
                              style={{ left: `${maxPct}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{minuteToTimeLabel(stat.min)}</span>
                            <span>Median {minuteToTimeLabel(stat.median)}</span>
                            <span>{minuteToTimeLabel(stat.max)}</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">Not enough punch data to plot arrivals.</p>
                  )}
                </div>
              </ChartCard>
            )}

            {chartIsVisible("calendar-heatmap", visibleChartSet) && (
              <ChartCard
                id="calendar-heatmap"
                title={CHART_LABELS["calendar-heatmap"]}
                description={CHART_DESCRIPTIONS["calendar-heatmap"]}
                hasData={heatmapHasData}
                onExportCsv={handleHeatmapCsv}
                onExportPng={handleHeatmapPng}
              >
                <div ref={heatmapRef} className="space-y-4">
                  {heatmapHasData ? (
                    <>
                      <div
                        className="grid gap-1 text-xs text-muted-foreground"
                        style={{ gridTemplateColumns: `140px repeat(${calendarHeatmap.dates.length}, minmax(0, 1fr))` }}
                      >
                        <span />
                        {calendarHeatmap.dates.map((date) => (
                          <span key={date} className="text-center">
                            {dateFormatter.format(new Date(`${date}T00:00:00`))}
                          </span>
                        ))}
                      </div>
                      <div
                        ref={heatmapViewportRef}
                        className={cn(
                          "relative rounded-md border",
                          heatmapForceAll ? "max-h-none overflow-visible" : "max-h-[360px] overflow-auto"
                        )}
                        onScroll={(event) => {
                          if (heatmapForceAll) return;
                          setHeatmapScrollTop(event.currentTarget.scrollTop);
                        }}
                      >
                        {heatmapForceAll ? (
                          <div className="space-y-1 py-1">
                            {calendarHeatmap.offices.map((office, index) => renderHeatmapRow(office, index))}
                          </div>
                        ) : (
                          <div style={{ height: heatmapVirtual.totalHeight, position: "relative" }}>
                            <div
                              style={{
                                position: "absolute",
                                inset: 0,
                                transform: `translateY(${heatmapVirtual.offset}px)`,
                              }}
                            >
                              {heatmapVirtual.items.map((office, index) =>
                                renderHeatmapRow(office, heatmapVirtual.start + index)
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p>
                          Intensity represents {metricMode === "minutes" ? "total late + undertime minutes" : "late and undertime occurrences"}
                          {" "}per office-day.
                        </p>
                        <p className="italic">
                          {heatmapForceAll
                            ? `All ${calendarHeatmap.offices.length.toLocaleString()} offices expanded for export.`
                            : `Scroll to explore ${calendarHeatmap.offices.length.toLocaleString()} office${calendarHeatmap.offices.length === 1 ? "" : "s"}.`}
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No daily activity available for the current filters.</p>
                  )}
                </div>
              </ChartCard>
            )}

            {chartIsVisible("top-late-ut", visibleChartSet) && (
              <ChartCard
                id="top-late-ut"
                title={CHART_LABELS["top-late-ut"]}
                description={CHART_DESCRIPTIONS["top-late-ut"]}
                hasData={topEmployeesHasData}
                onExportCsv={handleTopEmployeesCsv}
                onExportPng={handleTopEmployeesPng}
              >
                <div ref={topEmployeesRef} className="overflow-x-auto">
                  {topEmployeesHasData ? (
                    <table className="min-w-full text-sm">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="p-2 text-left">Employee</th>
                          <th className="p-2 text-left">Office</th>
                          <th className="p-2 text-center">Late days</th>
                          <th className="p-2 text-center">UT days</th>
                          <th className="p-2 text-center">Late %</th>
                          <th className="p-2 text-center">UT %</th>
                          <th className="p-2 text-left">Sparkline</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topEmployees.map((employee) => {
                          const row = employee.row;
                          const office = resolveOfficeLabel(row);
                          const spark = employee.sparkline.slice(-31);
                          return (
                            <tr key={employee.key} className="odd:bg-muted/20">
                              <td className="p-2 font-medium">{row.employeeName || row.employeeId || row.employeeToken || UNMATCHED_LABEL}</td>
                              <td className="p-2 text-sm text-muted-foreground">{office}</td>
                              <td className="p-2 text-center">{row.lateDays}</td>
                              <td className="p-2 text-center">{row.undertimeDays}</td>
                              <td className="p-2 text-center">{formatPercent(row.lateRate)}</td>
                              <td className="p-2 text-center">{formatPercent(row.undertimeRate)}</td>
                              <td className="p-2">
                                <div className="flex gap-0.5">
                                  {spark.map((day, index) => (
                                    <span
                                      key={`${employee.key}-${day.date}-${index}`}
                                      className={cn("h-5 w-2 rounded-sm", sparklineColor(day.late, day.undertime))}
                                      aria-hidden="true"
                                    />
                                  ))}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-muted-foreground">No employees matched the current filters.</p>
                  )}
                </div>
              </ChartCard>
            )}

            {chartIsVisible("trend-lines", visibleChartSet) && (
              <ChartCard
                id="trend-lines"
                title={CHART_LABELS["trend-lines"]}
                description={CHART_DESCRIPTIONS["trend-lines"]}
                hasData={trendHasData}
                onExportCsv={handleTrendCsv}
                onExportPng={handleTrendPng}
                onReset={handleTrendReset}
                resetDisabled={!trendHasData}
              >
                <div ref={trendRef} className="h-full w-full">
                  {trendHasData ? (
                    <ResponsiveContainer width="100%" height={320}>
                      <LineChart data={trendSeries} margin={{ left: 16, right: 16, top: 16, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
                        <XAxis dataKey="label" minTickGap={20} />
                        <YAxis tickFormatter={(value) => `${value}%`} domain={[0, 100]} />
                        <RechartsTooltip content={renderTrendTooltip} />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey={trendLateKey}
                          stroke="#f97316"
                          strokeWidth={2}
                          dot={false}
                          name={`Late % (${metricLabel(metricMode)})`}
                        />
                        <Line
                          type="monotone"
                          dataKey={trendUtKey}
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={false}
                          name={`UT % (${metricLabel(metricMode)})`}
                        />
                        <Line
                          type="monotone"
                          dataKey={trendLateMaKey}
                          stroke="#f97316"
                          strokeDasharray="4 4"
                          dot={false}
                          name="Late % (3-day MA)"
                        />
                        <Line
                          type="monotone"
                          dataKey={trendUtMaKey}
                          stroke="#2563eb"
                          strokeDasharray="4 4"
                          dot={false}
                          name="UT % (3-day MA)"
                        />
                        <Brush dataKey="label" height={22} travellerWidth={12} key={trendBrushKey} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground">No daily trend data available.</p>
                  )}
                </div>
              </ChartCard>
            )}

            {chartIsVisible("first-last-scatter", visibleChartSet) && (
              <ChartCard
                id="first-last-scatter"
                title={CHART_LABELS["first-last-scatter"]}
                description={CHART_DESCRIPTIONS["first-last-scatter"]}
                hasData={scatterHasData}
                onExportCsv={handleScatterCsv}
                onExportPng={handleScatterPng}
              >
                <div ref={scatterRef} className="h-full w-full">
                  {scatterHasData ? (
                    <ResponsiveContainer width="100%" height={320}>
                      <ScatterChart margin={{ left: 24, right: 24, top: 16, bottom: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
                        <XAxis
                          type="number"
                          dataKey="earliest"
                          name="Earliest"
                          tickFormatter={(value) => minuteToTimeLabel(value as number)}
                          domain={[scatterDomain.x.min, scatterDomain.x.max]}
                        />
                        <YAxis
                          type="number"
                          dataKey="latest"
                          name="Latest"
                          tickFormatter={(value) => minuteToTimeLabel(value as number)}
                          domain={[scatterDomain.y.min, scatterDomain.y.max]}
                        />
                        <RechartsTooltip
                          cursor={{ strokeDasharray: "3 3" }}
                          formatter={(value: number, name: string, props) => {
                            if (name === "earliest" || name === "latest") {
                              return [minuteToTimeLabel(value), name === "earliest" ? "Earliest" : "Latest"];
                            }
                            return value;
                          }}
                        />
                        <Legend />
                        <ReferenceLine x={480} stroke="#f97316" strokeDasharray="4 4" label="8:00" />
                        <ReferenceLine y={1020} stroke="#2563eb" strokeDasharray="4 4" label="17:00" />
                        <Scatter data={scatterData} name="Punches">
                          {scatterData.map((entry, index) => (
                            <Cell key={`scatter-${index}`} fill={entry.fill} />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground">No punch pairs available for scatter plotting.</p>
                  )}
                </div>
              </ChartCard>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

