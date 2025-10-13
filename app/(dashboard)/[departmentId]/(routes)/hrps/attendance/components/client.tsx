"use client";

import * as React from "react";
import { useState, useMemo, useCallback, useEffect } from "react";
import {
  RawRecord,
  EmployeeMatch,
  Schedule,
  UploadResponse,
  UnmatchedRecord,
  AttendanceEmployeeInfo,
  BioSource,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const PREVIEW_LIMIT = 5;
const PREVIEW_USER_ID_REGEX = /^User\s*ID\s*:\s*(\d+)/i;
const PREVIEW_NAME_REGEX = /^Name\s*:\s*(.+)$/i;
const PREVIEW_DEPT_REGEX = /^Department\s*:\s*(.+)$/i;
const PREVIEW_BIO_HEADER_REGEX = /^(user\s*id|bio)/i;
const PREVIEW_NAME_HEADER_REGEX = /name/i;
const PREVIEW_OFFICE_HEADER_REGEX = /(office|dept|department)/i;

type BioPreviewEntry = {
  bioUserId: string;
  name?: string;
  officeHint?: string;
};

type BioPreviewColumn = {
  letter: string;
  label: string;
  preview: BioPreviewEntry[];
};

type BioPreviewData = {
  header: BioPreviewEntry[];
  columns: BioPreviewColumn[];
};

const normalizePreview = (value: any): string => (value ?? "").toString().trim();

const formatColumnLabel = (letter: string, label: string) =>
  label ? `${letter} — ${label}` : `Column ${letter}`;

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
  const [bioSourceChoice, setBioSourceChoice] = useState<BioSource>({ kind: "header" });
  const [bioPreview, setBioPreview] = useState<BioPreviewData | null>(null);
  const [showBioExtraction, setShowBioExtraction] = useState(false);
  const [isPreparingBio, setIsPreparingBio] = useState(false);
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
  const storedPreferenceRef = React.useRef<BioSource | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("hrps.bioSource");
      if (!stored) return;
      const parsed = JSON.parse(stored) as BioSource;
      if (!parsed || typeof parsed !== "object" || !("kind" in parsed)) {
        return;
      }
      if (parsed.kind === "header") {
        const choice: BioSource = { kind: "header" };
        storedPreferenceRef.current = choice;
        setBioSourceChoice(choice);
      } else if (parsed.kind === "column" && typeof parsed.column === "string" && parsed.column.trim()) {
        const column = parsed.column.trim().toUpperCase();
        const choice: BioSource = { kind: "column", column };
        storedPreferenceRef.current = choice;
        setBioSourceChoice(choice);
      }
    } catch (error) {
      console.error("[HRPS_ATTENDANCE_BIO_PREF]", error);
    }
  }, []);

  useEffect(() => {
    storedPreferenceRef.current = bioSourceChoice;
  }, [bioSourceChoice]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (bioSourceChoice.kind === "column" && !bioSourceChoice.column) return;
    try {
      window.localStorage.setItem("hrps.bioSource", JSON.stringify(bioSourceChoice));
    } catch (error) {
      console.error("[HRPS_ATTENDANCE_STORE_BIO_PREF]", error);
    }
  }, [bioSourceChoice]);

  useEffect(() => {
    if (!selectedFile) {
      setShowBioExtraction(false);
      setBioPreview(null);
    }
  }, [selectedFile]);

  useEffect(() => {
    if (!bioPreview) return;
    if (bioSourceChoice.kind === "column") {
      const available = bioPreview.columns.some((column) => column.letter === bioSourceChoice.column);
      if (!available) {
        if (bioPreview.columns.length) {
          setBioSourceChoice({ kind: "column", column: bioPreview.columns[0].letter });
        } else {
          setBioSourceChoice({ kind: "header" });
        }
      }
    }
  }, [bioPreview, bioSourceChoice]);

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

  const previewEntries = useMemo(() => {
    if (!bioPreview) return [] as BioPreviewEntry[];
    if (bioSourceChoice.kind === "column") {
      const column = bioPreview.columns.find((entry) => entry.letter === bioSourceChoice.column);
      return column?.preview ?? [];
    }
    return bioPreview.header;
  }, [bioPreview, bioSourceChoice]);

  const columnOptions = bioPreview?.columns ?? [];

  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file);
    setUploadError(null);
    if (!file) {
      setIsPreparingBio(false);
    }
    setBioPreview(null);
    setShowBioExtraction(false);
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

  const prepareBioPreview = useCallback(
    async (file: File): Promise<BioPreviewData> => {
      const arrayBuffer = await file.arrayBuffer();
      const XLSXModule = await import("xlsx");
      const workbook = XLSXModule.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error("No worksheet found in file.");
      }
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet || !worksheet["!ref"]) {
        throw new Error("Worksheet is empty.");
      }

      const range = XLSXModule.utils.decode_range(worksheet["!ref"]);
      const readCell = (row: number, col: number): string => {
        const cell = worksheet[XLSXModule.utils.encode_cell({ r: row, c: col })];
        return normalizePreview(cell?.w ?? cell?.v);
      };

      const headerPreview: BioPreviewEntry[] = [];
      const processed = new Set<string>();

      for (let r = range.s.r; r <= range.e.r && headerPreview.length < PREVIEW_LIMIT; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const address = XLSXModule.utils.encode_cell({ r, c });
          if (processed.has(address)) continue;
          const text = readCell(r, c);
          if (!text) continue;
          const match = PREVIEW_USER_ID_REGEX.exec(text);
          if (!match) continue;
          processed.add(address);
          const bioUserId = match[1];

          let name: string | undefined;
          let officeHint: string | undefined;
          for (let offset = c; offset <= Math.min(range.e.c, c + 6); offset++) {
            const neighbor = readCell(r, offset);
            if (!name) {
              const nameMatch = PREVIEW_NAME_REGEX.exec(neighbor);
              if (nameMatch) {
                name = nameMatch[1].trim();
              }
            }
            if (!officeHint) {
              const deptMatch = PREVIEW_DEPT_REGEX.exec(neighbor);
              if (deptMatch) {
                officeHint = deptMatch[1].trim();
              }
            }
          }

          headerPreview.push({ bioUserId, name, officeHint });
          if (headerPreview.length >= PREVIEW_LIMIT) {
            break;
          }
        }
      }

      const headerRowEntries = [] as {
        col: number;
        letter: string;
        value: string;
      }[];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const value = readCell(range.s.r, c);
        headerRowEntries.push({ col: c, letter: XLSXModule.utils.encode_col(c), value });
      }

      let candidateColumns = headerRowEntries.filter((entry) =>
        PREVIEW_BIO_HEADER_REGEX.test(entry.value)
      );

      const storedColumn = storedPreferenceRef.current?.kind === "column"
        ? storedPreferenceRef.current.column
        : null;
      if (storedColumn) {
        const storedEntry = headerRowEntries.find((entry) => entry.letter === storedColumn);
        if (storedEntry && !candidateColumns.some((entry) => entry.letter === storedEntry.letter)) {
          candidateColumns = [...candidateColumns, storedEntry];
        }
      }

      if (!candidateColumns.length) {
        const fallbackCol = range.s.c + 5;
        if (fallbackCol <= range.e.c) {
          const fallback = headerRowEntries.find((entry) => entry.col === fallbackCol);
          if (fallback) {
            candidateColumns = [fallback];
          }
        }
      }

      const nameColumn = headerRowEntries.find((entry) => PREVIEW_NAME_HEADER_REGEX.test(entry.value))?.col ?? -1;
      const officeColumn = headerRowEntries.find((entry) => PREVIEW_OFFICE_HEADER_REGEX.test(entry.value))?.col ?? -1;

      const columns: BioPreviewColumn[] = candidateColumns.map((candidate) => {
        const preview: BioPreviewEntry[] = [];
        const seen = new Set<string>();
        for (let r = range.s.r + 1; r <= range.e.r && preview.length < PREVIEW_LIMIT; r++) {
          const bioValue = readCell(r, candidate.col);
          if (!bioValue) continue;
          if (seen.has(bioValue)) continue;
          seen.add(bioValue);

          const nameValue = nameColumn >= 0 ? readCell(r, nameColumn) : "";
          const officeValue = officeColumn >= 0 ? readCell(r, officeColumn) : "";

          preview.push({
            bioUserId: bioValue,
            name: nameValue || undefined,
            officeHint: officeValue || undefined,
          });
        }
        return {
          letter: candidate.letter,
          label: candidate.value,
          preview,
        };
      });

      return {
        header: headerPreview.slice(0, PREVIEW_LIMIT),
        columns,
      };
    },
    []
  );

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError("Select a .xls or .xlsx file to continue.");
      return;
    }

    setIsPreparingBio(true);
    setUploadError(null);
    try {
      const preview = await prepareBioPreview(selectedFile);
      setBioPreview(preview);
      setShowBioExtraction(true);
      if (bioSourceChoice.kind === "column") {
        const hasColumn = preview.columns.some((column) => column.letter === bioSourceChoice.column);
        if (!hasColumn) {
          if (preview.columns.length) {
            setBioSourceChoice({ kind: "column", column: preview.columns[0].letter });
          } else {
            setBioSourceChoice({ kind: "header" });
          }
        }
      } else if (bioSourceChoice.kind === "header" && storedPreferenceRef.current?.kind === "column") {
        const storedColumn = storedPreferenceRef.current.column;
        const hasStored = preview.columns.some((column) => column.letter === storedColumn);
        if (hasStored) {
          setBioSourceChoice({ kind: "column", column: storedColumn });
        }
      }
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : "Unexpected error while preparing the file.";
      setUploadError(message);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: message,
      });
    } finally {
      setIsPreparingBio(false);
    }
  };

  const handleConfirmBioSource = async () => {
    if (!selectedFile) {
      setUploadError("Select a .xls or .xlsx file to continue.");
      return;
    }
    if (bioSourceChoice.kind === "column" && !bioSourceChoice.column) {
      toast({
        variant: "destructive",
        title: "Column required",
        description: "Choose a column before continuing.",
      });
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
      formData.append("bioSource", JSON.stringify(bioSourceChoice));

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
      setBioPreview(null);
      setShowBioExtraction(false);
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
      const message =
        error instanceof Error ? error.message : "Unexpected error while uploading attendance file.";
      setUploadError(message);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: message,
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
                disabled={isUploading || isPreparingBio}
                className="w-full"
              >
                {isPreparingBio ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Scanning file
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

        {showBioExtraction && bioPreview && (
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-base">Bio number extraction</CardTitle>
              <p className="text-sm text-muted-foreground">
                Confirm where we read biometric IDs before parsing the report.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition",
                    bioSourceChoice.kind === "header"
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/30"
                  )}
                >
                  <input
                    type="radio"
                    name="bio-source"
                    className="mt-1 h-4 w-4 border-muted-foreground text-primary focus:ring-primary"
                    checked={bioSourceChoice.kind === "header"}
                    onChange={() => setBioSourceChoice({ kind: "header" })}
                  />
                  <div className="space-y-1">
                    <span className="font-medium">Header field</span>
                    <p className="text-xs text-muted-foreground">
                      Use values like “User ID: 362003” found in each employee block.
                    </p>
                  </div>
                </label>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition",
                    bioSourceChoice.kind === "column"
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/30",
                    !columnOptions.length && "opacity-60"
                  )}
                >
                  <input
                    type="radio"
                    name="bio-source"
                    className="mt-1 h-4 w-4 border-muted-foreground text-primary focus:ring-primary"
                    checked={bioSourceChoice.kind === "column"}
                    disabled={!columnOptions.length}
                    onChange={() => {
                      if (!columnOptions.length) return;
                      const current = columnOptions.find(
                        (option) => option.letter === bioSourceChoice.column
                      );
                      const nextColumn = current?.letter ?? columnOptions[0].letter;
                      setBioSourceChoice({ kind: "column", column: nextColumn });
                    }}
                  />
                  <div className="flex-1 space-y-3">
                    <div className="space-y-1">
                      <span className="font-medium">Table column</span>
                      <p className="text-xs text-muted-foreground">
                        Read Bio # from a specific table column (e.g., column F).
                      </p>
                    </div>
                    {bioSourceChoice.kind === "column" && columnOptions.length ? (
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Column</Label>
                        <Select
                          value={bioSourceChoice.column}
                          onValueChange={(value) =>
                            setBioSourceChoice({ kind: "column", column: value.toUpperCase() })
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            {columnOptions.map((option) => (
                              <SelectItem key={option.letter} value={option.letter}>
                                {formatColumnLabel(option.letter, option.label)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : columnOptions.length ? (
                      <p className="text-xs text-muted-foreground">
                        Columns detected: {columnOptions.map((option) => option.letter).join(", ")}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        We couldn’t find a Bio ID column in the header row.
                      </p>
                    )}
                  </div>
                </label>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Preview (first 5)</h4>
                  <span className="text-xs text-muted-foreground">
                    {bioSourceChoice.kind === "column"
                      ? `Column ${bioSourceChoice.column}`
                      : "Header values"}
                  </span>
                </div>
                {previewEntries.length ? (
                  <ul className="space-y-2">
                    {previewEntries.map((entry, index) => (
                      <li
                        key={`${entry.bioUserId}-${index}`}
                        className="rounded-md border bg-muted/40 p-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{entry.bioUserId || "—"}</span>
                          {entry.officeHint && (
                            <Badge variant="outline" className="text-xs">
                              Dept: {entry.officeHint}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {entry.name ? entry.name : "Name unavailable"}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No sample rows detected yet. Double-check your selection.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  We read Bio # from the report header (e.g., “User ID: 362003”). If this ID is new,
                  link it once and it will be remembered.
                </p>
                <Button
                  type="button"
                  onClick={handleConfirmBioSource}
                  disabled={
                    isUploading || (bioSourceChoice.kind === "column" && !columnOptions.length)
                  }
                >
                  {isUploading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Uploading &amp; Parsing
                    </span>
                  ) : (
                    "Continue"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

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
                        <span className="mt-2 block text-xs text-muted-foreground">
                          We read Bio # from the report header (e.g., “User ID: 362003”). If this ID doesn’t
                          exist yet, link it once and it will be remembered.
                        </span>
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
                            <div key={entry.bioUserId} className="space-y-3 rounded-lg border p-4">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="secondary" className="text-xs font-medium">
                                    Bio #{entry.bioUserId}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs font-normal">
                                    Dept: {entry.officeHint ?? "—"}
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Name: {entry.name ?? "—"}
                                </div>
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
                                              <div className="mt-1 flex items-center gap-2">
                                                <Badge variant="outline" className="text-[10px] font-medium">
                                                  {employee.officeName ?? "Unassigned"}
                                                </Badge>
                                              </div>
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
