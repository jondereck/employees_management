"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  INSIGHTS_SETTINGS_KEY,
  type MetricMode,
} from "@/app/(dashboard)/[departmentId]/(routes)/tools/biometrics/insights-types";

type SortDirection = "asc" | "desc";
export type HeadsFilterValue = "all" | "heads" | "nonHeads";
export type SummarySortField =
  | "lateMetric"
  | "undertimeMetric"
  | "lateDays"
  | "undertimeDays"
  | "daysWithLogs"
  | "noPunchDays";

export type SummarySortSelection = {
  field: SummarySortField;
  direction: SortDirection;
};

export type SummaryFiltersState = {
  search: string;
  heads: HeadsFilterValue;
  offices: string[];
  schedules: string[];
  showUnmatched: boolean;
  showNoPunchColumn: boolean;
  metricMode: MetricMode;
  sort: {
    primary: SummarySortSelection;
    secondary: SummarySortSelection | null;
  };
};

type SummaryFiltersContextValue = {
  filters: SummaryFiltersState;
  setFilters: (updater: (prev: SummaryFiltersState) => SummaryFiltersState) => void;
  setSearch: (value: string) => void;
  setHeads: (value: HeadsFilterValue) => void;
  setMetricMode: (value: MetricMode) => void;
  setShowUnmatched: (value: boolean) => void;
  setShowNoPunchColumn: (value: boolean) => void;
  setOffices: (values: string[]) => void;
  toggleOffice: (value: string, checked: boolean) => void;
  setSchedules: (values: string[]) => void;
  toggleSchedule: (value: string, checked: boolean) => void;
  setSortPrimary: (selection: SummarySortSelection) => void;
  setSortSecondary: (selection: SummarySortSelection | null) => void;
};

const STORAGE_KEY = "hrps:bio:summary-filters";

const DEFAULT_FILTERS: SummaryFiltersState = {
  search: "",
  heads: "all",
  offices: [],
  schedules: [],
  showUnmatched: true,
  showNoPunchColumn: false,
  metricMode: "days",
  sort: {
    primary: { field: "lateDays", direction: "desc" },
    secondary: null,
  },
};

const SummaryFiltersContext = createContext<SummaryFiltersContextValue | null>(null);

const QUERY_KEYS = {
  search: "summarySearch",
  heads: "summaryHeads",
  offices: "summaryOffices",
  schedules: "summarySchedules",
  unmatched: "summaryUnmatched",
  noPunch: "summaryNoPunch",
  metric: "summaryMetric",
  sort: "summarySort",
  then: "summaryThen",
} as const;

const VALID_HEADS: HeadsFilterValue[] = ["all", "heads", "nonHeads"];
const VALID_METRICS: MetricMode[] = ["days", "minutes"];
const VALID_SORT_FIELDS: SummarySortField[] = [
  "lateMetric",
  "undertimeMetric",
  "lateDays",
  "undertimeDays",
  "daysWithLogs",
  "noPunchDays",
];
const VALID_SORT_DIRECTIONS: SortDirection[] = ["asc", "desc"];

const sanitizeSortSelection = (
  value: Partial<SummarySortSelection> | null | undefined,
  fallback: SummarySortSelection
): SummarySortSelection => {
  if (!value) return fallback;
  const field = VALID_SORT_FIELDS.includes(value.field as SummarySortField)
    ? (value.field as SummarySortField)
    : fallback.field;
  const direction = VALID_SORT_DIRECTIONS.includes(value.direction as SortDirection)
    ? (value.direction as SortDirection)
    : fallback.direction;
  return { field, direction };
};

const parseListParam = (value: string | null): string[] => {
  if (!value) return [];
  return value
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
};

const parseBooleanParam = (value: string | null, fallback: boolean): boolean => {
  if (value == null) return fallback;
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return fallback;
};

const parseHeadsParam = (value: string | null, fallback: HeadsFilterValue): HeadsFilterValue => {
  if (!value) return fallback;
  const normalized = value.toLowerCase();
  if (normalized === "heads") return "heads";
  if (normalized === "non" || normalized === "nonheads") return "nonHeads";
  if (normalized === "all") return "all";
  return fallback;
};

const parseMetricParam = (value: string | null, fallback: MetricMode): MetricMode => {
  if (!value) return fallback;
  const normalized = value.toLowerCase();
  if (normalized === "minutes") return "minutes";
  if (normalized === "days") return "days";
  return fallback;
};

const parseSortParam = (
  value: string | null,
  fallback: SummarySortSelection
): SummarySortSelection => {
  if (!value) return fallback;
  const [field, direction] = value.split(":");
  const normalizedField = VALID_SORT_FIELDS.includes(field as SummarySortField)
    ? (field as SummarySortField)
    : fallback.field;
  const normalizedDirection = VALID_SORT_DIRECTIONS.includes(direction as SortDirection)
    ? (direction as SortDirection)
    : fallback.direction;
  return { field: normalizedField, direction: normalizedDirection };
};

const serializeSortParam = (selection: SummarySortSelection) =>
  `${selection.field}:${selection.direction}`;

const readLegacyFilters = (): SummaryFiltersState | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(INSIGHTS_SETTINGS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as Record<string, unknown>;
    const offices = Array.isArray(candidate.selectedOffices)
      ? candidate.selectedOffices.filter((value): value is string => typeof value === "string")
      : undefined;
    const schedules = Array.isArray(candidate.selectedScheduleTypes)
      ? candidate.selectedScheduleTypes.filter((value): value is string => typeof value === "string")
      : undefined;
    const showUnmatched =
      typeof candidate.showUnmatched === "boolean"
        ? candidate.showUnmatched
        : DEFAULT_FILTERS.showUnmatched;
    const showNoPunchColumn =
      typeof candidate.showNoPunchColumn === "boolean"
        ? candidate.showNoPunchColumn
        : DEFAULT_FILTERS.showNoPunchColumn;
    const metricMode = parseMetricParam(
      typeof candidate.metricMode === "string" ? candidate.metricMode : null,
      DEFAULT_FILTERS.metricMode
    );

    return {
      ...DEFAULT_FILTERS,
      offices: offices ?? DEFAULT_FILTERS.offices,
      schedules: schedules ?? DEFAULT_FILTERS.schedules,
      showUnmatched,
      showNoPunchColumn,
      metricMode,
    };
  } catch (error) {
    console.warn("Failed to read legacy summary filters", error);
    return null;
  }
};

const readStoredFilters = (): SummaryFiltersState | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return readLegacyFilters();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as Partial<SummaryFiltersState>;
    return {
      ...DEFAULT_FILTERS,
      ...candidate,
      heads: VALID_HEADS.includes(candidate.heads as HeadsFilterValue)
        ? (candidate.heads as HeadsFilterValue)
        : DEFAULT_FILTERS.heads,
      metricMode: VALID_METRICS.includes(candidate.metricMode as MetricMode)
        ? (candidate.metricMode as MetricMode)
        : DEFAULT_FILTERS.metricMode,
      offices: Array.isArray(candidate.offices)
        ? candidate.offices.filter((value): value is string => typeof value === "string")
        : DEFAULT_FILTERS.offices,
      schedules: Array.isArray(candidate.schedules)
        ? candidate.schedules.filter((value): value is string => typeof value === "string")
        : DEFAULT_FILTERS.schedules,
      showUnmatched:
        typeof candidate.showUnmatched === "boolean"
          ? candidate.showUnmatched
          : DEFAULT_FILTERS.showUnmatched,
      showNoPunchColumn:
        typeof candidate.showNoPunchColumn === "boolean"
          ? candidate.showNoPunchColumn
          : DEFAULT_FILTERS.showNoPunchColumn,
      search: typeof candidate.search === "string" ? candidate.search : DEFAULT_FILTERS.search,
      sort: {
        primary: sanitizeSortSelection(candidate.sort?.primary, DEFAULT_FILTERS.sort.primary),
        secondary: candidate.sort?.secondary
          ? sanitizeSortSelection(candidate.sort.secondary, DEFAULT_FILTERS.sort.primary)
          : null,
      },
    };
  } catch (error) {
    console.warn("Failed to read summary filters", error);
    return readLegacyFilters();
  }
};

const applyParamsToFilters = (
  params: URLSearchParams,
  fallback: SummaryFiltersState
): SummaryFiltersState => {
  const search = params.get(QUERY_KEYS.search);
  const heads = params.get(QUERY_KEYS.heads);
  const offices = parseListParam(params.get(QUERY_KEYS.offices));
  const schedules = parseListParam(params.get(QUERY_KEYS.schedules));
  const unmatched = params.get(QUERY_KEYS.unmatched);
  const noPunch = params.get(QUERY_KEYS.noPunch);
  const metric = params.get(QUERY_KEYS.metric);
  const sort = params.get(QUERY_KEYS.sort);
  const then = params.get(QUERY_KEYS.then);

  return {
    search: search ?? fallback.search,
    heads: parseHeadsParam(heads, fallback.heads),
    offices: offices.length ? offices : fallback.offices,
    schedules: schedules.length ? schedules : fallback.schedules,
    showUnmatched: parseBooleanParam(unmatched, fallback.showUnmatched),
    showNoPunchColumn: parseBooleanParam(noPunch, fallback.showNoPunchColumn),
    metricMode: parseMetricParam(metric, fallback.metricMode),
    sort: {
      primary: parseSortParam(sort, fallback.sort.primary),
      secondary: then ? parseSortParam(then, fallback.sort.secondary ?? fallback.sort.primary) : null,
    },
  };
};

const filtersEqual = (a: SummaryFiltersState, b: SummaryFiltersState) => {
  if (a === b) return true;
  if (a.search !== b.search) return false;
  if (a.heads !== b.heads) return false;
  if (a.showUnmatched !== b.showUnmatched) return false;
  if (a.showNoPunchColumn !== b.showNoPunchColumn) return false;
  if (a.metricMode !== b.metricMode) return false;
  if (a.sort.primary.field !== b.sort.primary.field) return false;
  if (a.sort.primary.direction !== b.sort.primary.direction) return false;
  if (Boolean(a.sort.secondary) !== Boolean(b.sort.secondary)) return false;
  if (
    a.sort.secondary &&
    b.sort.secondary &&
    (a.sort.secondary.field !== b.sort.secondary.field ||
      a.sort.secondary.direction !== b.sort.secondary.direction)
  ) {
    return false;
  }
  if (a.offices.length !== b.offices.length) return false;
  if (a.schedules.length !== b.schedules.length) return false;
  for (let i = 0; i < a.offices.length; i += 1) {
    if (a.offices[i] !== b.offices[i]) return false;
  }
  for (let i = 0; i < a.schedules.length; i += 1) {
    if (a.schedules[i] !== b.schedules[i]) return false;
  }
  return true;
};

const persistFilters = (filters: SummaryFiltersState) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch (error) {
    console.warn("Failed to persist summary filters", error);
  }
};

const applyFiltersToParams = (
  filters: SummaryFiltersState,
  params: URLSearchParams
) => {
  if (filters.search.trim().length) {
    params.set(QUERY_KEYS.search, filters.search);
  } else {
    params.delete(QUERY_KEYS.search);
  }

  if (filters.heads !== DEFAULT_FILTERS.heads) {
    params.set(QUERY_KEYS.heads, filters.heads === "nonHeads" ? "non" : filters.heads);
  } else {
    params.delete(QUERY_KEYS.heads);
  }

  if (filters.offices.length) {
    params.set(QUERY_KEYS.offices, filters.offices.join(","));
  } else {
    params.delete(QUERY_KEYS.offices);
  }

  if (filters.schedules.length) {
    params.set(QUERY_KEYS.schedules, filters.schedules.join(","));
  } else {
    params.delete(QUERY_KEYS.schedules);
  }

  if (filters.showUnmatched !== DEFAULT_FILTERS.showUnmatched) {
    params.set(QUERY_KEYS.unmatched, filters.showUnmatched ? "1" : "0");
  } else {
    params.delete(QUERY_KEYS.unmatched);
  }

  if (filters.showNoPunchColumn !== DEFAULT_FILTERS.showNoPunchColumn) {
    params.set(QUERY_KEYS.noPunch, filters.showNoPunchColumn ? "1" : "0");
  } else {
    params.delete(QUERY_KEYS.noPunch);
  }

  if (filters.metricMode !== DEFAULT_FILTERS.metricMode) {
    params.set(QUERY_KEYS.metric, filters.metricMode);
  } else {
    params.delete(QUERY_KEYS.metric);
  }

  if (
    filters.sort.primary.field !== DEFAULT_FILTERS.sort.primary.field ||
    filters.sort.primary.direction !== DEFAULT_FILTERS.sort.primary.direction
  ) {
    params.set(QUERY_KEYS.sort, serializeSortParam(filters.sort.primary));
  } else {
    params.delete(QUERY_KEYS.sort);
  }

  if (filters.sort.secondary) {
    params.set(QUERY_KEYS.then, serializeSortParam(filters.sort.secondary));
  } else {
    params.delete(QUERY_KEYS.then);
  }
};

export const SummaryFiltersProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFiltersState] = useState<SummaryFiltersState>(() => {
    const stored = readStoredFilters() ?? DEFAULT_FILTERS;
    return applyParamsToFilters(new URLSearchParams(searchParams.toString()), stored);
  });

  const storedRef = useRef<SummaryFiltersState>(filters);

  useEffect(() => {
    const fallback = storedRef.current ?? DEFAULT_FILTERS;
    const next = applyParamsToFilters(new URLSearchParams(searchParams.toString()), fallback);
    if (!filtersEqual(next, filters)) {
      storedRef.current = next;
      setFiltersState(next);
      persistFilters(next);
    }
  }, [searchParams]);

  const updateFilters = useCallback(
    (updater: (prev: SummaryFiltersState) => SummaryFiltersState) => {
      setFiltersState((prev) => {
        const next = updater(prev);
        storedRef.current = next;
        persistFilters(next);
        const params = new URLSearchParams(searchParams.toString());
        applyFiltersToParams(next, params);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        return next;
      });
    },
    [pathname, router, searchParams]
  );

  const setSearch = useCallback(
    (value: string) => {
      updateFilters((prev) => ({ ...prev, search: value }));
    },
    [updateFilters]
  );

  const setHeads = useCallback(
    (value: HeadsFilterValue) => {
      updateFilters((prev) => ({ ...prev, heads: value }));
    },
    [updateFilters]
  );

  const setMetricMode = useCallback(
    (value: MetricMode) => {
      updateFilters((prev) => ({ ...prev, metricMode: value }));
    },
    [updateFilters]
  );

  const setShowUnmatched = useCallback(
    (value: boolean) => {
      updateFilters((prev) => ({ ...prev, showUnmatched: value }));
    },
    [updateFilters]
  );

  const setShowNoPunchColumn = useCallback(
    (value: boolean) => {
      updateFilters((prev) => ({ ...prev, showNoPunchColumn: value }));
    },
    [updateFilters]
  );

  const setOffices = useCallback(
    (values: string[]) => {
      updateFilters((prev) => ({ ...prev, offices: values }));
    },
    [updateFilters]
  );

  const toggleOffice = useCallback(
    (value: string, checked: boolean) => {
      updateFilters((prev) => {
        const set = new Set(prev.offices);
        if (checked) {
          set.add(value);
        } else {
          set.delete(value);
        }
        return { ...prev, offices: Array.from(set) };
      });
    },
    [updateFilters]
  );

  const setSchedules = useCallback(
    (values: string[]) => {
      updateFilters((prev) => ({ ...prev, schedules: values }));
    },
    [updateFilters]
  );

  const toggleSchedule = useCallback(
    (value: string, checked: boolean) => {
      updateFilters((prev) => {
        const set = new Set(prev.schedules);
        if (checked) {
          set.add(value);
        } else {
          set.delete(value);
        }
        return { ...prev, schedules: Array.from(set) };
      });
    },
    [updateFilters]
  );

  const setSortPrimary = useCallback(
    (selection: SummarySortSelection) => {
      updateFilters((prev) => {
        const sanitized = sanitizeSortSelection(selection, prev.sort.primary);
        const secondary =
          prev.sort.secondary &&
          prev.sort.secondary.field === sanitized.field &&
          prev.sort.secondary.direction === sanitized.direction
            ? null
            : prev.sort.secondary;
        return {
          ...prev,
          sort: {
            primary: sanitized,
            secondary,
          },
        };
      });
    },
    [updateFilters]
  );

  const setSortSecondary = useCallback(
    (selection: SummarySortSelection | null) => {
      updateFilters((prev) => ({
        ...prev,
        sort: {
          ...prev.sort,
          secondary: selection ? sanitizeSortSelection(selection, prev.sort.primary) : null,
        },
      }));
    },
    [updateFilters]
  );

  const contextValue = useMemo<SummaryFiltersContextValue>(
    () => ({
      filters,
      setFilters: updateFilters,
      setSearch,
      setHeads,
      setMetricMode,
      setShowUnmatched,
      setShowNoPunchColumn,
      setOffices,
      toggleOffice,
      setSchedules,
      toggleSchedule,
      setSortPrimary,
      setSortSecondary,
    }),
    [
      filters,
      setHeads,
      setMetricMode,
      setOffices,
      setSchedules,
      setSearch,
      setShowNoPunchColumn,
      setShowUnmatched,
      setSortPrimary,
      setSortSecondary,
      toggleOffice,
      toggleSchedule,
      updateFilters,
    ]
  );

  return <SummaryFiltersContext.Provider value={contextValue}>{children}</SummaryFiltersContext.Provider>;
};

export const useSummaryFilters = () => {
  const context = useContext(SummaryFiltersContext);
  if (!context) {
    throw new Error("useSummaryFilters must be used within a SummaryFiltersProvider");
  }
  return context;
};

export const SUMMARY_DEFAULTS = DEFAULT_FILTERS;
