"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowUpDown,
  FileDown,
  Trash2,
  UploadCloud,
  XCircle,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import LinearLoader from "@/components/ui/progress-toast";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import type {
  MergeSummary,
  ParseWarning,
  PerDayRow,
  PerEmployeeRow,
  WorkbookParseResult,
} from "@/utils/parseBioAttendance";

const PAGE_SIZE = 25;

function timeout<T>(promise: Promise<T>, ms = 10_000) {
  return new Promise<T>((resolve, reject) => {
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
}

type SortKey = "lateDays" | "undertimeDays";
type SortDirection = "asc" | "desc";
type ParserModule = typeof import("@/utils/parseBioAttendance");

type FileStatus = "queued" | "parsing" | "parsed" | "failed";

type FileEntry = {
  id: string;
  file: File;
  fileName: string;
  workbookType: "xls" | "xlsx";
  size: number;
  mimeType: string;
  status: FileStatus;
  error?: string;
  result?: WorkbookParseResult;
};

type MixedMonthsPrompt = {
  open: boolean;
  fileId?: string;
  months?: string[];
};

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

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

const toMonthLabel = (value: string) => {
  if (!/^\d{4}-\d{2}$/.test(value)) return "";
  const [year, month] = value.split("-").map(Number);
  return monthFormatter.format(new Date(year, (month ?? 1) - 1, 1));
};

const formatFileSize = (size: number) => {
  if (!Number.isFinite(size)) return "-";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const padDay = (day: number) => String(day).padStart(2, "0");

const statusLabel = (status: FileStatus) => {
  switch (status) {
    case "queued":
      return "Queued";
    case "parsing":
      return "Parsing…";
    case "parsed":
      return "Parsed";
    case "failed":
      return "Failed";
    default:
      return status;
  }
};

const aggregateWarnings = (warnings: ParseWarning[]): ParseWarning[] => {
  const map = new Map<string, ParseWarning>();
  for (const warning of warnings) {
    const key = `${warning.type}|${warning.message}`;
    if (!map.has(key)) {
      map.set(key, {
        type: warning.type,
        message: warning.message,
        count: warning.count,
        examples: [...warning.examples],
      });
      continue;
    }
    const entry = map.get(key)!;
    entry.count += warning.count;
    for (const example of warning.examples) {
      if (!example) continue;
      if (entry.examples.length >= 10) break;
      if (!entry.examples.includes(example)) {
        entry.examples.push(example);
      }
    }
  }
  return Array.from(map.values());
};

export default function BioLogUploader() {
  const { toast } = useToast();
  const parserModuleRef = useRef<ParserModule | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastParsedIdRef = useRef<string | null>(null);
  const evaluationKeyRef = useRef<string>("");
  const evaluationToastKeyRef = useRef<string>("");
  const pendingEvaluationIdRef = useRef(0);

  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [month, setMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  });
  const [perEmployee, setPerEmployee] = useState<PerEmployeeRow[] | null>(null);
  const [perDay, setPerDay] = useState<PerDayRow[] | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("lateDays");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(0);
  const [evaluating, setEvaluating] = useState(false);
  const [activeParseId, setActiveParseId] = useState<string | null>(null);
  const [mergeSummary, setMergeSummary] = useState<MergeSummary | null>(null);
  const [mixedMonthsPrompt, setMixedMonthsPrompt] = useState<MixedMonthsPrompt>({ open: false });
  const [hasConfirmedMixedMonths, setHasConfirmedMixedMonths] = useState(false);

  const loadParserModule = useCallback(async () => {
    if (!parserModuleRef.current) {
      parserModuleRef.current = await import("@/utils/parseBioAttendance");
    }
    return parserModuleRef.current;
  }, []);

  const resetAll = useCallback(() => {
    setFileEntries([]);
    setPerEmployee(null);
    setPerDay(null);
    setMergeSummary(null);
    setPage(0);
    setMixedMonthsPrompt({ open: false });
    setHasConfirmedMixedMonths(false);
    evaluationKeyRef.current = "";
    evaluationToastKeyRef.current = "";
    pendingEvaluationIdRef.current += 1;
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, []);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const parser = Array.from(files);
      if (!parser.length) return;

      const accepted: FileEntry[] = [];
      for (const file of parser) {
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (ext !== "xls" && ext !== "xlsx") {
          toast({
            title: "Unsupported file",
            description: `${file.name} was skipped. Please upload .xls or .xlsx files.`,
            variant: "destructive",
          });
          continue;
        }
        accepted.push({
          id: createId(),
          file,
          fileName: file.name,
          workbookType: ext,
          size: file.size,
          mimeType: file.type,
          status: "queued",
        });
      }

      if (!accepted.length) return;
      setFileEntries((prev) => [...prev, ...accepted]);
    },
    [toast]
  );

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files) {
        handleFiles(files);
      }
    },
    [handleFiles]
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      if (event.dataTransfer?.files?.length) {
        handleFiles(event.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!isDragging) {
      setIsDragging(true);
    }
  }, [isDragging]);

  const onDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleRemoveFile = useCallback((id: string) => {
    setFileEntries((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const handleClearAll = useCallback(() => {
    resetAll();
  }, [resetAll]);

  const handleDownloadNormalized = useCallback((entry: FileEntry) => {
    const buffer = entry.result?.normalizedXlsx;
    if (!buffer) return;
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const normalizedName = `${entry.fileName.replace(/\.xls$/i, "")}.normalized.xlsx`;
    link.href = url;
    link.download = normalizedName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    if (activeParseId) return;
    const next = fileEntries.find((entry) => entry.status === "queued");
    if (!next) return;

    setActiveParseId(next.id);
    setFileEntries((prev) =>
      prev.map((entry) =>
        entry.id === next.id
          ? {
              ...entry,
              status: "parsing",
            }
          : entry
      )
    );

    void (async () => {
      try {
        const parser = await loadParserModule();
        const buffer = await next.file.arrayBuffer();
        const result = await parser.parseBioAttendance(buffer, {
          fileName: next.fileName,
          workbookType: next.workbookType,
        });

        lastParsedIdRef.current = next.id;
        setFileEntries((prev) =>
          prev.map((entry) =>
            entry.id === next.id
              ? {
                  ...entry,
                  status: "parsed",
                  result,
                }
              : entry
          )
        );
      } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : "Failed to parse file.";
        setFileEntries((prev) =>
          prev.map((entry) =>
            entry.id === next.id
              ? {
                  ...entry,
                  status: "failed",
                  error: message,
                }
              : entry
          )
        );
        toast({
          title: `Unable to parse ${next.fileName}`,
          description: message,
          variant: "destructive",
        });
      } finally {
        setActiveParseId(null);
      }
    })();
  }, [activeParseId, fileEntries, loadParserModule, toast]);

  useEffect(() => {
    const parser = parserModuleRef.current;
    if (!parser) {
      if (!fileEntries.some((entry) => entry.status === "parsed")) {
        setMergeSummary(null);
      }
      return;
    }

    const parsedEntries = fileEntries.filter((entry) => entry.status === "parsed" && entry.result);
    if (!parsedEntries.length) {
      setMergeSummary(null);
      return;
    }

    const summary = parser.mergeParsedRows(
      parsedEntries.map((entry) => ({
        fileName: entry.fileName,
        rows: entry.result!.rows,
      }))
    );
    setMergeSummary(summary);
  }, [fileEntries]);

  useEffect(() => {
    if (!mergeSummary || mergeSummary.months.length <= 1) {
      if (mergeSummary?.months.length ?? 0 <= 1) {
        setHasConfirmedMixedMonths(false);
      }
      if (mixedMonthsPrompt.open) {
        setMixedMonthsPrompt({ open: false });
      }
      return;
    }

    if (hasConfirmedMixedMonths) return;
    const lastParsedId = lastParsedIdRef.current;
    if (!lastParsedId) return;

    setMixedMonthsPrompt({
      open: true,
      fileId: lastParsedId,
      months: mergeSummary.months,
    });
  }, [hasConfirmedMixedMonths, mergeSummary, mixedMonthsPrompt.open]);

  const aggregatedWarnings = useMemo(() => {
    const collected: ParseWarning[] = [];
    for (const entry of fileEntries) {
      if (entry.status === "parsed") {
        collected.push(...(entry.result?.warnings ?? []));
      }
    }
    if (mergeSummary) {
      collected.push(...mergeSummary.warnings);
    }
    return aggregateWarnings(collected);
  }, [fileEntries, mergeSummary]);

  const daySourceLookup = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!mergeSummary) return map;
    for (const row of mergeSummary.perDay) {
      map.set(`${row.employeeId}|${row.month}-${padDay(row.day)}`, row.sourceFiles);
    }
    return map;
  }, [mergeSummary]);

  const parsedCount = fileEntries.filter((entry) => entry.status === "parsed").length;
  const failedCount = fileEntries.filter((entry) => entry.status === "failed").length;
  const totalFiles = fileEntries.length;
  const isParsing = fileEntries.some((entry) => entry.status === "parsing");
  const progressValue = totalFiles > 0 ? ((parsedCount + failedCount) / totalFiles) * 100 : undefined;

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

  useEffect(() => {
    setPage(0);
  }, [perDay]);

  const totalPages = useMemo(() => {
    if (!perDay?.length) return 0;
    return Math.max(1, Math.ceil(perDay.length / PAGE_SIZE));
  }, [perDay]);

  const pagedPerDay = useMemo(() => {
    if (!perDay) return [];
    const start = page * PAGE_SIZE;
    return perDay.slice(start, start + PAGE_SIZE);
  }, [perDay, page]);

  const handleSort = useCallback(
    (key: SortKey) => {
      setSortDirection((prev) => (sortKey === key ? (prev === "asc" ? "desc" : "asc") : "desc"));
      setSortKey(key);
    },
    [sortKey]
  );

  const handleDownload = useCallback(async () => {
    if (!perEmployee?.length || !perDay?.length) return;

    try {
      const parser = await loadParserModule();
      parser.exportResultsToXlsx(perEmployee, perDay);
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
  }, [loadParserModule, perDay, perEmployee, toast]);

  const handleUploadMore = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleMonthChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setMonth(event.target.value);
  }, []);

  useEffect(() => {
    if (!mergeSummary) {
      setPerDay(null);
      setPerEmployee(null);
      evaluationKeyRef.current = "";
      return;
    }

    if (mixedMonthsPrompt.open) return;

    const relevantRows = mergeSummary.perDay.filter((row) => row.month === month);
    if (!relevantRows.length) {
      setPerDay([]);
      setPerEmployee([]);
      evaluationKeyRef.current = `empty:${month}`;
      return;
    }

    const payloadKey = `${month}|${relevantRows.length}|${relevantRows
      .map((row) => `${row.employeeId}|${row.day}|${row.allTimes.join(",")}`)
      .join(";")}`;

    if (payloadKey === evaluationKeyRef.current) {
      return;
    }

    evaluationKeyRef.current = payloadKey;
    setEvaluating(true);
    const requestId = ++pendingEvaluationIdRef.current;

    void (async () => {
      try {
        const response = await timeout(
          fetch("/api/attendance/evaluate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              monthISO: month,
              perDay: relevantRows.map((row) => ({
                employeeId: row.employeeId,
                employeeName: row.employeeName,
                day: row.day,
                earliest: row.earliest,
                latest: row.latest,
                allTimes: row.allTimes,
              })),
            }),
          })
        );

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "Unable to evaluate attendance.");
        }

        const evaluated = (await response.json()) as {
          perDay: PerDayRow[];
          perEmployee: PerEmployeeRow[];
        };

        if (pendingEvaluationIdRef.current !== requestId) return;

        setPerDay(evaluated.perDay);
        setPerEmployee(evaluated.perEmployee);

        const toastKey = `${payloadKey}|${month}`;
        if (evaluationToastKeyRef.current !== toastKey) {
          evaluationToastKeyRef.current = toastKey;
          toast({
            title: "Parsed successfully",
            description: `${evaluated.perEmployee.length} employees evaluated for ${toMonthLabel(month)}.`,
          });
        }
      } catch (error) {
        console.error(error);
        if (pendingEvaluationIdRef.current !== requestId) return;
        setPerDay([]);
        setPerEmployee([]);
        toast({
          title: "Processing failed",
          description: error instanceof Error ? error.message : "Unable to process files.",
          variant: "destructive",
        });
      } finally {
        if (pendingEvaluationIdRef.current === requestId) {
          setEvaluating(false);
        }
      }
    })();
  }, [mergeSummary, mixedMonthsPrompt.open, month, toast]);

  const isParsing = fileEntries.some((entry) => entry.status === "parsing");
  const isBusy = evaluating || isParsing;

  const summaryLabel = useMemo(() => {
    if (!mergeSummary) return null;
    const rows = mergeSummary.totalPunches;
    const uniqueEmployees = mergeSummary.uniqueEmployees;
    const { from, to } = mergeSummary.dateRange;
    const rangeLabel = from && to ? (from === to ? from : `${from} – ${to}`) : "—";
    return {
      files: fileEntries.length,
      rows,
      uniqueEmployees,
      rangeLabel,
    };
  }, [fileEntries.length, mergeSummary]);

  const handleConfirmMixedMonths = useCallback(() => {
    setHasConfirmedMixedMonths(true);
    setMixedMonthsPrompt({ open: false });
  }, []);

  const handleCancelMixedMonths = useCallback(() => {
    if (mixedMonthsPrompt.fileId) {
      setFileEntries((prev) => prev.filter((entry) => entry.id !== mixedMonthsPrompt.fileId));
    }
    lastParsedIdRef.current = null;
    setMixedMonthsPrompt({ open: false });
    setHasConfirmedMixedMonths(false);
  }, [mixedMonthsPrompt.fileId]);

  const renderStatus = (entry: FileEntry) => {
    if (entry.status === "parsed") {
      const rowsCount = entry.result?.rows.length ?? 0;
      const sheets = entry.result?.sheetsParsed ?? 0;
      return `Parsed • ${rowsCount} rows${sheets ? ` • ${sheets} sheet${sheets === 1 ? "" : "s"}` : ""}`;
    }
    if (entry.status === "failed" && entry.error) {
      return `Failed • ${entry.error}`;
    }
    return statusLabel(entry.status);
  };

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
            We use this month to match work schedules for each employee day.
          </p>
        </div>
        {perDay?.length ? (
          <div className="text-sm text-muted-foreground">
            Showing results for <span className="font-medium text-foreground">{toMonthLabel(month)}</span>
          </div>
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
          <p className="font-medium">Drag & drop Excel files here</p>
          <p className="text-sm text-muted-foreground">Accepts .xlsx or .xls (multiple files supported)</p>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <input
            ref={inputRef}
            id="biometrics-file"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleInputChange}
            className="hidden"
            multiple
            disabled={isBusy}
          />
          <label htmlFor="biometrics-file">
            <Button disabled={isBusy}>{isBusy ? "Processing…" : "Choose files"}</Button>
          </label>
          {fileEntries.length > 0 ? (
            <Button variant="ghost" onClick={handleClearAll} disabled={isParsing}>
              <XCircle className="mr-2 h-4 w-4" />
              Clear all
            </Button>
          ) : null}
        </div>
        {fileEntries.length > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">{fileEntries.length} file{fileEntries.length === 1 ? "" : "s"} in queue</p>
        ) : null}
      </div>

      {isParsing && fileEntries.length > 0 ? (
        <LinearLoader label="Parsing files" value={progressValue} height={6} className="max-w-md" />
      ) : null}

      {fileEntries.length > 0 ? (
        <div className="space-y-3">
          {fileEntries.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-sm sm:text-base">{entry.fileName}</span>
                  <Badge variant="secondary">{entry.workbookType.toUpperCase()}</Badge>
                  <span className="text-xs text-muted-foreground">{formatFileSize(entry.size)}</span>
                </div>
                <p className="text-xs text-muted-foreground">{renderStatus(entry)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {entry.status === "parsed" && entry.workbookType === "xls" && entry.result?.normalizedXlsx ? (
                  <Button variant="outline" size="sm" onClick={() => handleDownloadNormalized(entry)}>
                    <FileDown className="mr-2 h-4 w-4" />
                    Download normalized .xlsx
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveFile(entry.id)}
                  disabled={entry.status === "parsing"}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {summaryLabel ? (
        <div className="rounded-xl border bg-muted/40 p-4">
          <p className="font-semibold mb-2">Summary</p>
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-muted-foreground">Files</p>
              <p className="font-medium">{summaryLabel.files}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Rows parsed</p>
              <p className="font-medium">{summaryLabel.rows}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Unique employees</p>
              <p className="font-medium">{summaryLabel.uniqueEmployees}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Date range</p>
              <p className="font-medium">{summaryLabel.rangeLabel}</p>
            </div>
          </div>
        </div>
      ) : null}

      {aggregatedWarnings.length ? (
        <Alert variant="warning" className="space-y-2">
          <AlertTitle>Warnings</AlertTitle>
          {aggregatedWarnings.map((warning) => (
            <AlertDescription key={`${warning.type}-${warning.message}`} className="space-y-1">
              <p>
                {warning.message}
                {warning.count > 1 ? ` (x${warning.count})` : ""}
              </p>
              {warning.examples.length ? (
                <ul className="list-disc pl-5 text-xs text-muted-foreground">
                  {warning.examples.map((example) => (
                    <li key={example}>{example}</li>
                  ))}
                </ul>
              ) : null}
            </AlertDescription>
          ))}
        </Alert>
      ) : null}

      {perEmployee && perDay && perEmployee.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Per-Employee Summary</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={handleUploadMore} disabled={isBusy}>
                Add more files
              </Button>
              <Button onClick={handleDownload} disabled={!perEmployee.length || !perDay.length || isBusy}>
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
                      <ArrowUpDown className={cn("h-3.5 w-3.5", sortKey === "lateDays" ? "opacity-100" : "opacity-40")} />
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
                        className={cn("h-3.5 w-3.5", sortKey === "undertimeDays" ? "opacity-100" : "opacity-40")}
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
                  <th className="p-2 text-center">Day</th>
                  <th className="p-2 text-center">Earliest</th>
                  <th className="p-2 text-center">Latest</th>
                  <th className="p-2 text-center">Worked</th>
                  <th className="p-2 text-center">Schedule</th>
                  <th className="p-2 text-center">Files</th>
                  <th className="p-2 text-center">Source</th>
                  <th className="p-2 text-center">Late</th>
                  <th className="p-2 text-center">Undertime</th>
                </tr>
              </thead>
              <tbody>
                {pagedPerDay.map((row, index) => {
                  const dayKey = `${row.employeeId}|${month}-${padDay(row.day)}`;
                  const files = daySourceLookup.get(dayKey) ?? [];
                  return (
                    <tr key={`${row.employeeId}-${row.employeeName}-${index}`} className="odd:bg-muted/20">
                      <td className="p-2">{row.employeeId || "—"}</td>
                      <td className="p-2">{row.employeeName || "—"}</td>
                      <td className="p-2 text-center">{row.day}</td>
                      <td className="p-2 text-center">{row.earliest ?? ""}</td>
                      <td className="p-2 text-center">{row.latest ?? ""}</td>
                      <td className="p-2 text-center">{row.workedHHMM ?? ""}</td>
                      <td className="p-2 text-center">
                        {row.scheduleType ? (
                          <Badge variant="outline">{formatScheduleType(row.scheduleType)}</Badge>
                        ) : (
                          ""
                        )}
                      </td>
                      <td className="p-2 text-center text-xs text-muted-foreground">
                        {files.length ? files.join(", ") : "—"}
                      </td>
                      <td className="p-2 text-center">{formatScheduleSource(row.scheduleSource) ?? ""}</td>
                      <td className="p-2 text-center">{row.isLate ? "Yes" : "No"}</td>
                      <td className="p-2 text-center">{row.isUndertime ? "Yes" : "No"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={mixedMonthsPrompt.open} onOpenChange={(open) => setMixedMonthsPrompt((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge across multiple months?</DialogTitle>
            <DialogDescription>
              We detected logs spanning multiple months ({mixedMonthsPrompt.months?.join(", ")}). Proceed to merge them?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelMixedMonths}>
              Cancel
            </Button>
            <Button onClick={handleConfirmMixedMonths} autoFocus>
              Yes, merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
