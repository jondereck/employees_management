"use client";

import * as React from "react";
import { useState, useMemo, useCallback } from "react";
import {
  RawRecord,
  EmployeeMatch,
  Schedule,
  UploadResponse,
  UnmatchedRecord,
  AttendanceEmployeeInfo,
} from "@/lib/attendance/types";
import { aggregateEmployee } from "@/lib/attendance/compute";
import { UNASSIGNED_OFFICE_KEY } from "@/lib/attendance/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Download,
  Filter,
  Loader2,
  RefreshCw,
  UploadCloud,
  UserSearch,
} from "lucide-react";

const defaultSchedule: Schedule = { start: "08:00", end: "17:00", graceMin: 0 };

const formatDateRange = (raw: RawRecord[]) => {
  const dates = new Set<string>();
  raw.forEach((record) => {
    record.punches.forEach((punch) => {
      if (punch.date) {
        dates.add(punch.date);
      }
    });
  });
  if (!dates.size) return null;
  const sorted = Array.from(dates).sort();
  return { start: sorted[0], end: sorted[sorted.length - 1] };
};

type SummaryRow = {
  id: string;
  employee: string;
  office: string;
  daysPresent: number;
  tardyCount: number;
  tardyMinutes: number;
  underCount: number;
  underMinutes: number;
  exceptions: number;
};

type DetailRow = {
  id: string;
  date: string;
  employee: string;
  office: string;
  firstIn: string;
  lastOut: string;
  tardyMinutes: number;
  underMinutes: number;
  exception: string;
};

type AttendanceClientProps = {
  departmentId: string;
  initialEmployees: AttendanceEmployeeInfo[];
  initialOffices: { id: string; name: string }[];
};

const summaryColumns: ColumnDef<SummaryRow>[] = [
  {
    accessorKey: "employee",
    header: "Employee",
  },
  {
    accessorKey: "office",
    header: "Office",
  },
  {
    accessorKey: "daysPresent",
    header: "Days Present",
  },
  {
    accessorKey: "tardyCount",
    header: "Tardy (count)",
  },
  {
    accessorKey: "tardyMinutes",
    header: "Tardy (mins)",
  },
  {
    accessorKey: "underCount",
    header: "Undertime (count)",
  },
  {
    accessorKey: "underMinutes",
    header: "Undertime (mins)",
  },
  {
    accessorKey: "exceptions",
    header: "Exceptions",
    cell: ({ row }) => {
      const value = row.original.exceptions;
      return value > 0 ? `${value} day(s)` : "—";
    },
  },
];

const detailColumns: ColumnDef<DetailRow>[] = [
  {
    accessorKey: "date",
    header: "Date",
  },
  {
    accessorKey: "employee",
    header: "Employee",
  },
  {
    accessorKey: "office",
    header: "Office",
  },
  {
    accessorKey: "firstIn",
    header: "First IN",
    cell: ({ row }) => row.original.firstIn || "—",
  },
  {
    accessorKey: "lastOut",
    header: "Last OUT",
    cell: ({ row }) => row.original.lastOut || "—",
  },
  {
    accessorKey: "tardyMinutes",
    header: "Tardy (mins)",
  },
  {
    accessorKey: "underMinutes",
    header: "Undertime (mins)",
  },
  {
    accessorKey: "exception",
    header: "Exception",
    cell: ({ row }) => row.original.exception || "—",
  },
];

export function AttendanceClient({
  departmentId,
  initialEmployees,
  initialOffices,
}: AttendanceClientProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadData, setUploadData] = useState<UploadResponse | null>(null);
  const [monthValue, setMonthValue] = useState("");
  const [employees, setEmployees] = useState(initialEmployees);
  const [offices, setOffices] = useState(initialOffices);
  const [schedule, setSchedule] = useState<Schedule>(defaultSchedule);
  const [officeFilter, setOfficeFilter] = useState<string[]>([]);
  const [summaryRows, setSummaryRows] = useState<SummaryRow[]>([]);
  const [detailRows, setDetailRows] = useState<DetailRow[]>([]);
  const [needsRecompute, setNeedsRecompute] = useState(false);
  const [isComputing, setIsComputing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mappingDrafts, setMappingDrafts] = useState<Record<string, string>>({});
  const [pendingMappings, setPendingMappings] = useState<Record<string, string>>({});
  const [isSavingMappings, setIsSavingMappings] = useState(false);
  const [exportState, setExportState] = useState<Record<string, boolean>>({});

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const employeeById = useMemo(() => {
    return new Map<string, AttendanceEmployeeInfo>(
      employees.map((employee) => [employee.id, employee])
    );
  }, [employees]);

  const officeById = useMemo(() => {
    return new Map<string, string>(offices.map((office) => [office.id, office.name]));
  }, [offices]);

  const unmatchedCount = uploadData?.unmatched.length ?? 0;
  const pendingCount = Object.keys(pendingMappings).length;

  const computeTables = useCallback(
    (matches: EmployeeMatch[], scheduleValue: Schedule, officeSelection: string[]) => {
      const selected = officeSelection.length ? new Set(officeSelection) : null;
      const summary: SummaryRow[] = [];
      const detail: DetailRow[] = [];

      matches.forEach((match) => {
        const employee = employeeById.get(match.employeeId);
        if (!employee) {
          return;
        }
        const officeId = employee.officeId ?? match.officeId ?? null;
        const officeKey = officeId ?? UNASSIGNED_OFFICE_KEY;
        if (selected && !selected.has(officeKey)) {
          return;
        }
        const officeName = officeId
          ? officeById.get(officeId) ?? employee.officeName ?? "Unassigned"
          : "Unassigned";

        const { summary: employeeSummary, detail: employeeDetail } = aggregateEmployee(
          match,
          scheduleValue
        );

        summary.push({
          id: match.employeeId,
          employee: employee.name,
          office: officeName,
          daysPresent: employeeSummary.present,
          tardyCount: employeeSummary.tardyCount,
          tardyMinutes: employeeSummary.tardyMin,
          underCount: employeeSummary.underCount,
          underMinutes: employeeSummary.underMin,
          exceptions: employeeSummary.exceptions,
        });

        employeeDetail.forEach((day) => {
          detail.push({
            id: `${match.employeeId}-${day.date}`,
            date: day.date,
            employee: employee.name,
            office: officeName,
            firstIn: day.firstIn ?? "",
            lastOut: day.lastOut ?? "",
            tardyMinutes: day.tardyMin,
            underMinutes: day.underMin,
            exception: day.exception ?? "",
          });
        });
      });

      summary.sort((a, b) => a.employee.localeCompare(b.employee));
      detail.sort((a, b) => a.date.localeCompare(b.date) || a.employee.localeCompare(b.employee));

      setSummaryRows(summary);
      setDetailRows(detail);
      setNeedsRecompute(false);
    },
    [employeeById, officeById]
  );

  const dateRange = useMemo(() => {
    if (!uploadData) return null;
    return formatDateRange(uploadData.raw);
  }, [uploadData]);

  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file);
    setUploadError(null);
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!isDragging) setIsDragging(true);
  };

  const onDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError("Select a .xls or .xlsx file to continue.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("departmentId", departmentId);
      if (monthValue) {
        formData.append("month", monthValue);
      }

      const response = await fetch("/api/hrps/attendance/uploads", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        const message = error?.error ?? "Failed to parse attendance file.";
        setUploadError(message);
        toast({
          variant: "destructive",
          title: "Upload failed",
          description: message,
        });
        return;
      }

      const data: UploadResponse = await response.json();
      setUploadData(data);
      setMonthValue(data.month ?? monthValue);
      setEmployees(data.employees);
      setOffices(data.offices);
      setOfficeFilter([]);
      setMappingDrafts({});
      setPendingMappings({});
      handleFileSelect(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      computeTables(data.matched, schedule, []);
      setActiveTab("review");
      toast({
        title: "Attendance parsed",
        description: "Review mappings and schedule before exporting.",
      });
    } catch (error) {
      console.error(error);
      setUploadError("Unexpected error while uploading attendance file.");
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "Unexpected error while uploading attendance file.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleScheduleChange = (key: keyof Schedule, value: string) => {
    setSchedule((prev) => {
      if (key === "graceMin") {
        const numeric = Math.max(0, Number(value) || 0);
        return { ...prev, graceMin: numeric };
      }
      return { ...prev, [key]: value };
    });
    if (uploadData) {
      setNeedsRecompute(true);
    }
  };

  const toggleOffice = (officeId: string) => {
    setOfficeFilter((prev) => {
      const exists = prev.includes(officeId);
      const next = exists ? prev.filter((id) => id !== officeId) : [...prev, officeId];
      return next;
    });
    if (uploadData) {
      setNeedsRecompute(true);
    }
  };

  const clearFilters = () => {
    setOfficeFilter([]);
    if (uploadData) {
      setNeedsRecompute(true);
    }
  };

  const handleRecompute = () => {
    if (!uploadData) return;
    setIsComputing(true);
    try {
      computeTables(uploadData.matched, schedule, officeFilter);
      toast({
        title: "Tardiness & Undertime updated",
        description: "Results recalculated using the latest schedule.",
      });
    } finally {
      setIsComputing(false);
    }
  };

  const handleDraftChange = (bioId: string, employeeId: string) => {
    setMappingDrafts((prev) => ({ ...prev, [bioId]: employeeId }));
  };

  const handleAddMapping = (bioId: string) => {
    const selected = mappingDrafts[bioId];
    if (!selected) {
      toast({
        variant: "destructive",
        title: "Select an employee",
        description: "Choose an employee before adding the mapping.",
      });
      return;
    }
    setPendingMappings((prev) => ({ ...prev, [bioId]: selected }));
    toast({
      title: "Mapping queued",
      description: `Bio ID ${bioId} will be linked on save.`,
    });
  };

  const handleRemovePending = (bioId: string) => {
    setPendingMappings((prev) => {
      const next = { ...prev };
      delete next[bioId];
      return next;
    });
  };

  const handleSaveMappings = async () => {
    if (!uploadData) return;
    const mappings = Object.entries(pendingMappings).map(([bioUserId, employeeId]) => ({
      bioUserId,
      employeeId,
    }));
    if (!mappings.length) {
      toast({
        title: "Nothing to save",
        description: "Add at least one mapping before saving.",
      });
      return;
    }

    setIsSavingMappings(true);
    try {
      const response = await fetch(
        `/api/hrps/attendance/uploads/${uploadData.uploadId}/mappings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mappings }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        const message = error?.error ?? "Failed to save mappings.";
        toast({ variant: "destructive", title: "Unable to save mappings", description: message });
        return;
      }

      const result: {
        matched: EmployeeMatch[];
        unmatched: UnmatchedRecord[];
        count: number;
      } = await response.json();
      setUploadData((prev) =>
        prev
          ? {
              ...prev,
              matched: result.matched,
              unmatched: result.unmatched as UnmatchedRecord[],
            }
          : prev
      );
      computeTables(result.matched, schedule, officeFilter);
      setPendingMappings({});
      setMappingDrafts({});
      toast({
        title: "Mappings saved",
        description: `${result.count} mapping(s) have been updated.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Unable to save mappings",
        description: "Unexpected error while saving mappings.",
      });
    } finally {
      setIsSavingMappings(false);
    }
  };

  const handleExport = async (format: "xlsx" | "csv", granularity: "summary" | "detail") => {
    if (!uploadData) return;
    const key = `${format}-${granularity}`;
    setExportState((prev) => ({ ...prev, [key]: true }));
    try {
      const response = await fetch(
        `/api/hrps/attendance/uploads/${uploadData.uploadId}/export`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            format,
            granularity,
            schedule,
            officeIds: officeFilter.length ? officeFilter : undefined,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        const message = error?.error ?? "Export failed.";
        toast({ variant: "destructive", title: "Export failed", description: message });
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="(?<filename>.+)"/i);
      const filename = match?.groups?.filename ?? `attendance.${format}`;

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export ready",
        description: `${filename} has been downloaded.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Export failed",
        description: "Unexpected error while exporting attendance.",
      });
    } finally {
      setExportState((prev) => ({ ...prev, [key]: false }));
    }
  };

  const renderUploadSummary = () => {
    if (!uploadData) return null;
    const range = dateRange
      ? `${dateRange.start} – ${dateRange.end}`
      : "—";

    return (
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Total Rows
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {uploadData.meta.rows}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Distinct Bio IDs
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {uploadData.meta.distinctBio}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Date Range
            </CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">
            {range}
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-20 border-b bg-background/95 px-1 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">HRPS ▸ Tardiness &amp; Undertime</h1>
          <p className="text-sm text-muted-foreground">
            Upload biometric attendance, review mapped employees, adjust schedules, and export tardiness and undertime reports.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="review">Review &amp; Map</TabsTrigger>
          <TabsTrigger value="download">Download</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              className={cn(
                "flex h-56 flex-col items-center justify-center rounded-lg border-2 border-dashed transition",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/30"
              )}
            >
              <UploadCloud className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="mb-2 text-sm font-medium">
                Drag &amp; drop biometric XLS/XLSX files here
              </p>
              <p className="mb-4 text-xs text-muted-foreground">
                Supported formats: .xls, .xlsx
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose File
                </Button>
                {selectedFile && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleFileSelect(null)}
                  >
                    Clear
                  </Button>
                )}
              </div>
              {selectedFile && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Selected: {selectedFile.name}
                </p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xls,.xlsx"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  handleFileSelect(file ?? null);
                }}
              />
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="attendance-month">Month (YYYY-MM)</Label>
                <Input
                  id="attendance-month"
                  type="month"
                  value={monthValue}
                  onChange={(event) => setMonthValue(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  If the file name or data does not include a month, select it here before uploading.
                </p>
              </div>
              <Button
                type="button"
                onClick={handleUpload}
                disabled={isUploading}
                className="w-full"
              >
                {isUploading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Uploading &amp; Parsing
                  </span>
                ) : (
                  "Upload & Parse"
                )}
              </Button>
              {uploadData?.meta.inferred && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Month inferred automatically</AlertTitle>
                  <AlertDescription>
                    We detected <span className="font-medium">{uploadData.month}</span> from the file. Adjust it above if needed.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>

          {uploadError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Upload error</AlertTitle>
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          )}

          {renderUploadSummary()}
        </TabsContent>

        <TabsContent value="review" className="space-y-6">
          {!uploadData ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No upload yet</AlertTitle>
              <AlertDescription>
                Upload and parse a biometric attendance file before reviewing tardiness and undertime results.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Office filter</Label>
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-w-[160px] justify-between"
                        >
                          <span>
                            {officeFilter.length
                              ? `${officeFilter.length} selected`
                              : "All offices"}
                          </span>
                          <ChevronsUpDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search offices..." />
                          <CommandList>
                            <CommandEmpty>No offices found.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                key={UNASSIGNED_OFFICE_KEY}
                                onSelect={() => toggleOffice(UNASSIGNED_OFFICE_KEY)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    officeFilter.includes(UNASSIGNED_OFFICE_KEY)
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                Unassigned
                              </CommandItem>
                              {offices.map((office) => (
                                <CommandItem
                                  key={office.id}
                                  onSelect={() => toggleOffice(office.id)}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      officeFilter.includes(office.id)
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  {office.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      Reset
                    </Button>
                  </div>
                </div>
                <div className="flex items-end gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="schedule-start">Start time</Label>
                    <Input
                      id="schedule-start"
                      type="time"
                      value={schedule.start}
                      onChange={(event) => handleScheduleChange("start", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schedule-end">End time</Label>
                    <Input
                      id="schedule-end"
                      type="time"
                      value={schedule.end}
                      onChange={(event) => handleScheduleChange("end", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schedule-grace">Grace (mins)</Label>
                    <Input
                      id="schedule-grace"
                      type="number"
                      min={0}
                      value={schedule.graceMin}
                      onChange={(event) => handleScheduleChange("graceMin", event.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={handleRecompute}
                      disabled={isComputing || !uploadData.matched.length}
                    >
                      {isComputing ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Recomputing
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <RefreshCw className="h-4 w-4" /> Recompute
                        </span>
                      )}
                    </Button>
                    {needsRecompute && (
                      <Badge variant="secondary">Pending recompute</Badge>
                    )}
                  </div>
                </div>
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="ml-auto flex items-center gap-2">
                      <UserSearch className="h-4 w-4" /> Unmatched Bio IDs ({unmatchedCount})
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-full sm:max-w-xl" side="right">
                    <SheetHeader>
                      <SheetTitle>Unmatched Bio IDs</SheetTitle>
                      <SheetDescription>
                        Map biometric IDs to employees so they can be included in the report.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="mt-6 space-y-4 overflow-y-auto pr-2">
                      {uploadData.unmatched.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          All biometric IDs are currently mapped to employees.
                        </p>
                      ) : (
                        uploadData.unmatched.map((entry) => {
                          const pendingEmployeeId = pendingMappings[entry.bioUserId];
                          const pendingEmployee = pendingEmployeeId
                            ? employeeById.get(pendingEmployeeId)
                            : undefined;
                          const draftEmployeeId = mappingDrafts[entry.bioUserId];
                          const draftEmployee = draftEmployeeId
                            ? employeeById.get(draftEmployeeId)
                            : undefined;

                          return (
                            <div key={entry.bioUserId} className="rounded-lg border p-4 space-y-3">
                              <div>
                                <div className="text-sm font-semibold">Bio ID: {entry.bioUserId}</div>
                                <div className="text-xs text-muted-foreground">
                                  Name hint: {entry.name || "—"}
                                </div>
                                {entry.officeHint && (
                                  <div className="text-xs text-muted-foreground">
                                    Office hint: {entry.officeHint}
                                  </div>
                                )}
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs font-medium text-muted-foreground">
                                  Assign employee
                                </Label>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      className="w-full justify-between"
                                    >
                                      {draftEmployee ? draftEmployee.name : "Select employee"}
                                      <ChevronDown className="h-4 w-4 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent align="start" className="w-72 p-0">
                                    <Command>
                                      <CommandInput placeholder="Search employees..." />
                                      <CommandList>
                                        <CommandEmpty>No matches found.</CommandEmpty>
                                        <CommandGroup>
                                          {employees.map((employee) => (
                                            <CommandItem
                                              key={employee.id}
                                              onSelect={() => handleDraftChange(entry.bioUserId, employee.id)}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  draftEmployeeId === employee.id
                                                    ? "opacity-100"
                                                    : "opacity-0"
                                                )}
                                              />
                                              <div className="flex flex-col">
                                                <span>{employee.name}</span>
                                                <span className="text-xs text-muted-foreground">
                                                  {employee.officeName ?? "Unassigned"}
                                                </span>
                                              </div>
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleAddMapping(entry.bioUserId)}
                                  >
                                    Add mapping
                                  </Button>
                                  {pendingEmployee && (
                                    <Badge variant="secondary">
                                      Queued: {pendingEmployee.name}
                                    </Badge>
                                  )}
                                  {pendingEmployee && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRemovePending(entry.bioUserId)}
                                    >
                                      Remove
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <SheetFooter className="mt-6">
                      <Button
                        onClick={handleSaveMappings}
                        disabled={isSavingMappings || pendingCount === 0}
                      >
                        {isSavingMappings ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Saving
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            Save mappings ({pendingCount})
                          </span>
                        )}
                      </Button>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">Summary (per employee)</h2>
                </div>
                <DataTable
                  storageKey="attendance-summary"
                  columns={summaryColumns}
                  data={summaryRows}
                  syncPageToUrl={false}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">Detail (per day)</h2>
                </div>
                <DataTable
                  storageKey="attendance-detail"
                  columns={detailColumns}
                  data={detailRows}
                  syncPageToUrl={false}
                />
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="download" className="space-y-6">
          {!uploadData ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No data to export</AlertTitle>
              <AlertDescription>
                Upload and review attendance data before exporting reports.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Button
                className="flex items-center gap-2"
                onClick={() => handleExport("xlsx", "summary")}
                disabled={exportState["xlsx-summary"]}
              >
                {exportState["xlsx-summary"] ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export Summary (XLSX)
              </Button>
              <Button
                className="flex items-center gap-2"
                onClick={() => handleExport("xlsx", "detail")}
                disabled={exportState["xlsx-detail"]}
              >
                {exportState["xlsx-detail"] ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export Detail (XLSX)
              </Button>
              <Button
                className="flex items-center gap-2"
                onClick={() => handleExport("csv", "summary")}
                disabled={exportState["csv-summary"]}
              >
                {exportState["csv-summary"] ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export Summary (CSV)
              </Button>
              <Button
                className="flex items-center gap-2"
                onClick={() => handleExport("csv", "detail")}
                disabled={exportState["csv-detail"]}
              >
                {exportState["csv-detail"] ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export Detail (CSV)
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
