"use client";

import type { MetricMode } from "./insights-types";

export type SortKey =
  | "daysWithLogs"
  | "lateDays"
  | "undertimeDays"
  | "totalLateMinutes"
  | "totalUndertimeMinutes"
  | "latePercent"
  | "undertimePercent";

export type SortDirection = "asc" | "desc";

export type HeadsFilterValue = "all" | "heads" | "nonHeads";

export const DEFAULT_HEADS_FILTER: HeadsFilterValue = "all";

const HEADS_FILTER_LABEL: Record<Exclude<HeadsFilterValue, "all">, string> = {
  heads: "Heads only",
  nonHeads: "Exclude heads",
};

export const HEADS_FILTER_URL_VALUE: Record<HeadsFilterValue, string> = {
  all: "all",
  heads: "heads",
  nonHeads: "non",
};

export const SUMMARY_FILTERS_STORAGE_KEY = "hrps:bio:summary-filters";

export const SUMMARY_FILTER_QUERY_KEYS = {
  search: "summarySearch",
  heads: "summaryHeads",
  offices: "summaryOffices",
  schedules: "summarySchedules",
  showUnmatched: "summaryUnmatched",
  showNoPunch: "summaryNoPunch",
  metricMode: "summaryMetric",
  sortBy: "summarySort",
  sortDir: "summarySortDir",
  thenBy: "summaryThen",
  thenDir: "summaryThenDir",
} as const;

export type SummaryFiltersState = {
  search: string;
  heads: HeadsFilterValue;
  offices: string[];
  schedules: string[];
  showUnmatched: boolean;
  showNoPunch: boolean;
  metricMode: MetricMode;
  sortBy: SortKey;
  sortDir: SortDirection;
  thenBy: SortKey | null;
  thenDir: SortDirection;
};

export const DEFAULT_SUMMARY_FILTERS: SummaryFiltersState = {
  search: "",
  heads: DEFAULT_HEADS_FILTER,
  offices: [],
  schedules: [],
  showUnmatched: true,
  showNoPunch: false,
  metricMode: "days",
  sortBy: "lateDays",
  sortDir: "desc",
  thenBy: null,
  thenDir: "desc",
};

export const getHeadsFilterLabel = (value: HeadsFilterValue) =>
  value === "all" ? null : HEADS_FILTER_LABEL[value];

export const parseHeadsFilterParam = (value: string | null): HeadsFilterValue | null => {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized === "heads") return "heads";
  if (normalized === "non") return "nonHeads";
  if (normalized === "all") return "all";
  return null;
};

export const isSortKey = (value: unknown): value is SortKey =>
  typeof value === "string" &&
  [
    "daysWithLogs",
    "lateDays",
    "undertimeDays",
    "totalLateMinutes",
    "totalUndertimeMinutes",
    "latePercent",
    "undertimePercent",
  ].includes(value);

export const sanitizeSortKeyForMetric = (key: SortKey, metricMode: MetricMode): SortKey => {
  if (metricMode === "minutes") {
    if (key === "latePercent") return "totalLateMinutes";
    if (key === "undertimePercent") return "totalUndertimeMinutes";
    return key;
  }
  if (key === "totalLateMinutes") return "latePercent";
  if (key === "totalUndertimeMinutes") return "undertimePercent";
  return key;
};

export const sanitizeSummaryFilters = (state: SummaryFiltersState): SummaryFiltersState => {
  const offices = Array.from(new Set(state.offices.filter((value) => typeof value === "string" && value.length)));
  const schedules = Array.from(
    new Set(state.schedules.filter((value) => typeof value === "string" && value.length))
  );

  const heads: HeadsFilterValue = state.heads ?? DEFAULT_HEADS_FILTER;
  const metricMode: MetricMode = state.metricMode === "minutes" ? "minutes" : "days";

  const sortBy = sanitizeSortKeyForMetric(state.sortBy, metricMode);
  let thenBy = state.thenBy ? sanitizeSortKeyForMetric(state.thenBy, metricMode) : null;

  if (thenBy === sortBy) {
    thenBy = null;
  }

  const sortDir: SortDirection = state.sortDir === "asc" ? "asc" : "desc";
  const thenDir: SortDirection = state.thenDir === "asc" ? "asc" : "desc";

  return {
    search: state.search ?? "",
    heads,
    offices,
    schedules,
    showUnmatched: Boolean(state.showUnmatched),
    showNoPunch: Boolean(state.showNoPunch),
    metricMode,
    sortBy,
    sortDir,
    thenBy,
    thenDir,
  };
};

export const areSummaryFiltersEqual = (a: SummaryFiltersState, b: SummaryFiltersState) =>
  a === b ||
  (
    a.search === b.search &&
    a.heads === b.heads &&
    a.showUnmatched === b.showUnmatched &&
    a.showNoPunch === b.showNoPunch &&
    a.metricMode === b.metricMode &&
    a.sortBy === b.sortBy &&
    a.sortDir === b.sortDir &&
    a.thenBy === b.thenBy &&
    a.thenDir === b.thenDir &&
    a.offices.length === b.offices.length &&
    a.offices.every((value, index) => value === b.offices[index]) &&
    a.schedules.length === b.schedules.length &&
    a.schedules.every((value, index) => value === b.schedules[index])
  );

