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
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  exportResultsToXlsx,
  mergeParsedWorkbooks,
  parseBioAttendance,
  type MergeResult,
  type ParseWarning,
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

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
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

type SortKey = "lateDays" | "undertimeDays";
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
            if (samples.size >= 10) break;
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

const toMonthLabel = (value: string) => {
  if (!/^\d{4}-\d{2}$/.test(value)) return "All months";
  const [year, month] = value.split("-").map(Number);
  return monthFormatter.format(new Date(year, (month ?? 1) - 1, 1));
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
  const [month, setMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  });
  const [showMixedMonthsPrompt, setShowMixedMonthsPrompt] = useState(false);
  const [mixedMonthsContext, setMixedMonthsContext] = useState<{
    key: string;
    months: string[];
    confirmed: boolean;
  }>({ key: "", months: [], confirmed: true });

  const inputRef = useRef<HTMLInputElement | null>(null);
  const parseInProgress = useRef(false);
  const lastEvaluatedKey = useRef<string>("");

  const parsedFiles = useMemo(
    () => files.filter((file) => file.status === "parsed" && file.parsed),
    [files]
  );

  const mergeResult = useMemo(() => {
    if (!parsedFiles.length) return null;
    return mergeParsedWorkbooks(parsedFiles.map((file) => file.parsed!));
  }, [parsedFiles]);

  const filteredPerDay = useMemo(() => {
    if (!mergeResult) return [];
    if (!month) return mergeResult.perDay;
    return mergeResult.perDay.filter((row) => row.dateISO.startsWith(month));
  }, [mergeResult, month]);

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
    if (!sources.length) return [];
    return aggregateWarnings(sources);
  }, [parsedFiles, mergeResult]);

  const aggregatedWarningLevel = aggregatedWarnings.some(
    (warning) => warning.level === "warning"
  )
    ? "warning"
    : "info";

  const hasPendingParses = files.some(
    (file) => file.status === "parsing" || file.status === "queued"
  );

  useEffect(() => {
    if (!mergeResult || !mergeResult.perDay.length) {
      setPerDay(null);
      setPerEmployee(null);
      lastEvaluatedKey.current = "";
      return;
    }
    if (hasPendingParses) return;
    if (mergeResult.months.length > 1 && !mixedMonthsContext.confirmed) return;

    const entries = filteredPerDay;
    const keyPrefix = month || "all";
    if (!entries.length) {
      setPerDay([]);
      setPerEmployee([]);
      lastEvaluatedKey.current = `${keyPrefix}:empty`;
      return;
    }

    const payloadKey = `${keyPrefix}:${entries.length}:${entries
      .map((row) => `${row.employeeToken}:${row.dateISO}:${row.allTimes.join("|")}`)
      .join("#")}`;
    if (payloadKey === lastEvaluatedKey.current) return;

    const controller = new AbortController();
    const evaluate = async () => {
      setEvaluating(true);
      try {
        const body = {
          entries: entries.map((row) => ({
            employeeId: row.employeeId,
            employeeName: row.employeeName,
            employeeToken: row.employeeToken,
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

        const chronological = [...result.perDay].sort((a, b) => {
          const tokenDiff = (a.employeeToken ?? a.employeeId).localeCompare(
            b.employeeToken ?? b.employeeId
          );
          if (tokenDiff !== 0) return tokenDiff;
          return a.dateISO.localeCompare(b.dateISO);
        });

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
    mergeResult,
    filteredPerDay,
    month,
    hasPendingParses,
    mixedMonthsContext.confirmed,
    toast,
  ]);

  useEffect(() => {
    setPage(0);
  }, [perDay]);

  useEffect(() => {
    setPage(0);
  }, [month]);

  const sortedPerEmployee = useMemo(() => {
    if (!perEmployee) return [];
    const rows = [...perEmployee];
    const multiplier = sortDirection === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const diff = (a[sortKey] as number) - (b[sortKey] as number);
      if (diff !== 0) {
        return diff * multiplier;
      }
      return a.employeeName.localeCompare(b.employeeName);
    });
    return rows;
  }, [perEmployee, sortDirection, sortKey]);

  const pagedPerDay = useMemo(() => {
    if (!perDay) return [];
    const start = page * PAGE_SIZE;
    return perDay.slice(start, start + PAGE_SIZE);
  }, [perDay, page]);

  const totalPages = useMemo(() => {
    if (!perDay?.length) return 0;
    return Math.max(1, Math.ceil(perDay.length / PAGE_SIZE));
  }, [perDay]);

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

  const handleMonthChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setMonth(event.target.value);
    lastEvaluatedKey.current = "";
  }, []);

  const handleRemoveFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
  }, []);

  const handleDownloadResults = useCallback(() => {
    if (!perEmployee?.length || !perDay?.length) return;
    try {
      exportResultsToXlsx(perEmployee, perDay);
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
  }, [perDay, perEmployee, toast]);

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
    return {
      fileCount: parsedFiles.length,
      rowsParsed: mergeResult.perDay.length,
      selectedRows: filteredPerDay.length,
      totalPunches: mergeResult.totalPunches,
      employees: mergeResult.employeeCount,
      dateRange: formatDateRange(mergeResult.dateRange),
    };
  }, [mergeResult, parsedFiles.length, filteredPerDay.length]);

  const totalFiles = files.length;
  const processedFiles = files.filter((file) => file.status === "parsed" || file.status === "failed").length;
  const progress = totalFiles ? Math.round((processedFiles / totalFiles) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium">Attendance month</p>
          <Input
            type="month"
            value={month}
            onChange={handleMonthChange}
            max="9999-12"
            className="w-full sm:w-60"
          />
          <p className="text-xs text-muted-foreground">
            We use this month to match employee schedules when evaluating merged logs.
          </p>
        </div>
        {perDay?.length ? (
          <div className="text-sm text-muted-foreground">
            Showing results for <span className="font-medium text-foreground">{toMonthLabel(month)}</span>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Biometrics Logs</h2>
        <p className="text-sm text-muted-foreground">
          Upload one or more biometrics logs (.xls or .xlsx). We will normalize legacy files, merge punches across files, and compute lateness/undertime per employee.
        </p>
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
            {summary.selectedRows !== summary.rowsParsed ? (
              <div>
                <p className="text-muted-foreground">Rows in month</p>
                <p className="font-semibold text-foreground">{summary.selectedRows}</p>
              </div>
            ) : null}
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

      {perEmployee && perDay && perEmployee.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Per-Employee Summary</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={handleUploadMore} disabled={evaluating || hasPendingParses}>
                Upload more
              </Button>
              <Button onClick={handleDownloadResults} disabled={!perEmployee.length || !perDay.length || evaluating}>
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
                  <th className="p-2 text-left">Schedule</th>
                  <th className="p-2 text-center">Days</th>
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
