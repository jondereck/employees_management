"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import type { MetricMode } from "@/app/(dashboard)/[departmentId]/(routes)/tools/biometrics/insights-types";

const STORAGE_KEY_PREFIX = "bio-summary-filters-v1";
export const NO_SUMMARY_FILTER_SELECTION = "__none__";

const QUERY_KEYS = {
  search: "pe-search",
  heads: "pe-heads",
  offices: "pe-offices",
  employeeTypes: "pe-types",
  schedules: "pe-schedules",
  showUnmatched: "pe-unmatched",
  showNoPunch: "pe-nopunch",
  metric: "pe-metric",
  sortField: "pe-sort",
  sortDir: "pe-dir",
  secondaryField: "pe-then",
  secondaryDir: "pe-then-dir",
} as const;

const SUMMARY_QUERY_KEYS = Object.values(QUERY_KEYS);

export type HeadsFilterValue = "all" | "heads" | "nonHeads";

export type SummarySortField =
  | "employeeName"
  | "employeeNo"
  | "office"
  | "schedule"
  | "days"
  | "noPunch"
  | "absences"
  | "lateDays"
  | "undertimeDays"
  | "latePercent"
  | "undertimePercent"
  | "lateMinutes"
  | "undertimeMinutes"
  | "otTotalMinutes";

export type SortDirection = "asc" | "desc";

export type SummaryFiltersState = {
  search: string;
  heads: HeadsFilterValue;
  offices: string[];
  employeeTypes: string[];
  schedules: string[];
  showUnmatched: boolean;
  showNoPunch: boolean;
  metricMode: MetricMode;
  sortBy: SummarySortField;
  sortDir: SortDirection;
  secondarySortBy: SummarySortField | null;
  secondarySortDir: SortDirection;
};

export const DEFAULT_SUMMARY_FILTERS: SummaryFiltersState = {
  search: "",
  heads: "all",
  offices: [],
  employeeTypes: [],
  schedules: [],
  showUnmatched: true,
  showNoPunch: false,
  metricMode: "days",
  sortBy: "lateDays",
  sortDir: "desc",
  secondarySortBy: null,
  secondarySortDir: "asc",
};

const HEADS_PARAM_MAP: Record<HeadsFilterValue, string> = {
  all: "all",
  heads: "heads",
  nonHeads: "non",
};

const HEADS_PARAM_REVERSE: Record<string, HeadsFilterValue> = {
  all: "all",
  heads: "heads",
  non: "nonHeads",
};

const isSortField = (value: unknown): value is SummarySortField =>
  typeof value === "string" &&
  (
    value === "employeeName" ||
    value === "employeeNo" ||
    value === "office" ||
    value === "schedule" ||
    value === "days" ||
    value === "noPunch" ||
    value === "absences" ||
    value === "lateDays" ||
    value === "undertimeDays" ||
    value === "latePercent" ||
    value === "undertimePercent" ||
    value === "lateMinutes" ||
    value === "undertimeMinutes" ||
    value === "otTotalMinutes"
  );

const isSortDirection = (value: unknown): value is SortDirection =>
  value === "asc" || value === "desc";

const normalizeList = (values: string[]) =>
  Array.from(new Set(values.filter((value) => typeof value === "string" && value.length > 0))).sort((a, b) =>
    a.localeCompare(b)
  );

const normalizeFilters = (state: SummaryFiltersState): SummaryFiltersState => {
  const sortBy = isSortField(state.sortBy) ? state.sortBy : DEFAULT_SUMMARY_FILTERS.sortBy;
  const sortDir = isSortDirection(state.sortDir) ? state.sortDir : DEFAULT_SUMMARY_FILTERS.sortDir;
  const metricMode = state.metricMode === "minutes" ? "minutes" : "days";
  const heads = state.heads === "heads" || state.heads === "nonHeads" ? state.heads : "all";
  let secondarySortBy: SummarySortField | null = null;
  if (state.secondarySortBy && isSortField(state.secondarySortBy) && state.secondarySortBy !== sortBy) {
    secondarySortBy = state.secondarySortBy;
  }
  const secondarySortDir = isSortDirection(state.secondarySortDir)
    ? state.secondarySortDir
    : DEFAULT_SUMMARY_FILTERS.secondarySortDir;

  return {
    search: state.search?.slice(0, 200) ?? "",
    heads,
    offices: normalizeList(state.offices ?? []),
    employeeTypes: normalizeList(state.employeeTypes ?? []),
    schedules: normalizeList(state.schedules ?? []),
    showUnmatched: Boolean(state.showUnmatched),
    showNoPunch: Boolean(state.showNoPunch),
    metricMode,
    sortBy,
    sortDir,
    secondarySortBy,
    secondarySortDir: secondarySortBy ? secondarySortDir : DEFAULT_SUMMARY_FILTERS.secondarySortDir,
  };
};

const filtersEqual = (a: SummaryFiltersState, b: SummaryFiltersState) =>
  a.search === b.search &&
  a.heads === b.heads &&
  a.showUnmatched === b.showUnmatched &&
  a.showNoPunch === b.showNoPunch &&
  a.metricMode === b.metricMode &&
  a.sortBy === b.sortBy &&
  a.sortDir === b.sortDir &&
  a.secondarySortBy === b.secondarySortBy &&
  a.secondarySortDir === b.secondarySortDir &&
  a.offices.length === b.offices.length &&
  a.offices.every((value, index) => value === b.offices[index]) &&
  a.employeeTypes.length === b.employeeTypes.length &&
  a.employeeTypes.every((value, index) => value === b.employeeTypes[index]) &&
  a.schedules.length === b.schedules.length &&
  a.schedules.every((value, index) => value === b.schedules[index]);

const parseBooleanParam = (value: string | null, fallback: boolean) => {
  if (value == null) return fallback;
  if (value === "0" || value.toLowerCase() === "false") return false;
  if (value === "1" || value.toLowerCase() === "true") return true;
  return fallback;
};

const parseFiltersFromSearchParams = (
  params: URLSearchParams,
  fallback: SummaryFiltersState
): SummaryFiltersState => {
  const next: SummaryFiltersState = {
    search: fallback.search,
    heads: fallback.heads,
    offices: fallback.offices,
    employeeTypes: fallback.employeeTypes,
    schedules: fallback.schedules,
    showUnmatched: fallback.showUnmatched,
    showNoPunch: fallback.showNoPunch,
    metricMode: fallback.metricMode,
    sortBy: fallback.sortBy,
    sortDir: fallback.sortDir,
    secondarySortBy: fallback.secondarySortBy,
    secondarySortDir: fallback.secondarySortDir,
  };

  const searchValue = params.get(QUERY_KEYS.search);
  if (searchValue != null) {
    next.search = searchValue;
  }

  const headsValue = params.get(QUERY_KEYS.heads);
  if (headsValue != null && headsValue in HEADS_PARAM_REVERSE) {
    next.heads = HEADS_PARAM_REVERSE[headsValue] ?? fallback.heads;
  }

  const officeValues = params.getAll(QUERY_KEYS.offices);
  if (officeValues.length) {
    next.offices = officeValues;
  }

  const employeeTypeValues = params.getAll(QUERY_KEYS.employeeTypes);
  if (employeeTypeValues.length) {
    next.employeeTypes = employeeTypeValues;
  }

  const scheduleValues = params.getAll(QUERY_KEYS.schedules);
  if (scheduleValues.length) {
    next.schedules = scheduleValues;
  }

  next.showUnmatched = parseBooleanParam(params.get(QUERY_KEYS.showUnmatched), fallback.showUnmatched);
  next.showNoPunch = parseBooleanParam(params.get(QUERY_KEYS.showNoPunch), fallback.showNoPunch);

  const metricValue = params.get(QUERY_KEYS.metric);
  if (metricValue === "minutes" || metricValue === "days") {
    next.metricMode = metricValue;
  }

  const sortField = params.get(QUERY_KEYS.sortField);
  if (sortField && isSortField(sortField)) {
    next.sortBy = sortField;
  }

  const sortDir = params.get(QUERY_KEYS.sortDir);
  if (sortDir && isSortDirection(sortDir)) {
    next.sortDir = sortDir;
  }

  const secondaryField = params.get(QUERY_KEYS.secondaryField);
  if (secondaryField && isSortField(secondaryField) && secondaryField !== next.sortBy) {
    next.secondarySortBy = secondaryField;
  } else {
    next.secondarySortBy = null;
  }

  const secondaryDir = params.get(QUERY_KEYS.secondaryDir);
  if (secondaryDir && isSortDirection(secondaryDir)) {
    next.secondarySortDir = secondaryDir;
  }

  return normalizeFilters(next);
};

const hasAnyFilterInParams = (params: URLSearchParams) =>
  SUMMARY_QUERY_KEYS.some((key) => params.has(key));

export type UseSummaryFilters = {
  filters: SummaryFiltersState;
  setSearch: (value: string) => void;
  setHeads: (value: HeadsFilterValue) => void;
  toggleOffice: (key: string) => void;
  setOffices: (values: string[]) => void;
  clearOffices: () => void;
  toggleEmployeeType: (value: string) => void;
  setEmployeeTypes: (values: string[]) => void;
  clearEmployeeTypes: () => void;
  toggleSchedule: (value: string) => void;
  setSchedules: (values: string[]) => void;
  clearSchedules: () => void;
  setShowUnmatched: (value: boolean) => void;
  setShowNoPunch: (value: boolean) => void;
  setMetricMode: (mode: MetricMode) => void;
  setSort: (config: Partial<{
    sortBy: SummarySortField;
    sortDir: SortDirection;
    secondarySortBy: SummarySortField | null;
    secondarySortDir: SortDirection;
  }>) => void;
  replaceFilters: (values: Partial<SummaryFiltersState>) => void;
  togglePrimarySort: (field: SummarySortField) => void;
};

// Internal implementation used by the Provider and as a fallback when no Provider is mounted
const useSummaryFiltersInternal = (): UseSummaryFilters => {
  const storageKeyRef = useRef(`${STORAGE_KEY_PREFIX}:summary`);
  const [filters, setFiltersState] = useState<SummaryFiltersState>(DEFAULT_SUMMARY_FILTERS);

  const persistFilters = useCallback((next: SummaryFiltersState) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKeyRef.current, JSON.stringify(next));
    } catch (error) {
      console.warn("Failed to persist summary filters", error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    storageKeyRef.current = `${STORAGE_KEY_PREFIX}:${window.location.pathname}`;
    try {
      const raw = window.localStorage.getItem(storageKeyRef.current);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SummaryFiltersState>;
        setFiltersState(normalizeFilters({ ...DEFAULT_SUMMARY_FILTERS, ...parsed }));
      }
    } catch (error) {
      console.warn("Failed to load summary filters", error);
    }
  }, []);

  const updateFilters = useCallback(
    (updater: (current: SummaryFiltersState) => SummaryFiltersState) => {
      setFiltersState((current) => {
        const next = normalizeFilters(updater(current));
        if (filtersEqual(next, current)) return current;
        persistFilters(next);
        return next;
      });
    },
    [persistFilters]
  );

  const setSearch = useCallback(
    (value: string) => {
      updateFilters((current) => ({ ...current, search: value }));
    },
    [updateFilters]
  );

  const setHeads = useCallback(
    (value: HeadsFilterValue) => {
      updateFilters((current) => ({ ...current, heads: value }));
    },
    [updateFilters]
  );

  const setOffices = useCallback(
    (values: string[]) => {
      updateFilters((current) => ({ ...current, offices: values }));
    },
    [updateFilters]
  );

  const clearOffices = useCallback(() => {
    setOffices([]);
  }, [setOffices]);

  const setEmployeeTypes = useCallback(
    (values: string[]) => {
      updateFilters((current) => ({ ...current, employeeTypes: values }));
    },
    [updateFilters]
  );

  const clearEmployeeTypes = useCallback(() => {
    setEmployeeTypes([]);
  }, [setEmployeeTypes]);

  const toggleEmployeeType = useCallback(
    (value: string) => {
      updateFilters((current) => {
        const set = new Set(current.employeeTypes);
        if (set.has(value)) {
          set.delete(value);
        } else {
          set.add(value);
        }
        return { ...current, employeeTypes: Array.from(set) };
      });
    },
    [updateFilters]
  );

  const toggleOffice = useCallback(
    (key: string) => {
      updateFilters((current) => {
        const set = new Set(current.offices);
        if (set.has(key)) {
          set.delete(key);
        } else {
          set.add(key);
        }
        return { ...current, offices: Array.from(set) };
      });
    },
    [updateFilters]
  );

  const setSchedules = useCallback(
    (values: string[]) => {
      updateFilters((current) => ({ ...current, schedules: values }));
    },
    [updateFilters]
  );

  const clearSchedules = useCallback(() => {
    setSchedules([]);
  }, [setSchedules]);

  const toggleSchedule = useCallback(
    (value: string) => {
      updateFilters((current) => {
        const set = new Set(current.schedules);
        if (set.has(value)) {
          set.delete(value);
        } else {
          set.add(value);
        }
        return { ...current, schedules: Array.from(set) };
      });
    },
    [updateFilters]
  );

  const setShowUnmatched = useCallback(
    (value: boolean) => {
      updateFilters((current) => ({ ...current, showUnmatched: value }));
    },
    [updateFilters]
  );

  const setShowNoPunch = useCallback(
    (value: boolean) => {
      updateFilters((current) => ({ ...current, showNoPunch: value }));
    },
    [updateFilters]
  );

  const setMetricMode = useCallback(
    (mode: MetricMode) => {
      updateFilters((current) => ({ ...current, metricMode: mode }));
    },
    [updateFilters]
  );

  const setSort = useCallback(
    (config: Partial<{
      sortBy: SummarySortField;
      sortDir: SortDirection;
      secondarySortBy: SummarySortField | null;
      secondarySortDir: SortDirection;
    }>) => {
      updateFilters((current) => {
        const nextSortBy = config.sortBy ?? current.sortBy;
        const nextSortDir = config.sortDir
          ? config.sortDir
          : config.sortBy && config.sortBy !== current.sortBy
          ? DEFAULT_SUMMARY_FILTERS.sortDir
          : current.sortDir;

        let nextSecondary =
          config.secondarySortBy !== undefined ? config.secondarySortBy : current.secondarySortBy;
        if (nextSecondary === nextSortBy) {
          nextSecondary = null;
        }

        const nextSecondaryDir = nextSecondary
          ? config.secondarySortDir ?? current.secondarySortDir
          : DEFAULT_SUMMARY_FILTERS.secondarySortDir;

        return {
          ...current,
          sortBy: nextSortBy,
          sortDir: nextSortDir,
          secondarySortBy: nextSecondary,
          secondarySortDir: nextSecondary ? nextSecondaryDir : DEFAULT_SUMMARY_FILTERS.secondarySortDir,
        };
      });
    },
    [updateFilters]
  );

  const replaceFilters = useCallback(
    (values: Partial<SummaryFiltersState>) => {
      updateFilters((current) => ({ ...current, ...values }));
    },
    [updateFilters]
  );

  const togglePrimarySort = useCallback(
    (field: SummarySortField) => {
      updateFilters((current) => {
        const nextDir = current.sortBy === field && current.sortDir === "desc" ? "asc" : "desc";
        const nextSecondary = current.secondarySortBy === field ? null : current.secondarySortBy;
        return {
          ...current,
          sortBy: field,
          sortDir: nextDir,
          secondarySortBy: nextSecondary,
          secondarySortDir: nextSecondary ? current.secondarySortDir : DEFAULT_SUMMARY_FILTERS.secondarySortDir,
        };
      });
    },
    [updateFilters]
  );

  return {
    filters,
    setSearch,
    setHeads,
    toggleOffice,
    setOffices,
    clearOffices,
    toggleEmployeeType,
    setEmployeeTypes,
    clearEmployeeTypes,
    toggleSchedule,
    setSchedules,
    clearSchedules,
    setShowUnmatched,
    setShowNoPunch,
    setMetricMode,
    setSort,
    replaceFilters,
    togglePrimarySort,
  };
};

// Context + Provider so consumers can share a single memoized value tree-wide
const SummaryFiltersContext = createContext<UseSummaryFilters | null>(null);

export const SummaryFiltersProvider = ({ children }: { children: ReactNode }) => {
  const value = useSummaryFiltersInternal();
  return <SummaryFiltersContext.Provider value={value}>{children}</SummaryFiltersContext.Provider>;
};

// Public hook: use context if available, otherwise compute locally (backward compatible)
export const useSummaryFilters = (): UseSummaryFilters => {
  const ctx = useContext(SummaryFiltersContext);
  return ctx ?? useSummaryFiltersInternal();
};
