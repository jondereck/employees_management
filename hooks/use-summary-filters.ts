"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  DEFAULT_SUMMARY_FILTERS,
  HEADS_FILTER_URL_VALUE,
  SUMMARY_FILTERS_STORAGE_KEY,
  SUMMARY_FILTER_QUERY_KEYS,
  areSummaryFiltersEqual,
  isSortKey,
  parseHeadsFilterParam,
  sanitizeSortKeyForMetric,
  sanitizeSummaryFilters,
  type HeadsFilterValue,
  type SortDirection,
  type SortKey,
  type SummaryFiltersState,
} from "@/app/(dashboard)/[departmentId]/(routes)/tools/biometrics/summaryFilters";

type SummaryFiltersUpdate = Partial<SummaryFiltersState> | ((prev: SummaryFiltersState) => SummaryFiltersState);

const readStoredFilters = (): SummaryFiltersState | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SUMMARY_FILTERS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SummaryFiltersState> | null;
    if (!parsed || typeof parsed !== "object") return null;
    return sanitizeSummaryFilters({ ...DEFAULT_SUMMARY_FILTERS, ...parsed });
  } catch (error) {
    console.warn("Failed to parse summary filters from storage", error);
    return null;
  }
};

const parseListParam = (value: string | null | undefined): string[] => {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const parseBooleanParam = (value: string | null | undefined, defaultValue: boolean): boolean => {
  if (value === null || value === undefined) return defaultValue;
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return defaultValue;
};

const parseFiltersFromParams = (
  params: ReturnType<typeof useSearchParams>,
  stored: SummaryFiltersState | null
): SummaryFiltersState => {
  const base = stored ?? DEFAULT_SUMMARY_FILTERS;
  const next: SummaryFiltersState = {
    ...DEFAULT_SUMMARY_FILTERS,
    ...base,
  };

  const getParam = (key: keyof typeof SUMMARY_FILTER_QUERY_KEYS) =>
    params?.get(SUMMARY_FILTER_QUERY_KEYS[key]) ?? null;

  const search = getParam("search");
  if (search !== null) {
    next.search = search;
  }

  const heads = parseHeadsFilterParam(getParam("heads"));
  if (heads) {
    next.heads = heads;
  }

  const offices = parseListParam(getParam("offices"));
  if (offices.length) {
    next.offices = offices;
  } else if (params?.has(SUMMARY_FILTER_QUERY_KEYS.offices)) {
    next.offices = [];
  }

  const schedules = parseListParam(getParam("schedules"));
  if (schedules.length) {
    next.schedules = schedules;
  } else if (params?.has(SUMMARY_FILTER_QUERY_KEYS.schedules)) {
    next.schedules = [];
  }

  next.showUnmatched = parseBooleanParam(getParam("showUnmatched"), next.showUnmatched);
  next.showNoPunch = parseBooleanParam(getParam("showNoPunch"), next.showNoPunch);

  const metricParam = getParam("metricMode");
  if (metricParam === "minutes" || metricParam === "days") {
    next.metricMode = metricParam;
  }

  const primarySort = getParam("sortBy");
  if (isSortKey(primarySort)) {
    next.sortBy = sanitizeSortKeyForMetric(primarySort, next.metricMode);
  }

  const primaryDir = getParam("sortDir");
  if (primaryDir === "asc" || primaryDir === "desc") {
    next.sortDir = primaryDir;
  }

  const secondarySort = getParam("thenBy");
  if (isSortKey(secondarySort)) {
    next.thenBy = sanitizeSortKeyForMetric(secondarySort, next.metricMode);
  } else if (params?.has(SUMMARY_FILTER_QUERY_KEYS.thenBy)) {
    next.thenBy = null;
  }

  const secondaryDir = getParam("thenDir");
  if (secondaryDir === "asc" || secondaryDir === "desc") {
    next.thenDir = secondaryDir;
  }

  return sanitizeSummaryFilters(next);
};

const buildSearchParams = (
  params: ReturnType<typeof useSearchParams>,
  next: SummaryFiltersState
) => {
  const query = new URLSearchParams(params ? params.toString() : undefined);

  const assign = (key: keyof typeof SUMMARY_FILTER_QUERY_KEYS, value: string | null) => {
    const paramKey = SUMMARY_FILTER_QUERY_KEYS[key];
    if (value === null || value.length === 0) {
      query.delete(paramKey);
    } else {
      query.set(paramKey, value);
    }
  };

  assign("search", next.search.trim().length ? next.search.trim() : null);
  assign("heads", next.heads === DEFAULT_SUMMARY_FILTERS.heads ? null : HEADS_FILTER_URL_VALUE[next.heads]);
  assign("offices", next.offices.length ? next.offices.join(",") : null);
  assign("schedules", next.schedules.length ? next.schedules.join(",") : null);
  assign("showUnmatched", next.showUnmatched === true ? null : "0");
  assign("showNoPunch", next.showNoPunch ? "1" : null);
  assign("metricMode", next.metricMode);
  assign("sortBy", next.sortBy);
  assign("sortDir", next.sortDir);
  assign("thenBy", next.thenBy);
  assign("thenDir", next.thenBy ? next.thenDir : null);

  return query;
};

export const useSummaryFilters = () => {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const storedRef = useRef<SummaryFiltersState | null>(null);
  if (storedRef.current === null) {
    storedRef.current = readStoredFilters();
  }

  const filters = useMemo(() => parseFiltersFromParams(params, storedRef.current), [params]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SUMMARY_FILTERS_STORAGE_KEY, JSON.stringify(filters));
      storedRef.current = filters;
    } catch (error) {
      console.warn("Failed to persist summary filters", error);
    }
  }, [filters]);

  const persist = useCallback(
    (next: SummaryFiltersState) => {
      if (!pathname) return;
      const sanitized = sanitizeSummaryFilters(next);
      if (areSummaryFiltersEqual(filters, sanitized)) return;

      const query = buildSearchParams(params, sanitized);
      const current = params?.toString() ?? "";
      const nextQuery = query.toString();
      if (current === nextQuery) return;

      const url = nextQuery ? `${pathname}?${nextQuery}` : pathname;
      router.replace(url, { scroll: false });
    },
    [filters, params, pathname, router]
  );

  const applyUpdate = useCallback(
    (update: SummaryFiltersUpdate) => {
      const next = typeof update === "function" ? update(filters) : { ...filters, ...update };
      persist(next);
    },
    [filters, persist]
  );

  const setSearch = useCallback((value: string) => applyUpdate({ search: value }), [applyUpdate]);

  const setHeads = useCallback(
    (value: HeadsFilterValue) => {
      applyUpdate({ heads: value ?? DEFAULT_SUMMARY_FILTERS.heads });
    },
    [applyUpdate]
  );

  const toggleOffice = useCallback(
    (key: string) => {
      applyUpdate((prev) => {
        const set = new Set(prev.offices);
        if (set.has(key)) {
          set.delete(key);
        } else {
          set.add(key);
        }
        return { ...prev, offices: Array.from(set) };
      });
    },
    [applyUpdate]
  );

  const setOffices = useCallback(
    (next: string[]) => {
      applyUpdate({ offices: next });
    },
    [applyUpdate]
  );

  const toggleSchedule = useCallback(
    (value: string) => {
      applyUpdate((prev) => {
        const set = new Set(prev.schedules);
        if (set.has(value)) {
          set.delete(value);
        } else {
          set.add(value);
        }
        return { ...prev, schedules: Array.from(set) };
      });
    },
    [applyUpdate]
  );

  const setSchedules = useCallback(
    (next: string[]) => {
      applyUpdate({ schedules: next });
    },
    [applyUpdate]
  );

  const setShowUnmatched = useCallback(
    (value: boolean) => {
      applyUpdate({ showUnmatched: value });
    },
    [applyUpdate]
  );

  const setShowNoPunch = useCallback(
    (value: boolean) => {
      applyUpdate({ showNoPunch: value });
    },
    [applyUpdate]
  );

  const setMetricMode = useCallback(
    (mode: SummaryFiltersState["metricMode"]) => {
      applyUpdate((prev) => {
        const metricMode = mode === "minutes" ? "minutes" : "days";
        const sortBy = sanitizeSortKeyForMetric(prev.sortBy, metricMode);
        let thenBy = prev.thenBy ? sanitizeSortKeyForMetric(prev.thenBy, metricMode) : null;
        if (thenBy === sortBy) {
          thenBy = null;
        }
        return { ...prev, metricMode, sortBy, thenBy };
      });
    },
    [applyUpdate]
  );

  const setPrimarySort = useCallback(
    (key: SortKey, direction?: SortDirection) => {
      applyUpdate((prev) => {
        const sortBy = sanitizeSortKeyForMetric(key, prev.metricMode);
        const sortDir = direction ?? (prev.sortBy === sortBy ? prev.sortDir : "desc");
        const thenBy = prev.thenBy === sortBy ? null : prev.thenBy;
        return { ...prev, sortBy, sortDir, thenBy };
      });
    },
    [applyUpdate]
  );

  const setPrimaryDir = useCallback(
    (direction: SortDirection) => {
      applyUpdate({ sortDir: direction });
    },
    [applyUpdate]
  );

  const setSecondarySort = useCallback(
    (key: SortKey | null, direction?: SortDirection) => {
      applyUpdate((prev) => {
        if (!key) {
          return { ...prev, thenBy: null };
        }
        const nextKey = sanitizeSortKeyForMetric(key, prev.metricMode);
        if (nextKey === prev.sortBy) {
          return { ...prev, thenBy: null };
        }
        const nextDir = direction ?? prev.thenDir ?? "desc";
        return { ...prev, thenBy: nextKey, thenDir: nextDir };
      });
    },
    [applyUpdate]
  );

  const setSecondaryDir = useCallback(
    (direction: SortDirection) => {
      applyUpdate((prev) => {
        if (!prev.thenBy) return prev;
        return { ...prev, thenDir: direction };
      });
    },
    [applyUpdate]
  );

  return {
    filters,
    setSearch,
    setHeads,
    toggleOffice,
    setOffices,
    toggleSchedule,
    setSchedules,
    setShowUnmatched,
    setShowNoPunch,
    setMetricMode,
    setPrimarySort,
    setPrimaryDir,
    setSecondarySort,
    setSecondaryDir,
  };
};

export type UseSummaryFiltersReturn = ReturnType<typeof useSummaryFilters>;

