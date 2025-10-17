"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  ArrowUpDown,
  CheckCircle2,
  Columns,
  FileDown,
  Info,
  Loader2,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  exportResultsToXlsx,
  detectWorkbookParsers,
  mergeParsedWorkbooks,
  parseBioAttendance,
  sortPerDayRows,
  type DayPunch,
  type MergeResult,
  type ParseWarning,
  type ParsedPerDayRow,
  type ParsedWorkbook,
  type PerDayRow,
  type PerEmployeeRow,
  type WorkbookParserType,
  type UnmatchedIdentityWarningDetail,
} from "@/utils/parseBioAttendance";
import {
  EXPORT_COLUMNS_STORAGE_KEY,
  formatScheduleSource,
  OFFICE_FILTER_STORAGE_KEY,
  UNASSIGNED_OFFICE_LABEL,
  UNKNOWN_OFFICE_KEY_PREFIX,
  UNKNOWN_OFFICE_LABEL,
  UNMATCHED_LABEL,
  normalizeBiometricToken,
} from "@/utils/biometricsShared";
import {
  ALL_SUMMARY_COLUMN_KEYS,
  DEFAULT_SUMMARY_COLUMN_ORDER,
  DEFAULT_SUMMARY_SELECTED_COLUMNS,
  SUMMARY_COLUMN_DEFINITION_MAP,
  SUMMARY_COLUMN_DEFINITIONS,
  SUMMARY_COLUMN_GROUP_LABEL,
  type SummaryColumnKey,
} from "@/utils/biometricsExportConfig";
import {
  expandWindows,
  normalizeTimelineSegments,
  toMinutes,
  type WeeklyPatternWindow,
} from "@/utils/weeklyPattern";
import InsightsPanel from "./InsightsPanel";
import ResolveIdentityDialog, { ResolveSearchResult } from "./ResolveIdentityDialog";
import OfficeFilterControl from "./OfficeFilterControl";
import SummaryColumnSelector from "./SummaryColumnSelector";
import {
  ALL_CHART_IDS,
  DEFAULT_VISIBLE_CHARTS,
  INSIGHTS_SETTINGS_KEY,
  type ChartId,
  type InsightsSettings,
  type MetricMode,
} from "./insights-types";

const PAGE_SIZE = 25;

const MINUTES_IN_DAY = 24 * 60;

const SUMMARY_METRIC_MODE_KEY = "hrps-bio-summary-metric-mode";

const APP_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION ??
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
  "dev";

const formatTimelineLabel = (segments: { start: string; end: string }[]) => {
  if (!segments.length) return "none";
  return segments.map((segment) => `${segment.start}–${segment.end}`).join(", ");
};

type WeeklyPatternTimelineProps = {
  applied?: boolean;
  windows?: WeeklyPatternWindow[] | null;
  presence?: { start: string; end: string }[] | null;
};

const WeeklyPatternTimeline = ({ applied, windows, presence }: WeeklyPatternTimelineProps) => {
  const activeWindows = windows && windows.length > 0 ? windows : null;

  if (!applied || !activeWindows) {
    return <span className="text-muted-foreground">—</span>;
  }

  const windowSegments = normalizeTimelineSegments(expandWindows(activeWindows));
  const presenceSegments = normalizeTimelineSegments(
    (presence ?? []).map((segment) => ({
      start: toMinutes(segment.start),
      end: toMinutes(segment.end),
    }))
  );

  const presenceLabel = formatTimelineLabel(presence ?? []);
  const windowsLabel = formatTimelineLabel(activeWindows);

  return (
    <div className="relative h-8 w-full rounded border border-border bg-muted/20">
      {windowSegments.map((segment, index) => (
        <div
          key={`window-${index}`}
          className="absolute inset-y-0 bg-primary/20"
          style={{
            left: `${(segment.start / MINUTES_IN_DAY) * 100}%`,
            width: `${((segment.end - segment.start) / MINUTES_IN_DAY) * 100}%`,
          }}
        />
      ))}
      {presenceSegments.map((segment, index) => (
        <div
          key={`presence-${index}`}
          className="absolute top-1/4 h-1/2 rounded-full bg-primary"
          style={{
            left: `${(segment.start / MINUTES_IN_DAY) * 100}%`,
            width: `${Math.max(1, ((segment.end - segment.start) / MINUTES_IN_DAY) * 100)}%`,
          }}
        />
      ))}
      <span className="sr-only">
        Weekly pattern windows: {windowsLabel}. Presence within windows: {presenceLabel}.
      </span>
    </div>
  );
};

const formatBytes = (value: number) => {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const toDate = (iso: string) => new Date(`${iso}T00:00:00+08:00`);

const formatScheduleType = (value?: string | null) => {
  if (!value) return null;
  return value.charAt(0) + value.slice(1).toLowerCase();
};

const isUnmatchedIdentity = (
  status: PerEmployeeRow["identityStatus"] | undefined,
  resolvedEmployeeId?: string | null
) => status === "unmatched" && !resolvedEmployeeId;

const computeLatePercentMinutes = (row: PerEmployeeRow): number | null => {
  if (!row.totalRequiredMinutes || row.totalRequiredMinutes <= 0) return null;
  const total = row.totalLateMinutes ?? 0;
  if (total <= 0) return 0;
  return (total / row.totalRequiredMinutes) * 100;
};

const computeUndertimePercentMinutes = (row: PerEmployeeRow): number | null => {
  if (!row.totalRequiredMinutes || row.totalRequiredMinutes <= 0) return null;
  const total = row.totalUndertimeMinutes ?? 0;
  if (total <= 0) return 0;
  return (total / row.totalRequiredMinutes) * 100;
};

const formatPercentLabel = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
};

const getSortValue = (row: PerEmployeeRow, key: SortKey): number => {
  switch (key) {
    case "daysWithLogs":
      return row.daysWithLogs ?? 0;
    case "lateDays":
      return row.lateDays ?? 0;
    case "undertimeDays":
      return row.undertimeDays ?? 0;
    case "totalLateMinutes":
      return row.totalLateMinutes ?? 0;
    case "totalUndertimeMinutes":
      return row.totalUndertimeMinutes ?? 0;
    case "latePercent":
      return computeLatePercentMinutes(row) ?? Number.NEGATIVE_INFINITY;
    case "undertimePercent":
      return computeUndertimePercentMinutes(row) ?? Number.NEGATIVE_INFINITY;
    default:
      return 0;
  }
};

const timeout = <T,>(promise: Promise<T>, ms = 15_000) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Request timed out"));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });

const pad2 = (value: number) => String(value).padStart(2, "0");

const MANUAL_STORAGE_KEY = "biometrics-uploader-period";
const MANUAL_RESOLVED_STORAGE_PREFIX = "hrps:manual-resolved";

const manualMonthOptions = [
  { value: "1", label: "Jan" },
  { value: "2", label: "Feb" },
  { value: "3", label: "Mar" },
  { value: "4", label: "Apr" },
  { value: "5", label: "May" },
  { value: "6", label: "Jun" },
  { value: "7", label: "Jul" },
  { value: "8", label: "Aug" },
  { value: "9", label: "Sep" },
  { value: "10", label: "Oct" },
  { value: "11", label: "Nov" },
  { value: "12", label: "Dec" },
];

const manualPeriodFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
});

const IDENTITY_REQUEST_LIMIT = 2000;
const MAX_WARNING_SAMPLE_COUNT = 10;
const UNMATCHED_WARNING_DISPLAY_LIMIT = 3;

const sortPunchesChronologically = (punches: DayPunch[]): DayPunch[] =>
  [...punches].sort((a, b) => a.minuteOfDay - b.minuteOfDay || a.time.localeCompare(b.time));

const toChronologicalRow = <T extends {
  punches: DayPunch[];
  allTimes: string[];
  earliest: string | null;
  latest: string | null;
}>(row: T): T => {
  const punches = sortPunchesChronologically(row.punches);
  const allTimes = punches.map((punch) => punch.time);
  return {
    ...row,
    punches,
    allTimes,
    earliest: allTimes[0] ?? null,
    latest: allTimes.length ? allTimes[allTimes.length - 1] : null,
  } as T;
};

const composeManualDate = (year: number, month: number, day: number): string | null => {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
};

type ManualPeriodSelection = {
  month: number;
  year: number;
};

type OutOfPeriodRow = {
  employeeId: string;
  employeeName: string;
  dateISO: string;
  sourceFiles: string[];
  reason: "outside-period" | "invalid-day";
};

type SortKey =
  | "daysWithLogs"
  | "lateDays"
  | "undertimeDays"
  | "totalLateMinutes"
  | "totalUndertimeMinutes"
  | "latePercent"
  | "undertimePercent";
type SortDirection = "asc" | "desc";

type FileStatus = "queued" | "parsing" | "parsed" | "failed";

type FileState = {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: FileStatus;
  parsed?: ParsedWorkbook;
  error?: string;
  parserType?: WorkbookParserType;
  parserTypes?: WorkbookParserType[];
  parserLabel?: string | null;
  parseSummary?: { employees: number; punches: number };
};

type IdentityRecord = {
  status: "matched" | "unmatched" | "ambiguous";
  employeeId: string | null;
  employeeName: string;
  officeId: string | null;
  officeName: string;
  candidates?: string[];
  missingOffice?: boolean;
};

type IdentityStatus = {
  status: "idle" | "resolving" | "resolved" | "error";
  total: number;
  completed: number;
  unmatched: number;
  message?: string;
};

type OfficeOption = {
  key: string;
  label: string;
  count: number;
};

const makeOfficeKey = (officeId: string | null | undefined, officeName: string | null | undefined) => {
  if (officeId) return officeId;
  const label = officeName && officeName.trim().length ? officeName.trim() : UNKNOWN_OFFICE_LABEL;
  return `${UNKNOWN_OFFICE_KEY_PREFIX}${label}`;
};

const getOfficeLabelFromKey = (key: string): string | null => {
  if (key.startsWith(UNKNOWN_OFFICE_KEY_PREFIX)) {
    return key.slice(UNKNOWN_OFFICE_KEY_PREFIX.length);
  }
  return null;
};

const getEmployeeOfficeKey = (
  row: Pick<PerEmployeeRow, "officeId" | "officeName" | "resolvedEmployeeId">
): string => {
  const label = row.officeName && row.officeName.trim().length
    ? row.officeName.trim()
    : row.resolvedEmployeeId
    ? UNASSIGNED_OFFICE_LABEL
    : UNKNOWN_OFFICE_LABEL;
  return makeOfficeKey(row.officeId ?? null, label);
};

const getDayOfficeKey = (
  row: Pick<PerDayRow, "officeId" | "officeName" | "resolvedEmployeeId">
): string => {
  const label = row.officeName && row.officeName.trim().length
    ? row.officeName.trim()
    : row.resolvedEmployeeId
    ? UNASSIGNED_OFFICE_LABEL
    : UNKNOWN_OFFICE_LABEL;
  return makeOfficeKey(row.officeId ?? null, label);
};

const readStoredOfficeFilter = (): string[] | undefined => {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(OFFICE_FILTER_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    const filtered = parsed.filter((value): value is string => typeof value === "string");
    return filtered.length ? filtered : undefined;
  } catch (error) {
    console.warn("Failed to read office filter", error);
    return undefined;
  }
};

type StoredColumnSettings = {
  order: SummaryColumnKey[];
  selected: SummaryColumnKey[];
};

const isSummaryColumnKey = (value: unknown): value is SummaryColumnKey =>
  typeof value === "string" && (ALL_SUMMARY_COLUMN_KEYS as string[]).includes(value as SummaryColumnKey);

const sanitizeColumnSettings = (settings?: StoredColumnSettings | null): StoredColumnSettings => {
  const providedOrder = (settings?.order ?? []).filter(isSummaryColumnKey);
  const providedSelected = (settings?.selected ?? []).filter(isSummaryColumnKey);

  const order = [...providedOrder];
  for (const key of ALL_SUMMARY_COLUMN_KEYS) {
    if (!order.includes(key)) order.push(key);
  }

  const selectedSet = new Set(
    providedSelected.length ? providedSelected : DEFAULT_SUMMARY_SELECTED_COLUMNS
  );
  const selected = order.filter((key) => selectedSet.has(key));
  if (!selected.length) {
    for (const key of DEFAULT_SUMMARY_SELECTED_COLUMNS) {
      if (order.includes(key)) selected.push(key);
    }
  }

  return { order, selected };
};

const readStoredColumns = (): StoredColumnSettings | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(EXPORT_COLUMNS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredColumnSettings> | null;
    if (!parsed || typeof parsed !== "object") return null;
    return sanitizeColumnSettings(parsed as StoredColumnSettings);
  } catch (error) {
    console.warn("Failed to read export column settings", error);
    return null;
  }
};

const normalizeIdentityRecord = (record?: IdentityRecord | null): IdentityRecord => {
  if (!record) {
    return {
      status: "unmatched",
      employeeId: null,
      employeeName: UNMATCHED_LABEL,
      officeId: null,
      officeName: UNKNOWN_OFFICE_LABEL,
    };
  }

  const status = record.status ?? "matched";
  const employeeName = record.employeeName?.trim();
  const officeName = record.officeName?.trim();

  if (status === "unmatched") {
    return {
      status: "unmatched",
      employeeId: null,
      employeeName: employeeName && employeeName.length ? employeeName : UNMATCHED_LABEL,
      officeId: null,
      officeName: UNKNOWN_OFFICE_LABEL,
    };
  }

  return {
    status,
    employeeId: record.employeeId ?? null,
    employeeName: employeeName && employeeName.length ? employeeName : UNMATCHED_LABEL,
    officeId: record.officeId ?? null,
    officeName: officeName && officeName.length ? officeName : UNASSIGNED_OFFICE_LABEL,
    candidates:
      status === "ambiguous" && record.candidates && record.candidates.length
        ? [...record.candidates]
        : undefined,
    missingOffice: record.missingOffice,
  };
};

const countUnmatchedIdentities = (map: Map<string, IdentityRecord>): number => {
  let count = 0;
  for (const entry of map.values()) {
    if (entry.status === "unmatched") count += 1;
  }
  return count;
};

const isChartId = (value: unknown): value is ChartId =>
  typeof value === "string" && ALL_CHART_IDS.includes(value as ChartId);

const readInsightsSettings = (): InsightsSettings => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(INSIGHTS_SETTINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as InsightsSettings;
    if (!parsed || typeof parsed !== "object") return {};

    const storedOffices = readStoredOfficeFilter();
    const selectedOffices = storedOffices
      ? storedOffices
      : Array.isArray(parsed.selectedOffices)
      ? parsed.selectedOffices.filter((value): value is string => typeof value === "string")
      : undefined;
    const selectedScheduleTypes = Array.isArray(parsed.selectedScheduleTypes)
      ? parsed.selectedScheduleTypes.filter((value): value is string => typeof value === "string")
      : undefined;
    const showUnmatched = typeof parsed.showUnmatched === "boolean" ? parsed.showUnmatched : undefined;
    const metricMode: MetricMode | undefined = parsed.metricMode === "minutes"
      ? "minutes"
      : parsed.metricMode === "days"
      ? "days"
      : undefined;
    const visibleCharts = Array.isArray(parsed.visibleCharts)
      ? (parsed.visibleCharts.filter(isChartId) as ChartId[])
      : undefined;
    const collapsed = typeof parsed.collapsed === "boolean" ? parsed.collapsed : undefined;
    const showNoPunchColumn =
      typeof parsed.showNoPunchColumn === "boolean" ? parsed.showNoPunchColumn : undefined;

    return {
      selectedOffices,
      selectedScheduleTypes,
      showUnmatched,
      metricMode,
      visibleCharts,
      collapsed,
      showNoPunchColumn,
    } satisfies InsightsSettings;
  } catch (error) {
    console.warn("Failed to read insights settings", error);
    return {};
  }
};

const computeIdentityWarnings = (
  rows: ParsedPerDayRow[],
  identityMap: Map<string, IdentityRecord>,
  status: IdentityStatus["status"]
): ParseWarning[] => {
  if (!rows.length) return [];
  if (status === "resolving") return [];

  const unmatchedSamples = new Map<string, Set<string>>();
  const unmatchedDetails: UnmatchedIdentityWarningDetail[] = [];
  const ambiguous = new Map<string, string[]>();
  const missingOffice = new Map<string, string>();

  for (const row of rows) {
    const token = row.employeeToken || row.employeeId || row.employeeName;
    if (!token) continue;
    const identity = identityMap.get(token);
    if (!identity) continue;

    if (identity.status === "unmatched") {
      let entry = unmatchedSamples.get(token);
      if (!entry) {
        entry = new Set<string>();
        unmatchedSamples.set(token, entry);
      }

      if (row.employeeId) {
        entry.add(row.employeeId);
      }

      continue;
    }

    if (identity.status === "ambiguous" && identity.candidates?.length) {
      if (!ambiguous.has(token)) {
        ambiguous.set(token, [...identity.candidates]);
      }
    }

    if (identity.missingOffice) {
      if (!missingOffice.has(token)) {
        missingOffice.set(token, identity.employeeName);
      }
    }
  }

  const warnings: ParseWarning[] = [];

  if (unmatchedSamples.size) {
    for (const [token, employeeIdsSet] of unmatchedSamples.entries()) {
      const employeeIds = Array.from(employeeIdsSet).filter(Boolean);
      unmatchedDetails.push({
        token,
        employeeIds,
      });
      if (unmatchedDetails.length >= MAX_WARNING_SAMPLE_COUNT) break;
    }

    warnings.push({
      type: "GENERAL",
      level: "warning",
      message: `Unmatched employees (${unmatchedSamples.size})`,
      count: unmatchedSamples.size,
      unmatchedIdentities: unmatchedDetails,
    });
  }

  if (ambiguous.size) {
    const samples = Array.from(ambiguous.entries()).map(
      ([token, names]) => `${token}: ${names.join(" | ")}`
    );
    warnings.push({
      type: "GENERAL",
      level: "warning",
      message: `Ambiguous employee tokens (${ambiguous.size})`,
      count: ambiguous.size,
      samples: samples.slice(0, MAX_WARNING_SAMPLE_COUNT),
    });
  }

  if (missingOffice.size) {
    const samples = Array.from(missingOffice.entries()).map(
      ([token, name]) => `${token}: ${name} (${UNASSIGNED_OFFICE_LABEL})`
    );
    warnings.push({
      type: "GENERAL",
      level: "warning",
      message: `Employees without assigned office (${missingOffice.size})`,
      count: missingOffice.size,
      samples: samples.slice(0, MAX_WARNING_SAMPLE_COUNT),
    });
  }

  return warnings;
};

const createFileId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

const mergeLimitedUnique = (base: string[], additions: string[], limit: number) => {
  if (base.length >= limit) return base.slice(0, limit);
  const seen = new Set(base);
  const next = [...base];
  for (const value of additions) {
    if (seen.has(value)) continue;
    next.push(value);
    seen.add(value);
    if (next.length >= limit) break;
  }
  return next.slice(0, limit);
};

const aggregateWarnings = (sources: ParseWarning[][]): ParseWarning[] => {
  const map = new Map<string, ParseWarning>();

  for (const list of sources) {
    for (const warning of list) {
      const key = `${warning.type}:${warning.message}`;
      const existing = map.get(key);
      if (existing) {
        const combinedCount = (existing.count ?? 0) + (warning.count ?? 0);
        existing.count = combinedCount || undefined;
        if (existing.level !== "warning" && warning.level === "warning") {
          existing.level = "warning";
        }
        if (warning.samples?.length) {
          const samples = new Set(existing.samples ?? []);
          for (const sample of warning.samples) {
            if (samples.size >= MAX_WARNING_SAMPLE_COUNT) break;
            samples.add(sample);
          }
          existing.samples = Array.from(samples);
        }
        if (warning.unmatchedIdentities?.length) {
          const currentDetails = existing.unmatchedIdentities
            ? [...existing.unmatchedIdentities]
            : [];
          const byToken = new Map(
            currentDetails.map((detail) => [detail.token, detail])
          );

          for (const detail of warning.unmatchedIdentities) {
            const existingDetail = byToken.get(detail.token);
            if (existingDetail) {
              existingDetail.employeeIds = mergeLimitedUnique(
                existingDetail.employeeIds,
                detail.employeeIds,
                MAX_WARNING_SAMPLE_COUNT
              );
            } else if (currentDetails.length < MAX_WARNING_SAMPLE_COUNT) {
              const clone = {
                token: detail.token,
                employeeIds: detail.employeeIds.slice(
                  0,
                  MAX_WARNING_SAMPLE_COUNT
                ),
              };
              currentDetails.push(clone);
              byToken.set(detail.token, clone);
            }
          }

          existing.unmatchedIdentities = currentDetails.slice(
            0,
            MAX_WARNING_SAMPLE_COUNT
          );
        }
      } else {
        map.set(key, {
          type: warning.type,
          level: warning.level,
          message: warning.message,
          count: warning.count,
          samples: warning.samples ? [...warning.samples] : undefined,
          unmatchedIdentities: warning.unmatchedIdentities
            ? warning.unmatchedIdentities.map((detail) => ({
                token: detail.token,
                employeeIds: detail.employeeIds.slice(
                  0,
                  MAX_WARNING_SAMPLE_COUNT
                ),
              }))
            : undefined,
        });
      }
    }
  }

  return Array.from(map.values());
};

const formatDateRange = (range: MergeResult["dateRange"]) => {
  if (!range) return "—";
  const start = dateFormatter.format(toDate(range.start));
  const end = dateFormatter.format(toDate(range.end));
  return start === end ? start : `${start} – ${end}`;
};

export default function BioLogUploader() {
  const { toast } = useToast();
  const params = useParams<{ departmentId: string }>();
  const departmentId = params?.departmentId ?? "unknown";
  const settingsRef = useRef<InsightsSettings | null>(null);
  if (settingsRef.current === null && typeof window !== "undefined") {
    settingsRef.current = readInsightsSettings();
  }
  const columnSettingsRef = useRef<StoredColumnSettings | null>(null);
  if (columnSettingsRef.current === null && typeof window !== "undefined") {
    columnSettingsRef.current = readStoredColumns();
  }
  const initialColumnSettings = sanitizeColumnSettings(columnSettingsRef.current);

  const [files, setFiles] = useState<FileState[]>([]);
  const [perEmployee, setPerEmployee] = useState<PerEmployeeRow[] | null>(null);
  const [perDay, setPerDay] = useState<PerDayRow[] | null>(null);
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("lateDays");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [isDragging, setIsDragging] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [showMixedMonthsPrompt, setShowMixedMonthsPrompt] = useState(false);
  const [mixedMonthsContext, setMixedMonthsContext] = useState<{
    key: string;
    months: string[];
    confirmed: boolean;
  }>({ key: "", months: [], confirmed: true });
  const [useManualPeriod, setUseManualPeriod] = useState(false);
  const [manualMonth, setManualMonth] = useState<string>("");
  const [manualYear, setManualYear] = useState<string>("");
  const [manualPeriodHydrated, setManualPeriodHydrated] = useState(false);
  const [identityState, setIdentityState] = useState<IdentityStatus>({
    status: "idle",
    total: 0,
    completed: 0,
    unmatched: 0,
  });
  const [identityMap, setIdentityMap] = useState<Map<string, IdentityRecord>>(() => new Map());
  const [selectedOffices, setSelectedOffices] = useState<string[]>(
    () => settingsRef.current?.selectedOffices ?? []
  );
  const [selectedScheduleTypes, setSelectedScheduleTypes] = useState<string[]>(
    () => settingsRef.current?.selectedScheduleTypes ?? []
  );
  const [showUnmatched, setShowUnmatched] = useState<boolean>(
    () => settingsRef.current?.showUnmatched ?? true
  );
  const [showNoPunchColumn, setShowNoPunchColumn] = useState<boolean>(
    () => settingsRef.current?.showNoPunchColumn ?? false
  );
  const [applyOfficeFilterToExport, setApplyOfficeFilterToExport] = useState(true);
  const [columnOrder, setColumnOrder] = useState<SummaryColumnKey[]>(initialColumnSettings.order);
  const [selectedColumnKeys, setSelectedColumnKeys] = useState<SummaryColumnKey[]>(
    initialColumnSettings.selected
  );
  const [columnSelectorOpen, setColumnSelectorOpen] = useState(false);
  const [metricMode, setMetricMode] = useState<MetricMode>(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(SUMMARY_METRIC_MODE_KEY);
      if (stored === "minutes" || stored === "days") {
        return stored;
      }
    }
    return settingsRef.current?.metricMode ?? "days";
  });
  const [visibleCharts, setVisibleChartsState] = useState<ChartId[]>(() => {
    const stored = settingsRef.current?.visibleCharts;
    if (stored?.length) {
      const unique = Array.from(new Set(stored.filter(isChartId)));
      return unique.length ? unique : [...DEFAULT_VISIBLE_CHARTS];
    }
    return [...DEFAULT_VISIBLE_CHARTS];
  });
  const [insightsCollapsed, setInsightsCollapsed] = useState<boolean>(
    () => settingsRef.current?.collapsed ?? false
  );
  const [exportFilteredOnly, setExportFilteredOnly] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [expandedWarnings, setExpandedWarnings] = useState<Record<string, boolean>>({});
  const [resolveTarget, setResolveTarget] = useState<{
    token: string;
    name: string | null;
  } | null>(null);
  const [resolveBusy, setResolveBusy] = useState(false);
  const [manualMappings, setManualMappings] = useState<Set<string>>(() => new Set());
  const [manualResolved, setManualResolved] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (metricMode === "minutes") {
      if (sortKey === "latePercent") {
        setSortKey("totalLateMinutes");
      } else if (sortKey === "undertimePercent") {
        setSortKey("totalUndertimeMinutes");
      }
    } else {
      if (sortKey === "totalLateMinutes") {
        setSortKey("latePercent");
      } else if (sortKey === "totalUndertimeMinutes") {
        setSortKey("undertimePercent");
      }
    }
  }, [metricMode, sortKey]);

  const updateVisibleCharts = useCallback(
    (updater: ChartId[] | ((prev: ChartId[]) => ChartId[])) => {
      setVisibleChartsState((prev) => {
        const next =
          typeof updater === "function"
            ? (updater as (prev: ChartId[]) => ChartId[])(prev)
            : updater;
        const unique = Array.from(new Set(next.filter(isChartId)));
        return unique.length ? unique : [...DEFAULT_VISIBLE_CHARTS];
      });
    },
    []
  );

  const inputRef = useRef<HTMLInputElement | null>(null);
  const parseInProgress = useRef(false);
  const lastEvaluatedKey = useRef<string>("");
  const identityCacheRef = useRef<Map<string, IdentityRecord>>(new Map());
  const identitySetCacheRef = useRef<Map<string, Map<string, IdentityRecord>>>(new Map());

  const parsedFiles = useMemo(
    () => files.filter((file) => file.status === "parsed" && file.parsed),
    [files]
  );

  const toggleWarningExpansion = useCallback((key: string) => {
    setExpandedWarnings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const mergeResult = useMemo(() => {
    if (!parsedFiles.length) return null;
    return mergeParsedWorkbooks(parsedFiles.map((file) => file.parsed!));
  }, [parsedFiles]);

  const identityTokens = useMemo(() => {
    if (!mergeResult) return [] as string[];
    const tokens = new Set<string>();
    for (const row of mergeResult.perDay) {
      const token = row.employeeToken || row.employeeId || row.employeeName;
      if (token) tokens.add(token.trim());
    }
    return Array.from(tokens).sort((a, b) => a.localeCompare(b));
  }, [mergeResult]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(MANUAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as {
          useManualPeriod?: boolean;
          manualMonth?: string;
          manualYear?: string;
        };
        if (typeof parsed.useManualPeriod === "boolean") {
          setUseManualPeriod(parsed.useManualPeriod);
        }
        if (typeof parsed.manualMonth === "string") {
          setManualMonth(parsed.manualMonth);
        }
        if (typeof parsed.manualYear === "string") {
          setManualYear(parsed.manualYear);
        }
      }
    } catch (error) {
      console.warn("Failed to load manual period settings", error);
    } finally {
      setManualPeriodHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!manualResolvedStorageKey) {
      setManualResolved(new Set());
      return;
    }
    try {
      const stored = window.localStorage.getItem(manualResolvedStorageKey);
      if (!stored) {
        setManualResolved(new Set());
        return;
      }
      const parsed = JSON.parse(stored) as unknown;
      if (Array.isArray(parsed)) {
        const normalized = parsed
          .map((token) => normalizeBiometricToken(typeof token === "string" ? token : ""))
          .filter((token): token is string => Boolean(token));
        setManualResolved(new Set(normalized));
      } else {
        setManualResolved(new Set());
      }
    } catch (error) {
      console.warn("Failed to load manual resolved tokens", error);
      setManualResolved(new Set());
    }
  }, [manualResolvedStorageKey]);

  useEffect(() => {
    if (!manualPeriodHydrated) return;
    if (typeof window === "undefined") return;
    try {
      const payload = JSON.stringify({
        useManualPeriod,
        manualMonth,
        manualYear,
      });
      window.localStorage.setItem(MANUAL_STORAGE_KEY, payload);
    } catch (error) {
      console.warn("Failed to persist manual period settings", error);
    }
  }, [manualMonth, manualPeriodHydrated, manualYear, useManualPeriod]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!manualResolvedStorageKey) return;
    try {
      window.localStorage.setItem(
        manualResolvedStorageKey,
        JSON.stringify(Array.from(manualResolved))
      );
    } catch (error) {
      console.warn("Failed to persist manual resolved tokens", error);
    }
  }, [manualResolved, manualResolvedStorageKey]);

  useEffect(() => {
    setManualResolved((prev) => {
      if (!prev.size) return prev;
      const next = new Set(Array.from(prev).filter((token) => manualMappings.has(token)));
      return next.size === prev.size ? prev : next;
    });
  }, [manualMappings]);

  useEffect(() => {
    if (!mergeResult) {
      setMixedMonthsContext({ key: "", months: [], confirmed: true });
      setShowMixedMonthsPrompt(false);
      return;
    }
    const months = mergeResult.months;
    const key = months.slice().sort().join("|");
    if (months.length <= 1) {
      setMixedMonthsContext({ key, months, confirmed: true });
      setShowMixedMonthsPrompt(false);
      return;
    }
    setMixedMonthsContext((prev) => {
      if (prev.key === key && prev.confirmed) {
        setShowMixedMonthsPrompt(false);
        return prev;
      }
      setShowMixedMonthsPrompt(true);
      return { key, months, confirmed: false };
    });
  }, [mergeResult]);

  useEffect(() => {
    let cancelled = false;

    if (!identityTokens.length) {
      if (identityMap.size) setIdentityMap(new Map());
      setIdentityState({ status: "idle", total: 0, completed: 0, unmatched: 0 });
      return;
    }

    const cacheKey = identityTokens.join("|");
    const cachedSet = identitySetCacheRef.current.get(cacheKey);
    if (cachedSet) {
      const map = new Map(cachedSet);
      setIdentityMap(map);
      setIdentityState({
        status: "resolved",
        total: identityTokens.length,
        completed: identityTokens.length,
        unmatched: countUnmatchedIdentities(map),
      });
      return;
    }

    const working = new Map<string, IdentityRecord>();
    const pending: string[] = [];

    for (const token of identityTokens) {
      const cached = identityCacheRef.current.get(token);
      if (cached) {
        working.set(token, cached);
      } else {
        pending.push(token);
      }
    }

    let completed = identityTokens.length - pending.length;

    setIdentityState({
      status: pending.length ? "resolving" : "resolved",
      total: identityTokens.length,
      completed: pending.length ? completed : identityTokens.length,
      unmatched: countUnmatchedIdentities(working),
    });

    if (!pending.length) {
      const finalMap = new Map(working);
      identitySetCacheRef.current.set(cacheKey, finalMap);
      setIdentityMap(finalMap);
      return;
    }

    const fetchChunks = async () => {
      try {
        for (let i = 0; i < pending.length; i += IDENTITY_REQUEST_LIMIT) {
          const slice = pending.slice(i, i + IDENTITY_REQUEST_LIMIT);
          const response = await timeout(
            fetch("/api/biometrics/resolve-identities", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ tokens: slice }),
            })
          );

          if (!response.ok) {
            const message = await response.text();
            throw new Error(message || "Unable to resolve employee identities.");
          }

          const payload = (await response.json()) as {
            results?: Record<string, IdentityRecord>;
          };

          for (const token of slice) {
            const normalized = normalizeIdentityRecord(payload.results?.[token]);
            working.set(token, normalized);
            identityCacheRef.current.set(token, normalized);
          }

          completed += slice.length;
          if (cancelled) return;
          setIdentityState({
            status: "resolving",
            total: identityTokens.length,
            completed,
            unmatched: countUnmatchedIdentities(working),
          });
        }

        if (cancelled) return;
        const finalMap = new Map(working);
        identitySetCacheRef.current.set(cacheKey, finalMap);
        setIdentityMap(finalMap);
        setIdentityState({
          status: "resolved",
          total: identityTokens.length,
          completed: identityTokens.length,
          unmatched: countUnmatchedIdentities(finalMap),
        });
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to resolve identities", error);
        const message =
          error instanceof Error ? error.message : "Unable to resolve employee identities.";
        setIdentityMap(new Map(working));
        setIdentityState({
          status: "error",
          total: identityTokens.length,
          completed,
          unmatched: countUnmatchedIdentities(working),
          message,
        });
        toast({
          title: "Identity resolution failed",
          description: message,
          variant: "destructive",
        });
      }
    };

    void fetchChunks();

    return () => {
      cancelled = true;
    };
  }, [identityTokens, toast]);

  useEffect(() => {
    if (parseInProgress.current) return;
    const next = files.find((file) => file.status === "queued");
    if (!next) return;

    parseInProgress.current = true;
    setFiles((prev) =>
      prev.map((file) => (file.id === next.id ? { ...file, status: "parsing" } : file))
    );

    const parse = async () => {
      try {
        const buffer = await next.file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
        const parserTypes = detectWorkbookParsers(workbook);
        const parserType: WorkbookParserType = parserTypes.includes("grid-report")
          ? "grid-report"
          : "legacy";
        const parserLabel =
          parserType === "grid-report" ? "Attendance Record Report (grid)" : "Biometrics log";

        setFiles((prev) =>
          prev.map((file) =>
            file.id === next.id
              ? {
                  ...file,
                  status: "parsing",
                  parserType,
                  parserTypes,
                  parserLabel,
                }
              : file
          )
        );

        const parsed = parseBioAttendance(workbook, { fileName: next.name });
        const parseSummary = {
          employees: parsed.employeeCount,
          punches: parsed.totalPunches,
        };

        setFiles((prev) =>
          prev.map((file) =>
            file.id === next.id
              ? {
                  ...file,
                  status: "parsed",
                  parsed,
                  error: undefined,
                  parserType,
                  parserTypes,
                  parserLabel,
                  parseSummary,
                }
              : file
          )
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to parse workbook.";
        setFiles((prev) =>
          prev.map((file) =>
            file.id === next.id
              ? { ...file, status: "failed", error: message, parsed: undefined }
              : file
          )
        );
        toast({
          title: `Failed to parse ${next.name}`,
          description: message,
          variant: "destructive",
        });
      } finally {
        parseInProgress.current = false;
      }
    };

    void parse();
  }, [files, toast]);

  const manualMonthNumber = manualMonth ? Number(manualMonth) : null;
  const manualYearNumber = manualYear ? Number(manualYear) : null;
  const manualMonthValid =
    manualMonthNumber != null &&
    Number.isInteger(manualMonthNumber) &&
    manualMonthNumber >= 1 &&
    manualMonthNumber <= 12;
  const manualYearValid =
    manualYearNumber != null &&
    Number.isInteger(manualYearNumber) &&
    manualYearNumber >= 1900 &&
    manualYearNumber <= 2100;
  const manualSelectionValid = !useManualPeriod || (manualMonthValid && manualYearValid);

  const manualPeriodSelection = useMemo<ManualPeriodSelection | null>(() => {
    if (!useManualPeriod) return null;
    if (!manualMonthValid || !manualYearValid) return null;
    if (manualMonthNumber == null || manualYearNumber == null) return null;
    return { month: manualMonthNumber, year: manualYearNumber };
  }, [manualMonthNumber, manualMonthValid, manualYearNumber, manualYearValid, useManualPeriod]);

  const currentPeriodKey = useMemo(() => {
    if (perDay && perDay.length) {
      const prefixes = perDay
        .map((row) => row.dateISO?.slice(0, 7))
        .filter((value): value is string => Boolean(value));
      if (prefixes.length) {
        prefixes.sort();
        return prefixes[0] ?? null;
      }
    }
    if (manualPeriodSelection) {
      return `${manualPeriodSelection.year}-${pad2(manualPeriodSelection.month)}`;
    }
    if (mergeResult?.months?.length === 1) {
      return mergeResult.months[0] ?? null;
    }
    return null;
  }, [manualPeriodSelection, mergeResult, perDay]);

  const manualResolvedStorageKey = useMemo(() => {
    if (!currentPeriodKey) return null;
    return `${MANUAL_RESOLVED_STORAGE_PREFIX}:${departmentId}:${currentPeriodKey}`;
  }, [currentPeriodKey, departmentId]);

  const manualPeriodError = useMemo(() => {
    if (!useManualPeriod) return null;
    if (!manualMonthValid && !manualYearValid) {
      return "Select a month and enter a year between 1900 and 2100.";
    }
    if (!manualMonthValid) return "Select a month.";
    if (!manualYearValid) return "Enter a year between 1900 and 2100.";
    return null;
  }, [manualMonthValid, manualYearValid, useManualPeriod]);

  const manualPeriodLabel = manualPeriodSelection
    ? manualPeriodFormatter.format(
        new Date(Date.UTC(manualPeriodSelection.year, manualPeriodSelection.month - 1, 1))
      )
    : "selected period";

  const rawPerDay = useMemo<ParsedPerDayRow[]>(() => {
    if (!mergeResult) return [];
    return mergeResult.perDay.map((row) => toChronologicalRow(row));
  }, [mergeResult]);

  const basePerDay = useMemo<ParsedPerDayRow[]>(() => {
    if (!rawPerDay.length) return [];
    if (identityTokens.length && identityState.status === "resolving") {
      return sortPerDayRows([...rawPerDay]);
    }
    const mapped = rawPerDay.map((row) => {
      const token = row.employeeToken || row.employeeId || row.employeeName;
      if (!token) return row;
      const identity = identityMap.get(token);
      if (!identity) return row;
      const normalized = normalizeIdentityRecord(identity);
      const isUnmatched = normalized.status === "unmatched";
      const logName = row.employeeName?.trim();
      const employeeName =
        isUnmatched && logName?.length ? logName : normalized.employeeName || row.employeeName;
      const officeName = isUnmatched
        ? UNKNOWN_OFFICE_LABEL
        : normalized.officeName ?? null;
      const officeId = isUnmatched ? null : normalized.officeId ?? null;
      const employeeId = isUnmatched ? token : row.employeeId;

      return {
        ...row,
        employeeId,
        employeeName,
        resolvedEmployeeId: normalized.employeeId,
        officeId,
        officeName,
        identityStatus: normalized.status,
      };
    });
    return sortPerDayRows(mapped.map((row) => toChronologicalRow(row)));
  }, [identityMap, identityState.status, identityTokens.length, rawPerDay]);

  const { filteredRows: filteredPerDayRows, outOfPeriodRows } = useMemo(() => {
    if (!mergeResult) {
      return { filteredRows: [] as ParsedPerDayRow[], outOfPeriodRows: [] as OutOfPeriodRow[] };
    }
    if (!useManualPeriod) {
      return { filteredRows: basePerDay, outOfPeriodRows: [] as OutOfPeriodRow[] };
    }
    if (!manualPeriodSelection || !manualSelectionValid) {
      return { filteredRows: [] as ParsedPerDayRow[], outOfPeriodRows: [] as OutOfPeriodRow[] };
    }

    const { month, year } = manualPeriodSelection;
    const prefix = `${year}-${pad2(month)}`;
    const filtered: ParsedPerDayRow[] = [];
    const excluded: OutOfPeriodRow[] = [];

    for (const row of basePerDay) {
      if (row.composedFromDayOnly) {
        const manualDate = composeManualDate(year, month, row.day);
        if (!manualDate) {
          excluded.push({
            employeeId: row.employeeId,
            employeeName: row.employeeName,
            dateISO: `${year}-${pad2(month)}-${pad2(row.day)}`,
            sourceFiles: row.sourceFiles,
            reason: "invalid-day",
          });
          continue;
        }
        filtered.push({ ...row, dateISO: manualDate, day: Number(manualDate.slice(-2)) });
        continue;
      }

      if (row.dateISO.startsWith(prefix)) {
        filtered.push(row);
      } else {
        excluded.push({
          employeeId: row.employeeId,
          employeeName: row.employeeName,
          dateISO: row.dateISO,
          sourceFiles: row.sourceFiles,
          reason: "outside-period",
        });
      }
    }

    return {
      filteredRows: sortPerDayRows(filtered.map((row) => toChronologicalRow(row))),
      outOfPeriodRows: excluded,
    };
  }, [basePerDay, manualPeriodSelection, manualSelectionValid, mergeResult, useManualPeriod]);

  const identityWarnings = useMemo(
    () => computeIdentityWarnings(filteredPerDayRows, identityMap, identityState.status),
    [filteredPerDayRows, identityMap, identityState.status]
  );

  const aggregatedWarnings = useMemo(() => {
    const sources: ParseWarning[][] = [];
    for (const file of parsedFiles) {
      if (file.parsed?.warnings?.length) {
        sources.push(file.parsed.warnings);
      }
    }
    if (mergeResult?.warnings?.length) {
      sources.push(mergeResult.warnings);
    }
    if (identityWarnings.length) {
      sources.push(identityWarnings);
    }
    if (!sources.length) return [];
    return aggregateWarnings(sources);
  }, [identityWarnings, mergeResult, parsedFiles]);

  useEffect(() => {
    if (aggregatedWarnings.length === 0) {
      setExpandedWarnings((prev) => (Object.keys(prev).length ? {} : prev));
    }
  }, [aggregatedWarnings]);

  const aggregatedWarningLevel = aggregatedWarnings.some(
    (warning) => warning.level === "warning"
  )
    ? "warning"
    : "info";

  const hasPendingParses = files.some(
    (file) => file.status === "parsing" || file.status === "queued"
  );

  const identityReady = identityTokens.length === 0 || identityState.status !== "resolving";

  useEffect(() => {
    if (!mergeResult) {
      setPerDay(null);
      setPerEmployee(null);
      lastEvaluatedKey.current = "";
      return;
    }
    if (hasPendingParses) return;
    if (!identityReady) return;
    if (mergeResult.months.length > 1 && !mixedMonthsContext.confirmed) return;

    if (useManualPeriod && !manualSelectionValid) {
      setPerDay(null);
      setPerEmployee(null);
      lastEvaluatedKey.current = "";
      return;
    }

    const manualKey = manualPeriodSelection
      ? `${manualPeriodSelection.year}-${pad2(manualPeriodSelection.month)}`
      : "auto";

    if (!filteredPerDayRows.length) {
      const emptyKey = `${manualKey}:empty`;
      if (lastEvaluatedKey.current !== emptyKey) {
        setPerDay([]);
        setPerEmployee([]);
        lastEvaluatedKey.current = emptyKey;
      }
      return;
    }

    const payloadKey = `${manualKey}:${filteredPerDayRows.length}:${filteredPerDayRows
      .map((row) => {
        const officeKey = row.officeId ?? row.officeName ?? "";
        return `${row.employeeToken ?? row.employeeId}:${row.dateISO}:${row.allTimes.join("|")}:${row.employeeName}:${officeKey}`;
      })
      .join("#")}`;
    if (payloadKey === lastEvaluatedKey.current) return;

    const controller = new AbortController();
    const evaluate = async () => {
      setEvaluating(true);
      try {
        const body = {
          entries: filteredPerDayRows.map((row) => ({
            employeeId: row.employeeId,
            employeeName: row.employeeName,
            employeeToken: row.employeeToken,
            resolvedEmployeeId: row.resolvedEmployeeId ?? null,
            officeId: row.officeId ?? null,
            officeName: row.officeName ?? null,
            dateISO: row.dateISO,
            day: row.day,
            earliest: row.earliest,
            latest: row.latest,
            allTimes: row.allTimes,
            punches: row.punches,
            sourceFiles: row.sourceFiles,
          })),
        };

        const response = await timeout(
          fetch("/api/attendance/evaluate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
          })
        );

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "Unable to evaluate attendance.");
        }

        const result = (await response.json()) as {
          perDay: PerDayRow[];
          perEmployee: PerEmployeeRow[];
          manualMappings?: string[];
        };

        const chronological = sortPerDayRows(
          result.perDay.map((row) => toChronologicalRow(row))
        );

        setPerDay(chronological);
        setPerEmployee(result.perEmployee);
        setManualMappings(() => {
          const tokens = (result.manualMappings ?? [])
            .map((token) => normalizeBiometricToken(token))
            .filter((token): token is string => Boolean(token));
          return new Set(tokens);
        });
        lastEvaluatedKey.current = payloadKey;
        toast({
          title: "Evaluation complete",
          description: `${result.perEmployee.length} employees processed.`,
        });
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error(error);
        const message =
          error instanceof Error ? error.message : "Unable to evaluate attendance.";
        toast({
          title: "Evaluation failed",
          description: message,
          variant: "destructive",
        });
      } finally {
        setEvaluating(false);
      }
    };

    void evaluate();

    return () => {
      controller.abort();
    };
  }, [
    filteredPerDayRows,
    hasPendingParses,
    identityReady,
    manualPeriodSelection,
    manualSelectionValid,
    mergeResult,
    mixedMonthsContext.confirmed,
    toast,
    useManualPeriod,
  ]);

  const officeOptionMap = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>();
    if (!perDay?.length) return map;
    for (const row of perDay) {
      const label = row.officeName && row.officeName.trim().length
        ? row.officeName.trim()
        : row.resolvedEmployeeId
        ? UNASSIGNED_OFFICE_LABEL
        : UNKNOWN_OFFICE_LABEL;
      const key = makeOfficeKey(row.officeId ?? null, label);
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, { label, count: 1 });
      }
    }
    return map;
  }, [perDay]);

  const officeOptions = useMemo<OfficeOption[]>(() => {
    return Array.from(officeOptionMap.entries())
      .map(([key, value]) => ({ key, label: value.label, count: value.count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [officeOptionMap]);

  const scheduleTypeOptions = useMemo<string[]>(() => {
    if (!perEmployee?.length) return [];
    const set = new Set<string>();
    for (const row of perEmployee) {
      if (!row.scheduleTypes?.length) continue;
      for (const type of row.scheduleTypes) {
        if (type) set.add(type);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [perEmployee]);

  const filteredPerEmployee = useMemo(() => {
    if (!perEmployee) return [] as PerEmployeeRow[];
    const officeKeys = selectedOffices.length ? new Set(selectedOffices) : null;
    const scheduleKeys = selectedScheduleTypes.length ? new Set(selectedScheduleTypes) : null;
    return perEmployee.filter((row) => {
      if (officeKeys) {
        const key = makeOfficeKey(
          row.officeId ?? null,
          row.officeName ?? (row.resolvedEmployeeId ? UNASSIGNED_OFFICE_LABEL : UNKNOWN_OFFICE_LABEL)
        );
        if (!officeKeys.has(key)) return false;
      }
      if (scheduleKeys) {
        const hasType = row.scheduleTypes?.some((type) => scheduleKeys.has(type)) ?? false;
        if (!hasType) return false;
      }
      if (!showUnmatched && isUnmatchedIdentity(row.identityStatus, row.resolvedEmployeeId)) {
        return false;
      }
      return true;
    });
  }, [perEmployee, selectedOffices, selectedScheduleTypes, showUnmatched]);

  const searchedPerEmployee = useMemo(() => {
    if (!filteredPerEmployee.length) return filteredPerEmployee;
    const query = employeeSearch.trim().toLowerCase();
    if (!query) return filteredPerEmployee;
    return filteredPerEmployee.filter((row) => {
      const name = row.employeeName?.toLowerCase() ?? "";
      const id = row.employeeId?.toLowerCase() ?? "";
      const token = row.employeeToken?.toLowerCase() ?? "";
      return name.includes(query) || id.includes(query) || token.includes(query);
    });
  }, [employeeSearch, filteredPerEmployee]);

  const filteredPerDayPreview = useMemo(() => {
    if (!perDay) return [] as PerDayRow[];
    const officeKeys = selectedOffices.length ? new Set(selectedOffices) : null;
    const scheduleKeys = selectedScheduleTypes.length ? new Set(selectedScheduleTypes) : null;
    const query = employeeSearch.trim().toLowerCase();
    const hasQuery = query.length > 0;
    return perDay.filter((row) => {
      if (officeKeys) {
        const key = makeOfficeKey(
          row.officeId ?? null,
          row.officeName ?? (row.resolvedEmployeeId ? UNASSIGNED_OFFICE_LABEL : UNKNOWN_OFFICE_LABEL)
        );
        if (!officeKeys.has(key)) return false;
      }
      if (scheduleKeys && row.scheduleType) {
        if (!scheduleKeys.has(row.scheduleType)) return false;
      } else if (scheduleKeys && !row.scheduleType) {
        return false;
      }
      if (!showUnmatched && isUnmatchedIdentity(row.identityStatus, row.resolvedEmployeeId)) {
        return false;
      }
      if (!hasQuery) return true;
      const name = row.employeeName?.toLowerCase() ?? "";
      const id = row.employeeId?.toLowerCase() ?? "";
      const token = row.employeeToken?.toLowerCase() ?? "";
      return name.includes(query) || id.includes(query) || token.includes(query);
    });
  }, [
    employeeSearch,
    perDay,
    selectedOffices,
    selectedScheduleTypes,
    showUnmatched,
  ]);

  useEffect(() => {
    setPage(0);
  }, [filteredPerDayPreview]);

  useEffect(() => {
    setSelectedScheduleTypes((prev) => {
      if (!prev.length) return prev;
      const available = new Set(scheduleTypeOptions);
      const filtered = prev.filter((type) => available.has(type));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [scheduleTypeOptions]);

  useEffect(() => {
    setSelectedOffices((prev) => {
      if (!prev.length) return prev;
      const available = new Set(officeOptions.map((option) => option.key));
      const filtered = prev.filter((key) => available.has(key));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [officeOptions]);

  useEffect(() => {
    if (perDay === null) {
      setSelectedOffices([]);
      setSelectedScheduleTypes([]);
      setExportFilteredOnly(false);
    }
  }, [perDay]);

  useEffect(() => {
    if (!selectedOffices.length && exportFilteredOnly) {
      setExportFilteredOnly(false);
    }
  }, [exportFilteredOnly, selectedOffices.length]);

  useEffect(() => {
    if (!selectedOffices.length) {
      setApplyOfficeFilterToExport(true);
    }
  }, [selectedOffices.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: InsightsSettings = {
      selectedOffices,
      selectedScheduleTypes,
      showUnmatched,
      metricMode,
      visibleCharts,
      collapsed: insightsCollapsed,
      showNoPunchColumn,
    };
    window.localStorage.setItem(INSIGHTS_SETTINGS_KEY, JSON.stringify(payload));
    window.localStorage.setItem(OFFICE_FILTER_STORAGE_KEY, JSON.stringify(selectedOffices));
    window.localStorage.setItem(SUMMARY_METRIC_MODE_KEY, metricMode);
  }, [
    selectedOffices,
    selectedScheduleTypes,
    showUnmatched,
    metricMode,
    visibleCharts,
    insightsCollapsed,
    showNoPunchColumn,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: StoredColumnSettings = {
      order: columnOrder,
      selected: selectedColumnKeys,
    };
    window.localStorage.setItem(EXPORT_COLUMNS_STORAGE_KEY, JSON.stringify(payload));
  }, [columnOrder, selectedColumnKeys]);

  const handleOfficeToggle = useCallback((key: string, nextChecked: boolean) => {
    setSelectedOffices((prev) => {
      if (nextChecked) {
        if (prev.includes(key)) return prev;
        return [...prev, key];
      }
      return prev.filter((value) => value !== key);
    });
  }, []);

  const handleScheduleToggle = useCallback((type: string, nextChecked: boolean) => {
    setSelectedScheduleTypes((prev) => {
      if (nextChecked) {
        if (prev.includes(type)) return prev;
        return [...prev, type];
      }
      return prev.filter((value) => value !== type);
    });
  }, []);

  const handleToggleExportColumn = useCallback(
    (key: SummaryColumnKey, nextChecked: boolean) => {
      setSelectedColumnKeys((prev) => {
        const set = new Set(prev);
        if (nextChecked) {
          set.add(key);
        } else {
          if (set.size <= 1 && set.has(key)) {
            toast({
              title: "Keep at least one column",
              description: "Select at least one column to include in the export.",
              variant: "destructive",
            });
            return prev;
          }
          set.delete(key);
        }
        const next = columnOrder.filter((orderKey) => set.has(orderKey));
        return next.length ? next : prev;
      });
    },
    [columnOrder, toast]
  );

  const handleReorderExportColumns = useCallback((order: SummaryColumnKey[]) => {
    setColumnOrder(order);
    setSelectedColumnKeys((prev) => order.filter((key) => prev.includes(key)));
  }, []);

  const handleSelectAllExportColumns = useCallback(() => {
    setSelectedColumnKeys([...columnOrder]);
  }, [columnOrder]);

  const handleResetExportColumns = useCallback(() => {
    const defaults = sanitizeColumnSettings(null);
    setColumnOrder(defaults.order);
    setSelectedColumnKeys(defaults.selected);
  }, []);

  const handleResolveMapping = useCallback(
    async (token: string, employeeId: string, employeeName: string) => {
      setResolveBusy(true);
      try {
        const response = await timeout(
          fetch("/api/biometrics/resolve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, employeeId }),
          }),
          15_000
        );

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "Unable to save biometrics mapping.");
        }

        const identityResponse = await timeout(
          fetch("/api/biometrics/resolve-identities", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tokens: [token] }),
          }),
          15_000
        );

        if (!identityResponse.ok) {
          const message = await identityResponse.text();
          throw new Error(message || "Unable to refresh identity details.");
        }

        const payload = (await identityResponse.json()) as {
          results?: Record<string, IdentityRecord>;
        };
        const normalized = normalizeIdentityRecord(payload.results?.[token]);
        identityCacheRef.current.set(token, normalized);
        identitySetCacheRef.current.clear();

        let nextMap: Map<string, IdentityRecord> | null = null;
        setIdentityMap((prev) => {
          const next = new Map(prev);
          next.set(token, normalized);
          nextMap = next;
          return next;
        });

        if (nextMap) {
          const unmatched = countUnmatchedIdentities(nextMap);
          setIdentityState((prev) => ({ ...prev, unmatched }));
        }

        const normalizedTokenValue = normalizeBiometricToken(token);
        if (normalizedTokenValue) {
          setManualMappings((prev) => {
            const next = new Set(prev);
            next.add(normalizedTokenValue);
            return next;
          });
          setManualResolved((prev) => {
            if (prev.has(normalizedTokenValue)) return prev;
            const next = new Set(prev);
            next.add(normalizedTokenValue);
            return next;
          });
        }

        if (normalizedTokenValue && perDay && perDay.length) {
          const related = perDay.filter((row) => {
            const rowToken = normalizeBiometricToken(
              row.employeeToken || row.employeeId || row.employeeName || ""
            );
            return rowToken === normalizedTokenValue;
          });
          if (related.length) {
            try {
              const reEnrichBody = {
                entries: related.map((row) => ({
                  employeeId: row.employeeId,
                  employeeName: row.employeeName,
                  employeeToken: row.employeeToken || row.employeeId || "",
                  resolvedEmployeeId: row.resolvedEmployeeId ?? null,
                  officeId: row.officeId ?? null,
                  officeName: row.officeName ?? null,
                  dateISO: row.dateISO,
                  day: row.day,
                  earliest: row.earliest,
                  latest: row.latest,
                  allTimes: row.allTimes,
                  punches: row.punches,
                  sourceFiles: row.sourceFiles,
                })),
              };

              const reEnrichResponse = await timeout(
                fetch("/api/biometrics/re-enrich", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(reEnrichBody),
                }),
                15_000
              );

              if (reEnrichResponse.ok) {
                const reEnrichResult = (await reEnrichResponse.json()) as {
                  perDay: PerDayRow[];
                  perEmployee: PerEmployeeRow[];
                  manualMappings?: string[];
                };
                const enrichedDays = sortPerDayRows(
                  reEnrichResult.perDay.map((row) => toChronologicalRow(row))
                );
                setPerDay((prev) => {
                  if (!prev) return prev;
                  const filtered = prev.filter((row) => {
                    const rowToken = normalizeBiometricToken(
                      row.employeeToken || row.employeeId || row.employeeName || ""
                    );
                    return rowToken !== normalizedTokenValue;
                  });
                  return sortPerDayRows([...filtered, ...enrichedDays]);
                });
                if (reEnrichResult.perEmployee.length) {
                  const replacement = reEnrichResult.perEmployee[0];
                  setPerEmployee((prev) => {
                    if (!prev) return prev;
                    let replaced = false;
                    const next = prev.map((entry) => {
                      const entryToken = normalizeBiometricToken(
                        entry.employeeToken || entry.employeeId || entry.employeeName || ""
                      );
                      if (entryToken === normalizedTokenValue) {
                        replaced = true;
                        return replacement;
                      }
                      return entry;
                    });
                    if (!replaced) {
                      next.push(replacement);
                    }
                    return next;
                  });
                }
                if (reEnrichResult.manualMappings?.length) {
                  setManualMappings((prev) => {
                    const next = new Set(prev);
                    for (const mappingToken of reEnrichResult.manualMappings ?? []) {
                      const normalized = normalizeBiometricToken(mappingToken);
                      if (normalized) next.add(normalized);
                    }
                    return next;
                  });
                }
              } else {
                console.warn("Re-enrich request failed", await reEnrichResponse.text());
              }
            } catch (error) {
              console.warn("Failed to refresh evaluation after resolve", error);
            }
          }
        }

        setResolveTarget(null);
        toast({
          title: "Identity resolved",
          description: `${employeeName} is now linked to ${token}.`,
        });
      } catch (error) {
        console.error("Failed to resolve biometrics token", error);
        const message =
          error instanceof Error ? error.message : "Unable to resolve biometrics token.";
        toast({
          title: "Resolve failed",
          description: message,
          variant: "destructive",
        });
      } finally {
        setResolveBusy(false);
      }
    },
    [perDay, toast]
  );

  const handleResolveSubmit = useCallback(
    async (result: ResolveSearchResult) => {
      if (!resolveTarget?.token) return;
      await handleResolveMapping(resolveTarget.token, result.id, result.name);
    },
    [handleResolveMapping, resolveTarget]
  );

  const getOfficeLabel = useCallback(
    (key: string) => {
      const option = officeOptionMap.get(key);
      if (option) return option.label;
      return getOfficeLabelFromKey(key) ?? key;
    },
    [officeOptionMap]
  );

  const identityStatusBadge = useMemo(() => {
    if (!identityTokens.length) return null;
    if (identityState.status === "resolving") {
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Identity: Resolving names & offices… ({identityState.completed}/{identityState.total})
        </Badge>
      );
    }
    if (identityState.status === "error") {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5" />
          Identity resolution failed
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Resolved: {identityState.total} employees, {identityState.unmatched} unmatched
      </Badge>
    );
  }, [identityState.completed, identityState.status, identityState.total, identityState.unmatched, identityTokens.length]);

  const sortedPerEmployee = useMemo(() => {
    if (!searchedPerEmployee.length) return [];
    const rows = [...searchedPerEmployee];
    const multiplier = sortDirection === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const diff = getSortValue(a, sortKey) - getSortValue(b, sortKey);
      if (diff !== 0) {
        return diff * multiplier;
      }
      return a.employeeName.localeCompare(b.employeeName);
    });
    return rows;
  }, [searchedPerEmployee, sortDirection, sortKey]);

  const pagedPerDay = useMemo(() => {
    if (!filteredPerDayPreview.length) return [];
    const start = page * PAGE_SIZE;
    return filteredPerDayPreview.slice(start, start + PAGE_SIZE);
  }, [filteredPerDayPreview, page]);

  const totalPages = useMemo(() => {
    if (!filteredPerDayPreview.length) return 0;
    return Math.max(1, Math.ceil(filteredPerDayPreview.length / PAGE_SIZE));
  }, [filteredPerDayPreview]);

  const selectedColumnSet = useMemo(() => new Set(selectedColumnKeys), [selectedColumnKeys]);
  const exportColumnKeys = useMemo(
    () => columnOrder.filter((key) => selectedColumnSet.has(key)),
    [columnOrder, selectedColumnSet]
  );

  const handleSort = useCallback(
    (key: SortKey) => {
      setSortDirection((prev) => (sortKey === key ? (prev === "asc" ? "desc" : "asc") : "desc"));
      setSortKey(key);
    },
    [sortKey]
  );

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList?.length) return;
      const accepted: FileState[] = [];
      const rejected: string[] = [];

      Array.from(fileList).forEach((file) => {
        const extension = file.name.split(".").pop()?.toLowerCase();
        if (!extension || !["xlsx", "xls"].includes(extension)) {
          rejected.push(file.name);
          return;
        }
        accepted.push({
          id: createFileId(),
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          status: "queued",
        });
      });

      if (accepted.length) {
        setFiles((prev) => [...prev, ...accepted]);
      }

      if (rejected.length) {
        toast({
          title: "Unsupported files skipped",
          description: `Only .xls and .xlsx files are allowed. Skipped: ${rejected.join(", ")}.`,
          variant: "destructive",
        });
      }

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    },
    [toast]
  );

  const onInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(event.target.files);
    },
    [handleFiles]
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      handleFiles(event.dataTransfer.files);
    },
    [handleFiles]
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!isDragging) setIsDragging(true);
  }, [isDragging]);

  const onDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleClearAll = useCallback(() => {
    setFiles([]);
    setPerDay(null);
    setPerEmployee(null);
    setShowMixedMonthsPrompt(false);
    setMixedMonthsContext({ key: "", months: [], confirmed: true });
    lastEvaluatedKey.current = "";
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    setManualMappings(new Set());
    setManualResolved(new Set());
    if (typeof window !== "undefined" && manualResolvedStorageKey) {
      window.localStorage.removeItem(manualResolvedStorageKey);
    }
  }, [manualResolvedStorageKey]);

  const handleRemoveFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
  }, []);

  const summary = useMemo(() => {
    if (!mergeResult) return null;
    const rows = manualSelectionValid ? filteredPerDayRows : [];
    const employeeTokens = new Set<string>();
    let totalPunches = 0;

    for (const row of rows) {
      const token = row.employeeToken || row.employeeId || row.employeeName;
      if (token) employeeTokens.add(token);
      totalPunches += row.allTimes.length;
    }

    let dateRangeLabel = "—";
    if (manualPeriodSelection) {
      dateRangeLabel = manualPeriodFormatter.format(
        new Date(Date.UTC(manualPeriodSelection.year, manualPeriodSelection.month - 1, 1))
      );
    } else if (rows.length) {
      const start = rows[0]?.dateISO ?? "";
      const end = rows[rows.length - 1]?.dateISO ?? start;
      if (start && end) {
        dateRangeLabel = formatDateRange({ start, end });
      }
    } else if (!useManualPeriod && mergeResult.dateRange) {
      dateRangeLabel = formatDateRange(mergeResult.dateRange);
    }

    return {
      fileCount: parsedFiles.length,
      rowsParsed: rows.length,
      totalPunches,
      employees: employeeTokens.size,
      dateRange: dateRangeLabel,
    };
  }, [
    filteredPerDayRows,
    manualPeriodSelection,
    manualSelectionValid,
    mergeResult,
    parsedFiles.length,
    useManualPeriod,
  ]);

  const exportPeriodLabel = summary?.dateRange ?? "—";

  const handleDownloadResults = useCallback(() => {
    if (!perEmployee?.length || !perDay?.length) return;
    if (useManualPeriod && !manualSelectionValid) return;

    const baseEmployees = exportFilteredOnly ? filteredPerEmployee : perEmployee;
    const baseDays = exportFilteredOnly ? filteredPerDayPreview : perDay;

    const shouldApplyOfficeFilter =
      selectedOffices.length > 0 && (exportFilteredOnly || applyOfficeFilterToExport);
    const officeSet = shouldApplyOfficeFilter ? new Set(selectedOffices) : null;

    const employees = shouldApplyOfficeFilter
      ? baseEmployees.filter((row) => officeSet!.has(getEmployeeOfficeKey(row)))
      : baseEmployees;
    const days = shouldApplyOfficeFilter
      ? baseDays.filter((row) => officeSet!.has(getDayOfficeKey(row)))
      : baseDays;

    if (!employees.length || !days.length) {
      toast({
        title: "Export skipped",
        description: "No rows match the current filters.",
      });
      return;
    }

    const viewOfficeLabels = selectedOffices.map((key) => getOfficeLabel(key) ?? key);
    const officeIdentifiers = shouldApplyOfficeFilter
      ? selectedOffices.map((key) =>
          key.startsWith(UNKNOWN_OFFICE_KEY_PREFIX) ? "__unknown__" : key
        )
      : [];
    const officeLabels = shouldApplyOfficeFilter ? viewOfficeLabels : [];

    const columnsForExport = exportColumnKeys.length
      ? exportColumnKeys
      : DEFAULT_SUMMARY_SELECTED_COLUMNS;
    const columnLabels = columnsForExport.map(
      (key) => SUMMARY_COLUMN_DEFINITION_MAP[key]?.label ?? key
    );

    try {
      exportResultsToXlsx(employees, days, {
        columns: columnsForExport,
        filters: {
          offices: officeIdentifiers,
          labels: officeLabels,
          viewLabels: viewOfficeLabels,
          applied: shouldApplyOfficeFilter,
          applyToDownload: applyOfficeFilterToExport,
          exportFilteredOnly,
        },
        metadata: {
          exportTime: new Date(),
          period: exportPeriodLabel,
          columnLabels,
          appVersion: APP_VERSION,
        },
      }, {
        manualResolvedTokens: manualResolved,
        manualMappingTokens: manualMappings,
      });
      toast({
        title: "Download started",
        description: "Exporting biometrics summary to Excel.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Unable to generate Excel file.",
        variant: "destructive",
      });
    }
  }, [
    applyOfficeFilterToExport,
    APP_VERSION,
    exportColumnKeys,
    exportFilteredOnly,
    filteredPerDayPreview,
    filteredPerEmployee,
    manualSelectionValid,
    perDay,
    perEmployee,
    exportPeriodLabel,
    selectedOffices,
    toast,
    manualMappings,
    manualResolved,
    useManualPeriod,
  ]);

  const handleDownloadNormalized = useCallback(
    (file: FileState) => {
      const buffer = file.parsed?.normalizedXlsx;
      if (!buffer) return;
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const filename = file.name.replace(/\.xls$/i, "-normalized.xlsx");
      saveAs(blob, filename);
      toast({
        title: "Normalized workbook ready",
        description: `Saved ${filename}.`,
      });
    },
    [toast]
  );

  const handleConfirmMixedMonths = useCallback(() => {
    setMixedMonthsContext((prev) => ({ ...prev, confirmed: true }));
    setShowMixedMonthsPrompt(false);
  }, []);

  const handleCancelMixedMonths = useCallback(() => {
    setMixedMonthsContext((prev) => ({ ...prev, confirmed: false }));
    setShowMixedMonthsPrompt(true);
    toast({
      title: "Merge paused",
      description: "Remove conflicting files or confirm to continue merging across months.",
    });
  }, [toast]);

  const handleUploadMore = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const totalFiles = files.length;
  const processedFiles = files.filter((file) => file.status === "parsed" || file.status === "failed").length;
  const progress = totalFiles ? Math.round((processedFiles / totalFiles) * 100) : 0;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Biometrics Logs</h2>
          <p className="text-sm text-muted-foreground">
          Upload one or more biometrics logs (.xls or .xlsx). We will normalize legacy files, merge punches across files, and compute lateness/undertime per employee.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">📆 Period (optional):</span>
            <div className="flex items-center gap-2">
              <Label
                htmlFor="manual-month"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Month
              </Label>
              <Select
                value={manualMonth || undefined}
                onValueChange={setManualMonth}
                disabled={!useManualPeriod}
              >
                <SelectTrigger id="manual-month" className="h-9 w-[140px]">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {manualMonthOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label
                htmlFor="manual-year"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Year
              </Label>
              <Input
                id="manual-year"
                type="number"
                min={1900}
                max={2100}
                inputMode="numeric"
                pattern="[0-9]*"
                value={manualYear}
                onChange={(event) => {
                  const value = event.target.value.replace(/[^0-9]/g, "");
                  setManualYear(value);
                }}
                placeholder="YYYY"
                className="h-9 w-[120px]"
                disabled={!useManualPeriod}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="manual-period-toggle"
              checked={useManualPeriod}
              onCheckedChange={(checked) => setUseManualPeriod(checked)}
            />
            <Label htmlFor="manual-period-toggle" className="text-sm font-medium">
              Use manual month/year
            </Label>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          When enabled, results include only punches within this month & year. Rows outside are listed in Warnings.
        </p>
        {manualPeriodError ? (
          <p className="text-xs font-medium text-destructive">{manualPeriodError}</p>
        ) : null}
      </div>

      <div
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragLeave={onDragLeave}
        className={cn(
          "border-2 border-dashed rounded-2xl p-8 text-center transition focus-within:ring-2 focus-within:ring-ring",
          isDragging ? "border-green-500 bg-green-50" : "border-muted-foreground/40 hover:bg-muted/40"
        )}
      >
        <div className="flex flex-col items-center gap-2">
          <UploadCloud className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">Drag & drop biometrics workbooks here</p>
          <p className="text-sm text-muted-foreground">Accepts .xls and .xlsx files</p>
        </div>
        <div className="mt-4 flex items-center justify-center gap-3">
          <input
            ref={inputRef}
            id="biometrics-files"
            type="file"
            accept=".xlsx,.xls"
            multiple
            onChange={onInputChange}
            className="hidden"
            disabled={hasPendingParses || evaluating}
          />
          <label htmlFor="biometrics-files">
            <Button disabled={hasPendingParses && !totalFiles}>{hasPendingParses ? "Processing..." : "Choose files"}</Button>
          </label>
          {totalFiles > 0 && (
            <Button variant="ghost" onClick={handleClearAll} disabled={hasPendingParses}>
              <XCircle className="mr-2 h-4 w-4" />
              Clear all
            </Button>
          )}
        </div>
      </div>

      {totalFiles > 0 && (
        <div className="space-y-3">
          {hasPendingParses || progress < 100 ? (
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          ) : null}

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Files in queue
            </h3>
            <span className="text-xs text-muted-foreground">
              {processedFiles}/{totalFiles} processed
            </span>
          </div>

          <div className="space-y-2">
            {files.map((file) => {
              const isParsed = file.status === "parsed";
              const hasNormalization = Boolean(file.parsed?.normalizedXlsx);
              return (
                <div
                  key={file.id}
                  className="rounded-lg border bg-card px-4 py-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(file.size)} · {file.type || "unknown"}
                      </p>
                      {file.status === "parsing" && file.parserLabel ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Parsing “{file.parserLabel}”…
                        </p>
                      ) : null}
                      {file.status === "parsed" && file.parseSummary ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Parsed: {file.parseSummary.employees} employees, {file.parseSummary.punches} punches.
                        </p>
                      ) : null}
                      {file.parsed?.monthHints?.length ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Detected month: {file.parsed.monthHints.join(", ")}
                        </p>
                      ) : null}
                      {file.error ? (
                        <p className="mt-1 text-xs text-destructive">{file.error}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          file.status === "parsed"
                            ? "secondary"
                            : file.status === "failed"
                            ? "destructive"
                            : "outline"
                        }
                      >
                        {file.status === "queued" && "Queued"}
                        {file.status === "parsing" && (
                          <span className="inline-flex items-center gap-1">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Parsing
                          </span>
                        )}
                        {file.status === "parsed" && (
                          <span className="inline-flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Parsed
                          </span>
                        )}
                        {file.status === "failed" && "Failed"}
                      </Badge>
                      {isParsed && hasNormalization ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadNormalized(file)}
                        >
                          <FileDown className="mr-2 h-4 w-4" />
                          Download normalized .xlsx
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveFile(file.id)}
                        disabled={file.status === "parsing"}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showMixedMonthsPrompt && mixedMonthsContext.months.length > 1 && (
        <Alert className="border-amber-500/70 bg-amber-500/10">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Merge across months?</AlertTitle>
          <AlertDescription>
            <p className="text-sm">
              We detected multiple months in the uploaded files ({mixedMonthsContext.months.join(", ")}). Proceed to merge across months?
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={handleConfirmMixedMonths}>
                Yes, merge
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancelMixedMonths}>
                Cancel
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {summary && (
        <div className="rounded-xl border bg-muted/40 p-4 text-sm">
          <div className="flex flex-wrap gap-4">
            <div>
              <p className="text-muted-foreground">Files</p>
              <p className="font-semibold text-foreground">{summary.fileCount}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Rows parsed</p>
              <p className="font-semibold text-foreground">{summary.rowsParsed}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Unique employees</p>
              <p className="font-semibold text-foreground">{summary.employees}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Date range</p>
              <p className="font-semibold text-foreground">{summary.dateRange}</p>
            </div>
          </div>
        </div>
      )}

      {aggregatedWarnings.length > 0 && (
        <Alert
          variant={aggregatedWarningLevel === "warning" ? "destructive" : "default"}
        >
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            {aggregatedWarningLevel === "warning"
              ? "Warnings detected"
              : "Heads up"}
          </AlertTitle>
          <AlertDescription>
            <div className="space-y-2">
              {aggregatedWarnings.map((warning) => {
                const warningKey = `${warning.type}-${warning.message}`;
                const unmatchedDetails = warning.unmatchedIdentities ?? [];
                const hasUnmatchedDetails = unmatchedDetails.length > 0;
                const isExpanded = hasUnmatchedDetails
                  ? Boolean(expandedWarnings[warningKey])
                  : false;
                const hasOverflow =
                  hasUnmatchedDetails &&
                  unmatchedDetails.length > UNMATCHED_WARNING_DISPLAY_LIMIT;
                const visibleUnmatchedDetails = hasUnmatchedDetails
                  ? isExpanded
                    ? unmatchedDetails
                    : unmatchedDetails.slice(0, UNMATCHED_WARNING_DISPLAY_LIMIT)
                  : [];
                const overflowCount = hasOverflow
                  ? unmatchedDetails.length - UNMATCHED_WARNING_DISPLAY_LIMIT
                  : 0;

                return (
                  <div key={warningKey} className="text-sm">
                    <p>{warning.message}</p>
                    {hasUnmatchedDetails ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                        {visibleUnmatchedDetails?.map((detail) => {
                          const employeeLabel = detail.employeeIds.length
                            ? detail.employeeIds.join(", ")
                            : null;
                          const showEmployeeLabel =
                            employeeLabel &&
                            (detail.employeeIds.length > 1 || employeeLabel !== detail.token);
                          return (
                            <li
                              key={`${warning.message}-${detail.token}`}
                              className="text-foreground"
                            >
                              <span className="font-semibold">{detail.token}</span>
                              {showEmployeeLabel ? (
                                <span className="text-muted-foreground"> — {employeeLabel}</span>
                              ) : null}
                            </li>
                          );
                        })}
                        {hasOverflow ? (
                          <li className="text-muted-foreground">
                            <button
                              type="button"
                              onClick={() => toggleWarningExpansion(warningKey)}
                              aria-expanded={isExpanded}
                              className="text-left text-primary underline-offset-2 hover:underline focus:outline-none focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                              {isExpanded
                                ? "Show less"
                                : `…and ${overflowCount} more`}
                            </button>
                          </li>
                        ) : null}
                      </ul>
                    ) : warning.samples?.length ? (
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
                        {warning.samples.map((sample, index) => (
                          <li key={`${warning.message}-${index}`}>{sample}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {useManualPeriod && outOfPeriodRows.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Out-of-period rows</AlertTitle>
          <AlertDescription>
            <div className="space-y-2">
              <p className="text-sm">
                {outOfPeriodRows.length} row{outOfPeriodRows.length === 1 ? "" : "s"} were excluded from
                the {manualPeriodLabel} summary.
              </p>
              <ul className="list-disc space-y-1 pl-4 text-xs">
                {outOfPeriodRows.slice(0, 10).map((row, index) => {
                  const name = row.employeeName || row.employeeId || "Unknown employee";
                  const file = row.sourceFiles[0] ?? "Unknown file";
                  const reason =
                    row.reason === "invalid-day"
                      ? "Invalid day for selected month/year"
                      : "Outside selected month/year";
                  return (
                    <li key={`${row.employeeId}-${row.dateISO}-${index}`}>
                      {name} – {row.dateISO} ({file}) • {reason}
                    </li>
                  );
                })}
              </ul>
              {outOfPeriodRows.length > 10 ? (
                <p className="text-xs text-muted-foreground">
                  {outOfPeriodRows.length - 10} more row{outOfPeriodRows.length - 10 === 1 ? "" : "s"} hidden.
                </p>
              ) : null}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {perEmployee && perDay && perEmployee.length > 0 && (
        <div className="space-y-4">
          {identityStatusBadge && (
            <div className="flex flex-wrap items-center gap-2">
              {identityStatusBadge}
              {identityState.status === "error" && identityState.message ? (
                <span className="text-xs text-destructive">{identityState.message}</span>
              ) : null}
            </div>
          )}
          <InsightsPanel
            collapsed={insightsCollapsed}
            onCollapsedChange={setInsightsCollapsed}
            officeOptions={officeOptions}
            selectedOffices={selectedOffices}
            onOfficeToggle={handleOfficeToggle}
            onClearOffices={() => setSelectedOffices([])}
            scheduleTypeOptions={scheduleTypeOptions}
            selectedScheduleTypes={selectedScheduleTypes}
            onScheduleToggle={handleScheduleToggle}
            onClearScheduleTypes={() => setSelectedScheduleTypes([])}
            showUnmatched={showUnmatched}
            onShowUnmatchedChange={setShowUnmatched}
            showNoPunchColumn={showNoPunchColumn}
            onShowNoPunchColumnChange={setShowNoPunchColumn}
            metricMode={metricMode}
            onMetricModeChange={setMetricMode}
            employeeSearch={employeeSearch}
            onEmployeeSearchChange={setEmployeeSearch}
            visibleCharts={visibleCharts}
            onVisibleChartsChange={updateVisibleCharts}
            perEmployee={perEmployee ?? []}
            perDay={perDay ?? []}
            filteredPerEmployee={searchedPerEmployee}
            filteredPerDay={filteredPerDayPreview}
            getOfficeLabel={getOfficeLabel}
            exportFilteredOnly={exportFilteredOnly}
            onExportFilteredOnlyChange={setExportFilteredOnly}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Per-Employee Summary</h2>
              {selectedOffices.length ? (
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wide">Office:</span>
                  {selectedOffices.map((key) => (
                    <span
                      key={key}
                      className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground"
                    >
                      {getOfficeLabel(key)}
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedOffices([])}
                    className="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    Clear
                  </button>
                  {!applyOfficeFilterToExport ? (
                    <span className="text-amber-600 dark:text-amber-500">
                      Download includes all offices
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium">View:</span>
                <div className="inline-flex overflow-hidden rounded-md border">
                  <Button
                    type="button"
                    variant={metricMode === "days" ? "default" : "ghost"}
                    size="sm"
                    className="rounded-none"
                    aria-pressed={metricMode === "days"}
                    onClick={() => setMetricMode("days")}
                  >
                    Days %
                  </Button>
                  <Button
                    type="button"
                    variant={metricMode === "minutes" ? "default" : "ghost"}
                    size="sm"
                    className="rounded-none"
                    aria-pressed={metricMode === "minutes"}
                    onClick={() => setMetricMode("minutes")}
                  >
                    Minutes
                  </Button>
                </div>
              </div>
              <OfficeFilterControl
                options={officeOptions}
                selected={selectedOffices}
                onToggle={handleOfficeToggle}
                onClear={() => setSelectedOffices([])}
                applyToExport={applyOfficeFilterToExport}
                onApplyToExportChange={setApplyOfficeFilterToExport}
              />
              <Button variant="outline" onClick={handleUploadMore} disabled={evaluating || hasPendingParses}>
                Upload more
              </Button>
              <Button
                type="button"
                variant="outline"
                className="inline-flex items-center gap-2"
                onClick={() => setColumnSelectorOpen(true)}
              >
                <Columns className="h-4 w-4" aria-hidden="true" />
                Columns
              </Button>
              <Button
                onClick={handleDownloadResults}
                disabled={
                  evaluating ||
                  hasPendingParses ||
                  !perEmployee.length ||
                  !perDay.length ||
                  (useManualPeriod && !manualSelectionValid) ||
                  (exportFilteredOnly && (!filteredPerEmployee.length || !filteredPerDayPreview.length))
                }
              >
                Download Results (Excel)
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 text-left">Employee ID</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Office</th>
                  <th className="p-2 text-left">Schedule</th>
                  <th className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleSort("daysWithLogs")}
                      className="inline-flex items-center gap-1 font-semibold"
                      aria-label="Sort by evaluated days"
                    >
                      Days
                      <ArrowUpDown
                        className={cn(
                          "h-3.5 w-3.5",
                          sortKey === "daysWithLogs" ? "opacity-100" : "opacity-40"
                        )}
                      />
                    </button>
                  </th>
                  {showNoPunchColumn ? <th className="p-2 text-center">No-punch</th> : null}
                  <th className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleSort("lateDays")}
                      className="inline-flex items-center gap-1 font-semibold"
                      aria-label="Sort by late days"
                    >
                      Late
                      <ArrowUpDown
                        className={cn(
                          "h-3.5 w-3.5",
                          sortKey === "lateDays" ? "opacity-100" : "opacity-40"
                        )}
                      />
                    </button>
                  </th>
                  <th className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleSort("undertimeDays")}
                      className="inline-flex items-center gap-1 font-semibold"
                      aria-label="Sort by undertime days"
                    >
                      Undertime
                      <ArrowUpDown
                        className={cn(
                          "h-3.5 w-3.5",
                          sortKey === "undertimeDays" ? "opacity-100" : "opacity-40"
                        )}
                      />
                    </button>
                  </th>
                  <th
                    className="p-2 text-center"
                    aria-label={
                      metricMode === "minutes"
                        ? "Late (min): Sum of daily late minutes across the selected period."
                        : undefined
                    }
                  >
                    <div className="inline-flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          handleSort(
                            metricMode === "minutes" ? "totalLateMinutes" : "latePercent"
                          )
                        }
                        className="inline-flex items-center gap-1 font-semibold"
                        aria-label={
                          metricMode === "minutes"
                            ? "Sort by total late minutes"
                            : "Sort by late percentage"
                        }
                      >
                        {metricMode === "minutes" ? "Late (min)" : "Late %"}
                        <ArrowUpDown
                          className={cn(
                            "h-3.5 w-3.5",
                            sortKey ===
                              (metricMode === "minutes"
                                ? "totalLateMinutes"
                                : "latePercent")
                              ? "opacity-100"
                              : "opacity-40"
                          )}
                        />
                      </button>
                      {metricMode === "minutes" ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label="Sum of daily late minutes across the selected period."
                            >
                              <Info className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-sm" sideOffset={6}>
                            Sum of daily late minutes across the selected period.
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
                  </th>
                  <th
                    className="p-2 text-center"
                    aria-label={
                      metricMode === "minutes"
                        ? "UT (min): Sum of daily undertime minutes across the selected period."
                        : undefined
                    }
                  >
                    <div className="inline-flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          handleSort(
                            metricMode === "minutes"
                              ? "totalUndertimeMinutes"
                              : "undertimePercent"
                          )
                        }
                        className="inline-flex items-center gap-1 font-semibold"
                        aria-label={
                          metricMode === "minutes"
                            ? "Sort by total undertime minutes"
                            : "Sort by undertime percentage"
                        }
                      >
                        {metricMode === "minutes" ? "UT (min)" : "UT %"}
                        <ArrowUpDown
                          className={cn(
                            "h-3.5 w-3.5",
                            sortKey ===
                              (metricMode === "minutes"
                                ? "totalUndertimeMinutes"
                                : "undertimePercent")
                              ? "opacity-100"
                              : "opacity-40"
                          )}
                        />
                      </button>
                      {metricMode === "minutes" ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label="Sum of daily undertime minutes across the selected period."
                            >
                              <Info className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-sm" sideOffset={6}>
                            Sum of daily undertime minutes across the selected period.
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
                  </th>
                  <th className="p-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedPerEmployee.map((row) => {
                  const key = `${row.employeeToken || row.employeeId || row.employeeName}||${row.employeeName}`;
                  const types = row.scheduleTypes ?? [];
                  const identityUnmatched = isUnmatchedIdentity(
                    row.identityStatus,
                    row.resolvedEmployeeId
                  );
                  const normalizedToken = normalizeBiometricToken(
                    row.employeeToken || row.employeeId || row.employeeName || ""
                  );
                  const hasMapping = normalizedToken ? manualMappings.has(normalizedToken) : false;
                  const isManualSolved = normalizedToken ? manualResolved.has(normalizedToken) : false;
                  const sourceLabel = formatScheduleSource(row.scheduleSource);
                  const isUnmatched = identityUnmatched;
                  const displayEmployeeId =
                    row.employeeId?.trim().length
                      ? row.employeeId
                      : isUnmatched
                      ? row.employeeToken || "—"
                      : "—";
                  const displayEmployeeName =
                    row.employeeName?.trim().length ? row.employeeName : UNMATCHED_LABEL;
                  const displayOffice = row.officeName?.trim().length
                    ? row.officeName
                    : isUnmatched
                    ? UNKNOWN_OFFICE_LABEL
                    : row.resolvedEmployeeId
                    ? UNASSIGNED_OFFICE_LABEL
                    : UNKNOWN_OFFICE_LABEL;
                  const totalLateMinutes = Math.max(0, Math.round(row.totalLateMinutes ?? 0));
                  const totalUndertimeMinutes = Math.max(0, Math.round(row.totalUndertimeMinutes ?? 0));
                  const lateMinutesLabel = Number.isFinite(totalLateMinutes)
                    ? totalLateMinutes.toLocaleString()
                    : "0";
                  const undertimeMinutesLabel = Number.isFinite(totalUndertimeMinutes)
                    ? totalUndertimeMinutes.toLocaleString()
                    : "0";
                  const latePercentValue =
                    metricMode === "minutes"
                      ? computeLatePercentMinutes(row)
                      : typeof row.lateRate === "number"
                      ? row.lateRate
                      : null;
                  const undertimePercentValue =
                    metricMode === "minutes"
                      ? computeUndertimePercentMinutes(row)
                      : typeof row.undertimeRate === "number"
                      ? row.undertimeRate
                      : null;
                  const lateTooltipLines = metricMode === "minutes"
                    ? totalLateMinutes <= 0 && latePercentValue == null
                      ? []
                      : [
                          latePercentValue == null
                            ? `${lateMinutesLabel} late minute${totalLateMinutes === 1 ? "" : "s"}`
                            : `${lateMinutesLabel} late minute${totalLateMinutes === 1 ? "" : "s"} • ${formatPercentLabel(latePercentValue)} of ${row.totalRequiredMinutes.toLocaleString()} required`,
                        ]
                    : [
                        `${row.lateDays} late day${row.lateDays === 1 ? "" : "s"} out of ${row.daysWithLogs} evaluated day${row.daysWithLogs === 1 ? "" : "s"}`,
                      ];
                  const undertimeTooltipLines = metricMode === "minutes"
                    ? totalUndertimeMinutes <= 0 && undertimePercentValue == null
                      ? []
                      : [
                          undertimePercentValue == null
                            ? `${undertimeMinutesLabel} undertime minute${totalUndertimeMinutes === 1 ? "" : "s"}`
                            : `${undertimeMinutesLabel} undertime minute${totalUndertimeMinutes === 1 ? "" : "s"} • ${formatPercentLabel(undertimePercentValue)} of ${row.totalRequiredMinutes.toLocaleString()} required`,
                        ]
                    : [
                        `${row.undertimeDays} undertime day${row.undertimeDays === 1 ? "" : "s"} out of ${row.daysWithLogs} evaluated day${row.daysWithLogs === 1 ? "" : "s"}`,
                      ];
                  if (lateTooltipLines.length && row.weeklyPatternDayCount > 0) {
                    lateTooltipLines.push("Evaluated with Weekly Pattern windows for this day.");
                  }
                  if (undertimeTooltipLines.length && row.weeklyPatternDayCount > 0) {
                    undertimeTooltipLines.push("Evaluated with Weekly Pattern windows for this day.");
                  }
                  const lateMetricLabel =
                    metricMode === "minutes" ? lateMinutesLabel : formatPercentLabel(latePercentValue);
                  const undertimeMetricLabel =
                    metricMode === "minutes" ? undertimeMinutesLabel : formatPercentLabel(undertimePercentValue);
                  const canResolve = Boolean(row.employeeToken);
                  const resolveActionLabel = hasMapping ? "Re-resolve…" : "Resolve…";
                  return (
                    <tr key={key} className="odd:bg-muted/20">
                      <td className="p-2">{displayEmployeeId}</td>
                      <td className="p-2 max-w-[16rem]">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate" title={displayEmployeeName}>
                            {displayEmployeeName}
                          </span>
                          {!hasMapping ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge className="border-amber-500/70 bg-amber-500/20 text-amber-700">
                                  Unmatched
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs text-sm">
                                No DB record; using name from uploaded log. You can resolve this below.
                              </TooltipContent>
                            </Tooltip>
                          ) : isManualSolved ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge className="border-emerald-500/70 bg-emerald-500/20 text-emerald-700">
                                  Solved
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs text-sm">
                                Token resolved via manual mapping. Using mapped employee details.
                              </TooltipContent>
                            </Tooltip>
                          ) : hasMapping ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="border-muted text-muted-foreground">
                                  Linked
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs text-sm">
                                Token has a saved mapping. You can re-resolve this below.
                              </TooltipContent>
                            </Tooltip>
                          ) : null}
                        </div>
                      </td>
                      <td className="p-2 max-w-[14rem]">
                        <span className="block truncate" title={displayOffice}>
                          {displayOffice}
                        </span>
                      </td>
                      <td className="p-2">
                        {types.length ? (
                          <div className="flex flex-wrap gap-1">
                            {types.map((type) => (
                              <Badge key={`${key}-${type}`} variant="secondary">
                                {formatScheduleType(type)}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        {sourceLabel ? (
                          <p className="mt-1 text-xs text-muted-foreground">Source: {sourceLabel}</p>
                        ) : null}
                      </td>
                  <td className="p-2 text-center">{row.daysWithLogs}</td>
                  {showNoPunchColumn ? (
                    <td className="p-2 text-center">{row.noPunchDays}</td>
                  ) : null}
                  <td className="p-2 text-center">{row.lateDays}</td>
                      <td className="p-2 text-center">{row.undertimeDays}</td>
                      <td className="p-2 text-center">
                        {lateTooltipLines.length ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help font-medium">{lateMetricLabel}</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs space-y-1 text-sm">
                              {lateTooltipLines.map((line, index) => (
                                <p key={index}>{line}</p>
                              ))}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground">{lateMetricLabel}</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {undertimeTooltipLines.length ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help font-medium">{undertimeMetricLabel}</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs space-y-1 text-sm">
                              {undertimeTooltipLines.map((line, index) => (
                                <p key={index}>{line}</p>
                              ))}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground">{undertimeMetricLabel}</span>
                        )}
                      </td>
                      <td className="p-2">
                        {canResolve ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setResolveTarget({
                                token: row.employeeToken!,
                                name: row.employeeName ?? null,
                              })
                            }
                            disabled={resolveBusy}
                          >
                            {resolveActionLabel}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Per-Day Details</h2>
            {totalPages > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span>
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                  disabled={page === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => Math.min(prev + 1, totalPages - 1))}
                  disabled={page >= totalPages - 1}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
          <div className="max-h-[420px] overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-30 bg-muted/50">
                <tr>
                  <th className="p-2 text-left">Employee ID</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Office</th>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-center">Earliest</th>
                  <th className="p-2 text-center">Latest</th>
                  <th className="p-2 text-center">Worked</th>
                  <th className="p-2 text-left">Schedule</th>
                  <th className="p-2 text-left">Timeline</th>
                  <th className="p-2 text-left">Source files</th>
                  <th className="p-2 text-left">Punches</th>
                  <th className="p-2 text-center">Late</th>
                  <th className="p-2 text-center">Undertime</th>
                </tr>
              </thead>
              <tbody>
                {pagedPerDay.map((row, index) => {
                  const weeklyWindowsLabel = formatTimelineLabel(row.weeklyPatternWindows ?? []);
                  const weeklyPresenceLabel = formatTimelineLabel(row.weeklyPatternPresence ?? []);
                  const isNoPunch = row.status === "no_punch";
                  const isExcused = row.status === "excused";
                  return (
                    <tr
                      key={`${row.employeeId}-${row.employeeName}-${row.dateISO}-${index}`}
                      className="odd:bg-muted/20"
                    >
                      <td className="p-2">{row.employeeId || "—"}</td>
                      <td className="p-2">{row.employeeName || "—"}</td>
                      <td className="p-2">
                        {row.officeName ||
                          (row.resolvedEmployeeId ? UNASSIGNED_OFFICE_LABEL : UNKNOWN_OFFICE_LABEL)}
                      </td>
                      <td className="p-2">{dateFormatter.format(toDate(row.dateISO))}</td>
                      <td className="p-2 text-center">{row.earliest ?? ""}</td>
                      <td className="p-2 text-center">{row.latest ?? ""}</td>
                      <td className="p-2 text-center">{isExcused ? "—" : row.workedHHMM ?? ""}</td>
                      <td className="p-2">
                        {row.scheduleType ? (
                          <Badge variant="outline">{formatScheduleType(row.scheduleType)}</Badge>
                        ) : (
                          ""
                        )}
                        {row.weeklyExclusionMode === "EXCUSED" ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="secondary" className="mt-1 cursor-help">
                                Excused
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>Weekly exclusion</TooltipContent>
                          </Tooltip>
                        ) : null}
                        {row.weeklyExclusionMode === "IGNORE_LATE_UNTIL" && row.weeklyExclusionIgnoreUntil ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Ignore late until {row.weeklyExclusionIgnoreUntil}
                          </p>
                        ) : null}
                        {row.weeklyPatternApplied ? (
                          <p className="mt-1 text-xs text-muted-foreground">Weekly pattern applied</p>
                        ) : null}
                      </td>
                      <td className="p-2">
                        <WeeklyPatternTimeline
                          applied={row.weeklyPatternApplied && !isNoPunch}
                          windows={row.weeklyPatternWindows ?? null}
                          presence={isNoPunch ? null : row.weeklyPatternPresence ?? null}
                        />
                      </td>
                      <td className="p-2 text-left text-xs text-muted-foreground">
                        {row.sourceFiles.join(", ")}
                      </td>
                      <td className="p-2 text-left text-xs text-muted-foreground">
                        <div className="space-y-1">
                          {isNoPunch ? (
                            <Badge variant="outline" className="bg-muted/60 text-muted-foreground">
                              No punches
                            </Badge>
                          ) : isExcused ? (
                            <Badge variant="outline" className="bg-muted/60 text-muted-foreground">
                              Excused — punches not evaluated
                            </Badge>
                          ) : row.allTimes.length ? (
                            <p>{row.allTimes.join(", ")}</p>
                          ) : null}
                          {row.weeklyPatternApplied ? (
                            <div className="space-y-0.5">
                              <p>Windows: {weeklyWindowsLabel}</p>
                              <p>Counted: {weeklyPresenceLabel}</p>
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="p-2 text-center">
                        {isExcused ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">Excused</span>
                            </TooltipTrigger>
                            <TooltipContent>Weekly exclusion — late not evaluated.</TooltipContent>
                          </Tooltip>
                        ) : isNoPunch ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">No</span>
                            </TooltipTrigger>
                            <TooltipContent>No punches — day excluded from Late/UT.</TooltipContent>
                          </Tooltip>
                        ) : row.isLate ? (
                          "Yes"
                        ) : (
                          "No"
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {isExcused ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">Excused</span>
                            </TooltipTrigger>
                            <TooltipContent>Weekly exclusion — undertime still tracked when applicable.</TooltipContent>
                          </Tooltip>
                        ) : isNoPunch ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">No</span>
                            </TooltipTrigger>
                            <TooltipContent>No punches — day excluded from Late/UT.</TooltipContent>
                          </Tooltip>
                        ) : row.isUndertime ? (
                          "Yes"
                        ) : (
                          "No"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>
      <SummaryColumnSelector
        open={columnSelectorOpen}
        onOpenChange={setColumnSelectorOpen}
        columnOrder={columnOrder}
        selectedColumns={selectedColumnKeys}
        onToggleColumn={handleToggleExportColumn}
        onReorderColumns={handleReorderExportColumns}
        onSelectAll={handleSelectAllExportColumns}
        onResetDefault={handleResetExportColumns}
        minSelected={1}
      />
      <ResolveIdentityDialog
        open={Boolean(resolveTarget)}
        token={resolveTarget?.token ?? null}
        name={resolveTarget?.name ?? null}
        busy={resolveBusy}
        onClose={() => setResolveTarget(null)}
        onResolve={handleResolveSubmit}
      />
    </TooltipProvider>
  );
}
