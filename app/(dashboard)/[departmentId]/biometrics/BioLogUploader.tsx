"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  ArrowUpDown,
  CheckCircle2,
  FileDown,
  Loader2,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react";
import { saveAs } from "file-saver";

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
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  exportResultsToXlsx,
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
} from "@/utils/parseBioAttendance";

const PAGE_SIZE = 25;

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

const formatScheduleSource = (value?: string | null) => {
  switch (value) {
    case "WORKSCHEDULE":
      return "Work schedule";
    case "EXCEPTION":
      return "Exception";
    case "DEFAULT":
      return "Default";
    case "NOMAPPING":
      return "No mapping";
    case "":
    case undefined:
    case null:
      return null;
    default:
      return value.charAt(0) + value.slice(1).toLowerCase();
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
const UNMATCHED_LABEL = "(Unmatched)";
const UNKNOWN_OFFICE_LABEL = "(Unknown)";
const UNASSIGNED_OFFICE_LABEL = "(Unassigned)";
const UNKNOWN_OFFICE_KEY_PREFIX = "__unknown__::";
const MAX_WARNING_SAMPLE_COUNT = 10;
const MAX_UNMATCHED_TOKEN_SAMPLES = 5;

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

type SortKey = "daysWithLogs" | "lateDays" | "undertimeDays";
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

const computeIdentityWarnings = (
  rows: ParsedPerDayRow[],
  identityMap: Map<string, IdentityRecord>,
  status: IdentityStatus["status"]
): ParseWarning[] => {
  if (!rows.length) return [];
  if (status === "resolving") return [];

  const unmatchedSamples = new Map<
    string,
    {
      employeeIds: Set<string>;
      samples: Set<string>;
    }
  >();
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
        entry = {
          employeeIds: new Set<string>(),
          samples: new Set<string>(),
        };
        unmatchedSamples.set(token, entry);
      }

      if (row.employeeId) {
        entry.employeeIds.add(row.employeeId);
      }

      if (entry.samples.size < MAX_UNMATCHED_TOKEN_SAMPLES) {
        const source = row.sourceFiles?.[0] ?? "Unknown file";
        entry.samples.add(`${source} • ${row.dateISO}`);
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
    const samples: string[] = [];
    for (const [token, entry] of unmatchedSamples.entries()) {
      const employeeIds = Array.from(entry.employeeIds).filter(Boolean);
      const idLabel = employeeIds.length
        ? `${employeeIds.length > 1 ? "Employee IDs" : "Employee ID"}: ${employeeIds.join(", ")}`
        : "Employee ID: n/a";
      const sampleSnippets = Array.from(entry.samples).slice(0, 3);
      const sampleLabel = sampleSnippets.length
        ? `Samples: ${sampleSnippets.join(" | ")}`
        : "";
      const detail = [token, idLabel, sampleLabel].filter(Boolean).join(" — ");
      samples.push(detail);
      if (samples.length >= MAX_WARNING_SAMPLE_COUNT) break;
    }

    warnings.push({
      type: "GENERAL",
      level: "warning",
      message: `Unmatched employees (${unmatchedSamples.size})`,
      count: unmatchedSamples.size,
      samples,
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
      } else {
        map.set(key, {
          type: warning.type,
          level: warning.level,
          message: warning.message,
          count: warning.count,
          samples: warning.samples ? [...warning.samples] : undefined,
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
  const [selectedOffices, setSelectedOffices] = useState<string[]>([]);
  const [exportFilteredOnly, setExportFilteredOnly] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const parseInProgress = useRef(false);
  const lastEvaluatedKey = useRef<string>("");
  const identityCacheRef = useRef<Map<string, IdentityRecord>>(new Map());
  const identitySetCacheRef = useRef<Map<string, Map<string, IdentityRecord>>>(new Map());

  const parsedFiles = useMemo(
    () => files.filter((file) => file.status === "parsed" && file.parsed),
    [files]
  );

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
        const parsed = parseBioAttendance(buffer, { fileName: next.name });
        setFiles((prev) =>
          prev.map((file) =>
            file.id === next.id
              ? { ...file, status: "parsed", parsed, error: undefined }
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
      return {
        ...row,
        employeeName: normalized.employeeName || row.employeeName,
        resolvedEmployeeId: normalized.employeeId,
        officeId: normalized.officeId ?? null,
        officeName: normalized.officeName ?? null,
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
        };

        const chronological = sortPerDayRows(
          result.perDay.map((row) => toChronologicalRow(row))
        );

        setPerDay(chronological);
        setPerEmployee(result.perEmployee);
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

  const filteredPerEmployee = useMemo(() => {
    if (!perEmployee) return [] as PerEmployeeRow[];
    if (!selectedOffices.length) return perEmployee;
    const keys = new Set(selectedOffices);
    return perEmployee.filter((row) =>
      keys.has(
        makeOfficeKey(
          row.officeId ?? null,
          row.officeName ?? (row.resolvedEmployeeId ? UNASSIGNED_OFFICE_LABEL : UNKNOWN_OFFICE_LABEL)
        )
      )
    );
  }, [perEmployee, selectedOffices]);

  const filteredPerDayPreview = useMemo(() => {
    if (!perDay) return [] as PerDayRow[];
    if (!selectedOffices.length) return perDay;
    const keys = new Set(selectedOffices);
    return perDay.filter((row) =>
      keys.has(
        makeOfficeKey(
          row.officeId ?? null,
          row.officeName ?? (row.resolvedEmployeeId ? UNASSIGNED_OFFICE_LABEL : UNKNOWN_OFFICE_LABEL)
        )
      )
    );
  }, [perDay, selectedOffices]);

  useEffect(() => {
    setPage(0);
  }, [filteredPerDayPreview]);

  useEffect(() => {
    if (perDay === null) {
      setSelectedOffices([]);
      setExportFilteredOnly(false);
    }
  }, [perDay]);

  useEffect(() => {
    if (!selectedOffices.length && exportFilteredOnly) {
      setExportFilteredOnly(false);
    }
  }, [exportFilteredOnly, selectedOffices.length]);

  const handleOfficeToggle = useCallback((key: string, nextChecked: boolean) => {
    setSelectedOffices((prev) => {
      if (nextChecked) {
        if (prev.includes(key)) return prev;
        return [...prev, key];
      }
      return prev.filter((value) => value !== key);
    });
  }, []);

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
    if (!filteredPerEmployee.length) return [];
    const rows = [...filteredPerEmployee];
    const multiplier = sortDirection === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const diff = (a[sortKey] as number) - (b[sortKey] as number);
      if (diff !== 0) {
        return diff * multiplier;
      }
      return a.employeeName.localeCompare(b.employeeName);
    });
    return rows;
  }, [filteredPerEmployee, sortDirection, sortKey]);

  const pagedPerDay = useMemo(() => {
    if (!filteredPerDayPreview.length) return [];
    const start = page * PAGE_SIZE;
    return filteredPerDayPreview.slice(start, start + PAGE_SIZE);
  }, [filteredPerDayPreview, page]);

  const totalPages = useMemo(() => {
    if (!filteredPerDayPreview.length) return 0;
    return Math.max(1, Math.ceil(filteredPerDayPreview.length / PAGE_SIZE));
  }, [filteredPerDayPreview]);

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
  }, []);

  const handleRemoveFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
  }, []);

  const handleDownloadResults = useCallback(() => {
    if (!perEmployee?.length || !perDay?.length) return;
    if (useManualPeriod && !manualSelectionValid) return;

    const employees = exportFilteredOnly ? filteredPerEmployee : perEmployee;
    const days = exportFilteredOnly ? filteredPerDayPreview : perDay;

    if (!employees.length || !days.length) {
      toast({
        title: "Export skipped",
        description: "No rows match the current filters.",
      });
      return;
    }

    try {
      exportResultsToXlsx(employees, days);
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
    exportFilteredOnly,
    filteredPerDayPreview,
    filteredPerEmployee,
    manualSelectionValid,
    perDay,
    perEmployee,
    toast,
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

  const totalFiles = files.length;
  const processedFiles = files.filter((file) => file.status === "parsed" || file.status === "failed").length;
  const progress = totalFiles ? Math.round((processedFiles / totalFiles) * 100) : 0;

  return (
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
              {aggregatedWarnings.map((warning) => (
                <div key={`${warning.type}-${warning.message}`} className="text-sm">
                  <p>{warning.message}</p>
                  {warning.samples?.length ? (
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
                      {warning.samples.map((sample, index) => (
                        <li key={`${warning.message}-${index}`}>{sample}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Per-Employee Summary</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={handleUploadMore} disabled={evaluating || hasPendingParses}>
                Upload more
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
          {officeOptions.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/40 p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Office
                </span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      {selectedOffices.length ? `Filter (${selectedOffices.length})` : "Filter"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64" align="start">
                    <div className="space-y-2">
                      {officeOptions.map((option) => (
                        <label
                          key={option.key}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={selectedOffices.includes(option.key)}
                              onCheckedChange={(checked) =>
                                handleOfficeToggle(option.key, Boolean(checked))
                              }
                            />
                            <span>{option.label}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{option.count}</span>
                        </label>
                      ))}
                      {selectedOffices.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => setSelectedOffices([])}
                        >
                          Clear selection
                        </Button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              {selectedOffices.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {selectedOffices.map((key) => (
                    <Badge key={key} variant="secondary" className="flex items-center gap-1">
                      {getOfficeLabel(key)}
                      <button
                        type="button"
                        className="rounded-full p-0.5 hover:bg-muted"
                        onClick={() => handleOfficeToggle(key, false)}
                        aria-label={`Remove ${getOfficeLabel(key)} filter`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 text-xs md:ml-auto">
                <Switch
                  id="export-filtered-only"
                  checked={exportFilteredOnly}
                  disabled={selectedOffices.length === 0}
                  onCheckedChange={(checked) => setExportFilteredOnly(Boolean(checked))}
                />
                <label htmlFor="export-filtered-only" className="text-xs text-muted-foreground">
                  Export filtered only
                </label>
              </div>
            </div>
          )}
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
                  <th className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleSort("lateDays")}
                      className="inline-flex items-center gap-1 font-semibold"
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
                  <th className="p-2 text-center">Late %</th>
                  <th className="p-2 text-center">UT %</th>
                </tr>
              </thead>
              <tbody>
                {sortedPerEmployee.map((row) => {
                  const key = `${row.employeeId}||${row.employeeName}`;
                  const types = row.scheduleTypes ?? [];
                  const sourceLabel = formatScheduleSource(row.scheduleSource);
                  return (
                    <tr key={key} className="odd:bg-muted/20">
                      <td className="p-2">{row.employeeId || "—"}</td>
                      <td className="p-2">{row.employeeName || "—"}</td>
                      <td className="p-2">
                        {row.officeName ||
                          (row.resolvedEmployeeId ? UNASSIGNED_OFFICE_LABEL : UNKNOWN_OFFICE_LABEL)}
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
                      <td className="p-2 text-center">{row.lateDays}</td>
                      <td className="p-2 text-center">{row.undertimeDays}</td>
                      <td className="p-2 text-center">{row.lateRate}%</td>
                      <td className="p-2 text-center">{row.undertimeRate}%</td>
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
              <thead className="sticky top-0 bg-muted/50">
                <tr>
                  <th className="p-2 text-left">Employee ID</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Office</th>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-center">Earliest</th>
                  <th className="p-2 text-center">Latest</th>
                  <th className="p-2 text-center">Worked</th>
                  <th className="p-2 text-left">Schedule</th>
                  <th className="p-2 text-left">Source files</th>
                  <th className="p-2 text-left">Punches</th>
                  <th className="p-2 text-center">Late</th>
                  <th className="p-2 text-center">Undertime</th>
                </tr>
              </thead>
              <tbody>
                {pagedPerDay.map((row, index) => (
                  <tr key={`${row.employeeId}-${row.employeeName}-${row.dateISO}-${index}`} className="odd:bg-muted/20">
                    <td className="p-2">{row.employeeId || "—"}</td>
                    <td className="p-2">{row.employeeName || "—"}</td>
                    <td className="p-2">
                      {row.officeName ||
                        (row.resolvedEmployeeId ? UNASSIGNED_OFFICE_LABEL : UNKNOWN_OFFICE_LABEL)}
                    </td>
                    <td className="p-2">{dateFormatter.format(toDate(row.dateISO))}</td>
                    <td className="p-2 text-center">{row.earliest ?? ""}</td>
                    <td className="p-2 text-center">{row.latest ?? ""}</td>
                    <td className="p-2 text-center">{row.workedHHMM ?? ""}</td>
                    <td className="p-2">
                      {row.scheduleType ? (
                        <Badge variant="outline">{formatScheduleType(row.scheduleType)}</Badge>
                      ) : (
                        ""
                      )}
                    </td>
                    <td className="p-2 text-left text-xs text-muted-foreground">
                      {row.sourceFiles.join(", ")}
                    </td>
                    <td className="p-2 text-left text-xs text-muted-foreground">
                      {row.allTimes.join(", ")}
                    </td>
                    <td className="p-2 text-center">{row.isLate ? "Yes" : "No"}</td>
                    <td className="p-2 text-center">{row.isUndertime ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
