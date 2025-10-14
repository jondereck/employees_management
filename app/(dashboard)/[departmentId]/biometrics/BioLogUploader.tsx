"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDown, UploadCloud, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import type { PerDayRow, PerEmployeeRow } from "@/utils/parseBioAttendance";

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

const PAGE_SIZE = 25;

type SortKey = "lateDays" | "undertimeDays";
type SortDirection = "asc" | "desc";

type ParserModule = typeof import("@/utils/parseBioAttendance");

type EvaluationResponse = {
  perDay: PerDayRow[];
  perEmployee: PerEmployeeRow[];
};

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

const formatScheduleType = (value?: string | null) => {
  if (!value) return null;
  return value.charAt(0) + value.slice(1).toLowerCase();
};

const toMonthLabel = (value: string) => {
  if (!/^\d{4}-\d{2}$/.test(value)) return "";
  const [year, month] = value.split("-").map(Number);
  return monthFormatter.format(new Date(year, (month ?? 1) - 1, 1));
};

export default function BioLogUploader() {
  const { toast } = useToast();
  const [perEmployee, setPerEmployee] = useState<PerEmployeeRow[] | null>(null);
  const [perDay, setPerDay] = useState<PerDayRow[] | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [processing, setProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("lateDays");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(0);
  const [month, setMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  });

  const parserModuleRef = useRef<ParserModule | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const loadParserModule = useCallback(async () => {
    if (!parserModuleRef.current) {
      parserModuleRef.current = await import("@/utils/parseBioAttendance");
    }
    return parserModuleRef.current;
  }, []);

  const resetState = useCallback(() => {
    setPerEmployee(null);
    setPerDay(null);
    setFileName("");
    setPage(0);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, []);

  const handleSort = useCallback((key: SortKey) => {
    setSortDirection((prev) => (sortKey === key ? (prev === "asc" ? "desc" : "asc") : "desc"));
    setSortKey(key);
  }, [sortKey]);

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

  const handleFile = useCallback(async (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension !== "xlsx") {
      toast({
        title: "Unsupported file",
        description: "Please upload a .xlsx file. Convert .xls files before uploading.",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    setFileName(file.name);
    setPerDay(null);
    setPerEmployee(null);

    try {
      if (!month) {
        throw new Error("Please select the attendance month before uploading.");
      }

      const parser = await loadParserModule();
      const buf = await file.arrayBuffer();
      const parsed = parser.parseBioAttendance(buf);

      if (!parsed.perDay.length) {
        setPerDay([]);
        setPerEmployee([]);
        toast({
          title: "No rows detected",
          description: "We could not find any attendance entries in this workbook.",
        });
        return;
      }

      const response = await timeout(
        fetch("/api/attendance/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ monthISO: month, perDay: parsed.perDay }),
        })
      );

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Unable to evaluate attendance.");
      }

      const evaluated = (await response.json()) as EvaluationResponse;
      setPerDay(evaluated.perDay);
      setPerEmployee(evaluated.perEmployee);
      setPage(0);
      toast({
        title: "Parsed successfully",
        description: `${evaluated.perEmployee.length} employees evaluated for ${toMonthLabel(month)}.`,
      });
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Unable to process file";
      toast({
        title: "Processing failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  }, [loadParserModule, month, toast]);

  const onInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void handleFile(file);
    }
  }, [handleFile]);

  const onDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void handleFile(file);
    }
  }, [handleFile]);

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!isDragging) {
      setIsDragging(true);
    }
  }, [isDragging]);

  const onDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

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

  const handleUploadAnother = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const isBusy = processing;

  const handleMonthChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setMonth(event.target.value);
  }, []);

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
          <p className="font-medium">Drag & drop the Excel file here</p>
          <p className="text-sm text-muted-foreground">
            Accepts .xlsx (convert .xls first)
          </p>
        </div>
        <div className="mt-4 flex items-center justify-center gap-3">
          <input
            ref={inputRef}
            id="biometrics-file"
            type="file"
            accept=".xlsx"
            onChange={onInput}
            className="hidden"
            disabled={isBusy}
          />
          <label htmlFor="biometrics-file">
            <Button disabled={isBusy}>{isBusy ? "Processing..." : "Choose file"}</Button>
          </label>
          {fileName && (
            <Button variant="ghost" onClick={resetState} disabled={isBusy}>
              <XCircle className="mr-2 h-4 w-4" />
              Clear file
            </Button>
          )}
        </div>
        {fileName && (
          <p className="mt-3 text-xs text-muted-foreground">Selected: {fileName}</p>
        )}
      </div>

      {perEmployee && perDay && perEmployee.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Per-Employee Summary</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={handleUploadAnother} disabled={isBusy}>
                Upload another
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
                  <th className="p-2 text-center">Late</th>
                  <th className="p-2 text-center">Undertime</th>
                </tr>
              </thead>
              <tbody>
                {pagedPerDay.map((row, index) => (
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
