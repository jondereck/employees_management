"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDown, UploadCloud, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import type { PerDayRow, PerEmployeeRow } from "@/utils/parseBioAttendance";

const PAGE_SIZE = 25;

type SortKey = "lateDays" | "undertimeDays";
type SortDirection = "asc" | "desc";

type ParserModule = typeof import("@/utils/parseBioAttendance");

export default function BioLogUploader() {
  const { toast } = useToast();
  const [perEmployee, setPerEmployee] = useState<PerEmployeeRow[] | null>(null);
  const [perDay, setPerDay] = useState<PerDayRow[] | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [isParsing, setIsParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("lateDays");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(0);

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

  const parseFile = useCallback(async (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension !== "xlsx") {
      toast({
        title: "Unsupported file",
        description: "Please upload a .xlsx file. Convert .xls files before uploading.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsParsing(true);
      setFileName(file.name);
      const buf = await file.arrayBuffer();
      const parser = await loadParserModule();
      const { perDay: parsedPerDay, perEmployee: parsedPerEmployee } = parser.parseBioAttendance(buf);
      setPerDay(parsedPerDay);
      setPerEmployee(parsedPerEmployee);
      setPage(0);
      toast({
        title: "Parsed successfully",
        description: `${parsedPerEmployee.length} employees found`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Parse failed",
        description: error instanceof Error ? error.message : "Invalid file",
        variant: "destructive",
      });
    } finally {
      setIsParsing(false);
    }
  }, [loadParserModule, toast]);

  const onInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void parseFile(file);
    }
  }, [parseFile]);

  const onDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void parseFile(file);
    }
  }, [parseFile]);

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

  return (
    <div className="space-y-6">
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
            disabled={isParsing}
          />
          <label htmlFor="biometrics-file">
            <Button disabled={isParsing}>{isParsing ? "Parsing..." : "Choose file"}</Button>
          </label>
          {fileName && (
            <Button variant="ghost" onClick={resetState} disabled={isParsing}>
              <XCircle className="h-4 w-4 mr-2" />
              Clear file
            </Button>
          )}
        </div>
        {fileName && (
          <p className="text-xs text-muted-foreground mt-3">Selected: {fileName}</p>
        )}
      </div>

      {perEmployee && perDay && perEmployee.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Per-Employee Summary</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={handleUploadAnother} disabled={isParsing}>
                Upload another
              </Button>
              <Button onClick={handleDownload} disabled={!perEmployee.length || !perDay.length || isParsing}>
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
                      <ArrowUpDown className={cn("h-3.5 w-3.5", sortKey === "undertimeDays" ? "opacity-100" : "opacity-40")} />
                    </button>
                  </th>
                  <th className="p-2 text-center">Late %</th>
                  <th className="p-2 text-center">UT %</th>
                </tr>
              </thead>
              <tbody>
                {sortedPerEmployee.map((row) => (
                  <tr key={`${row.employeeId}-${row.employeeName}`} className="odd:bg-muted/20">
                    <td className="p-2">{row.employeeId || "—"}</td>
                    <td className="p-2">{row.employeeName || "—"}</td>
                    <td className="p-2 text-center">{row.daysWithLogs}</td>
                    <td className="p-2 text-center">{row.lateDays}</td>
                    <td className="p-2 text-center">{row.undertimeDays}</td>
                    <td className="p-2 text-center">{row.lateRate}%</td>
                    <td className="p-2 text-center">{row.undertimeRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-6">
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
          <div className="overflow-x-auto rounded-xl border max-h-[420px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="p-2 text-left">Employee ID</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-center">Day</th>
                  <th className="p-2 text-center">Earliest</th>
                  <th className="p-2 text-center">Latest</th>
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
