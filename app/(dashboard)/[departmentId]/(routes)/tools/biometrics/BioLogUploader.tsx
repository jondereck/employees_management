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
  Check,
  Columns,
  Filter as FilterIcon,
  FileDown,
  Info,
  Loader2,
  Pencil,
  Plus,
  Trash2,
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { firstEmployeeNoToken } from "@/lib/employeeNo";
import { cn } from "@/lib/utils";
import SummaryFiltersBar from "@/components/tools/biometrics/SummaryFiltersBar";
import {
  DEFAULT_SUMMARY_FILTERS,
  SummaryFiltersProvider,
  useSummaryFilters,
  type HeadsFilterValue,
  type SummarySortField,
  type SortDirection,
} from "@/hooks/use-summary-filters";
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
import type { DayEvaluationStatus } from "@/utils/evaluateDay";
import {
  EXPORT_COLUMNS_STORAGE_KEY,
  formatScheduleSource,
  UNASSIGNED_OFFICE_LABEL,
  UNKNOWN_OFFICE_KEY_PREFIX,
  UNKNOWN_OFFICE_LABEL,
  UNMATCHED_LABEL,
  normalizeBiometricToken,
} from "@/utils/biometricsShared";
import type { ManualExclusion, ManualExclusionReason, ManualExclusionScope } from "@/types/manual-exclusion";
import type { DateRange } from "react-day-picker";
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
import SummaryColumnSelector from "./SummaryColumnSelector";
import {
  ALL_CHART_IDS,
  DEFAULT_VISIBLE_CHARTS,
  INSIGHTS_SETTINGS_KEY,
  type ChartId,
  type InsightsSettings,
  type MetricMode,
} from "./insights-types";
import { Switch } from "@/components/ui/switch";

const PAGE_SIZE = 25;

const MINUTES_IN_DAY = 24 * 60;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const APP_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION ??
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
  "dev";

const formatTimelineLabel = (segments: { start: string; end: string }[]) => {
  if (!segments.length) return "none";
  return segments.map((segment) => `${segment.start}–${segment.end}`).join(", ");
};

type ColumnFilterOperator = "=" | ">" | ">=" | "<" | "<=";

type TextColumnFilterState = {
  kind: "text";
  values: string[];
};

type NumberColumnFilterState = {
  kind: "number";
  operator: ColumnFilterOperator;
  value: string;
};

type ColumnFilterState = TextColumnFilterState | NumberColumnFilterState;

const COLUMN_FILTER_OPERATORS: ColumnFilterOperator[] = ["=", ">", ">=", "<", "<="];

const TEXT_FILTER_KEYS = new Set<SummaryColumnKey>(
  SUMMARY_COLUMN_DEFINITIONS.filter((definition) => definition.type === "text" || definition.type === "date").map(
    (definition) => definition.key
  )
);

const NUMERIC_FILTER_TYPES = new Set(["number", "minutes", "percent"]);

const normalizeFilterText = (value: unknown): string => {
  if (value == null) return "—";
  const stringValue = typeof value === "string" ? value.trim() : String(value);
  return stringValue.length ? stringValue : "—";
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

type ManualDialogOfficeOption = { id: string; name: string };
type ManualDialogEmployeeOption = { id: string; display: string; name: string };

type ManualExclusionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (draft: Omit<ManualExclusion, "id">) => void;
  initial?: ManualExclusion | null;
  offices: ManualDialogOfficeOption[];
  employees: ManualDialogEmployeeOption[];
  activePeriodLabel: string | null;
  activePeriod?: { year: number; month: number } | null;
};

const ManualExclusionDialog = ({
  open,
  onOpenChange,
  onSubmit,
  initial,
  offices,
  employees,
  activePeriodLabel,
  activePeriod,
}: ManualExclusionDialogProps) => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    initial ? toDateRangeFromDates(initial.dates) : undefined
  );
  const [scope, setScope] = useState<ManualExclusionScope>(initial?.scope ?? "all");
  const [selectedOffices, setSelectedOffices] = useState<string[]>(initial?.officeIds ?? []);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>(initial?.employeeIds ?? []);
  const [reason, setReason] = useState<ManualExclusionReason>(initial?.reason ?? "LEAVE");
  const [note, setNote] = useState<string>(initial?.note ?? "");
  const [officePopoverOpen, setOfficePopoverOpen] = useState(false);
  const [employeePopoverOpen, setEmployeePopoverOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDateRange(initial ? toDateRangeFromDates(initial.dates) : undefined);
    setScope(initial?.scope ?? "all");
    setSelectedOffices(initial?.officeIds ?? []);
    setSelectedEmployees(initial?.employeeIds ?? []);
    setReason(initial?.reason ?? "LEAVE");
    setNote(initial?.note ?? "");
  }, [initial, open]);

  const officeNameMap = useMemo(() => new Map(offices.map((office) => [office.id, office.name])), [offices]);
  const officeOrder = useMemo(
    () => new Map(offices.map((office, index) => [office.id, index])),
    [offices]
  );
  const employeeLabelMap = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee.display])),
    [employees]
  );
  const employeeOrder = useMemo(
    () => new Map(employees.map((employee, index) => [employee.id, index])),
    [employees]
  );

  const selectedDates = useMemo(() => expandDatesFromRange(dateRange), [dateRange]);
  const selectedDatesLabel = useMemo(
    () => (selectedDates.length ? formatManualDateSummary(selectedDates) : "Select a date"),
    [selectedDates]
  );

  const outOfPeriodCount = useMemo(() => {
    if (!activePeriod) return 0;
    const prefix = `${activePeriod.year}-${pad2(activePeriod.month)}`;
    return selectedDates.filter((date) => !date.startsWith(prefix)).length;
  }, [activePeriod, selectedDates]);

  const leaveSelectValue = useMemo(() => {
    if (reason !== "LEAVE") return "none";
    if (!note) return "none";
    const match = LEAVE_NOTE_OPTIONS.find((option) => option === note);
    return match ?? "custom";
  }, [note, reason]);

  const notePlaceholder = useMemo(() => {
    if (reason === "LEAVE") return "Optional details (e.g., Sick Leave)";
    if (reason === "LOCAL_HOLIDAY") return "Optional locality (e.g., Lingayen Charter Day)";
    return "Optional note";
  }, [reason]);

  const toggleOffice = (id: string) => {
    setSelectedOffices((prev) => {
      const set = new Set(prev);
      if (set.has(id)) {
        set.delete(id);
      } else {
        set.add(id);
      }
      return Array.from(set).sort((a, b) => {
        const aOrder = officeOrder.get(a) ?? Number.MAX_SAFE_INTEGER;
        const bOrder = officeOrder.get(b) ?? Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.localeCompare(b);
      });
    });
  };

  const toggleEmployee = (id: string) => {
    setSelectedEmployees((prev) => {
      const set = new Set(prev);
      if (set.has(id)) {
        set.delete(id);
      } else {
        set.add(id);
      }
      return Array.from(set).sort((a, b) => {
        const aOrder = employeeOrder.get(a) ?? Number.MAX_SAFE_INTEGER;
        const bOrder = employeeOrder.get(b) ?? Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.localeCompare(b);
      });
    });
  };

  const handleScopeChange = (value: ManualExclusionScope) => {
    setScope(value);
    if (value !== "offices") {
      setSelectedOffices([]);
    }
    if (value !== "employees") {
      setSelectedEmployees([]);
    }
  };

  const handleLeaveSubtypeChange = (value: string) => {
    if (value === "none") {
      setNote("");
    } else if (value !== "custom") {
      setNote(value);
    }
  };

  const handleSubmit = () => {
    const uniqueDates = Array.from(new Set(selectedDates)).sort((a, b) => a.localeCompare(b));
    if (!uniqueDates.length) return;
    if (scope === "offices" && !selectedOffices.length) return;
    if (scope === "employees" && !selectedEmployees.length) return;
    const payload: Omit<ManualExclusion, "id"> = {
      dates: uniqueDates,
      scope,
      reason,
      note: note.trim().length ? note.trim() : undefined,
    };
    if (scope === "offices") {
      payload.officeIds = selectedOffices.slice();
    }
    if (scope === "employees") {
      payload.employeeIds = selectedEmployees.slice();
    }
    onSubmit(payload);
    onOpenChange(false);
  };

  const saveDisabled =
    !selectedDates.length ||
    (scope === "offices" && !selectedOffices.length) ||
    (scope === "employees" && !selectedEmployees.length);

  const activeScopeLabel = scope === "all"
    ? "All employees"
    : scope === "offices"
    ? selectedOffices.length
      ? `${selectedOffices.length} office${selectedOffices.length === 1 ? "" : "s"} selected`
      : "No offices selected"
    : selectedEmployees.length
    ? `${selectedEmployees.length} employee${selectedEmployees.length === 1 ? "" : "s"} selected`
    : "No employees selected";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit manual exclusion" : "Add manual exclusion"}</DialogTitle>
          <DialogDescription>
            Mark specific dates as excused so they are excluded from late, undertime, and absence calculations.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Dates</Label>
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={1}
            />
            <p className="text-xs text-muted-foreground">
              {selectedDates.length ? `${selectedDates.length} day${selectedDates.length === 1 ? "" : "s"}: ${selectedDatesLabel}` : "Select a single day or range."}
            </p>
            {outOfPeriodCount > 0 && activePeriodLabel ? (
              <p className="text-xs text-amber-600">
                {outOfPeriodCount} date{outOfPeriodCount === 1 ? "" : "s"} outside {activePeriodLabel} will be ignored for this period.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-exclusion-scope" className="text-sm font-medium">
              Scope
            </Label>
            <Select value={scope} onValueChange={(value) => handleScopeChange(value as ManualExclusionScope)}>
              <SelectTrigger id="manual-exclusion-scope" className="h-9">
                <SelectValue placeholder="Select scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                <SelectItem value="offices">Specific offices</SelectItem>
                <SelectItem value="employees">Specific employees</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{activeScopeLabel}</p>
            {scope === "offices" ? (
              <div className="space-y-1">
                <Popover open={officePopoverOpen} onOpenChange={setOfficePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-between">
                      <span>
                        {selectedOffices.length
                          ? `${selectedOffices.length} office${selectedOffices.length === 1 ? "" : "s"} selected`
                          : "Select offices"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search offices" />
                      <CommandList>
                        <CommandEmpty>No offices found.</CommandEmpty>
                        <CommandGroup>
                          {offices.map((office) => {
                            const selected = selectedOffices.includes(office.id);
                            return (
                              <CommandItem
                                key={office.id}
                                value={office.id}
                                onSelect={(value) => {
                                  toggleOffice(value);
                                }}
                                className="flex items-center gap-2"
                              >
                                <Check className={cn("h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                                <span>{office.name}</span>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {selectedOffices.length ? (
                  <p className="text-xs text-muted-foreground">
                    {selectedOffices
                      .map((id) => officeNameMap.get(id) ?? id)
                      .join(", ")}
                  </p>
                ) : null}
              </div>
            ) : null}
            {scope === "employees" ? (
              <div className="space-y-1">
                <Popover open={employeePopoverOpen} onOpenChange={setEmployeePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-between">
                      <span>
                        {selectedEmployees.length
                          ? `${selectedEmployees.length} employee${selectedEmployees.length === 1 ? "" : "s"} selected`
                          : "Select employees"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search employees" />
                      <CommandList>
                        <CommandEmpty>No employees found.</CommandEmpty>
                        <CommandGroup>
                          {employees.map((employee) => {
                            const selected = selectedEmployees.includes(employee.id);
                            return (
                              <CommandItem
                                key={employee.id}
                                value={employee.id}
                                onSelect={(value) => {
                                  toggleEmployee(value);
                                }}
                                className="flex items-center gap-2"
                              >
                                <Check className={cn("h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                                <span>{employee.display}</span>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {selectedEmployees.length ? (
                  <p className="text-xs text-muted-foreground">
                    {selectedEmployees
                      .map((id) => employeeLabelMap.get(id) ?? id)
                      .join(", ")}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-exclusion-reason" className="text-sm font-medium">
              Reason
            </Label>
            <Select
              value={reason}
              onValueChange={(value) => setReason(value as ManualExclusionReason)}
            >
              <SelectTrigger id="manual-exclusion-reason" className="h-9">
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                {MANUAL_REASON_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {reason === "LEAVE" ? (
              <Select value={leaveSelectValue} onValueChange={handleLeaveSubtypeChange}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Leave subtype" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No subtype</SelectItem>
                  {LEAVE_NOTE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom (use note)</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={notePlaceholder}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saveDisabled}>
            Save exclusion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

const getEmployeeIdentifierSortKey = (
  row: Pick<PerEmployeeRow, "employeeNo" | "employeeToken" | "employeeId">
) => {
  const employeeNo = firstEmployeeNoToken(row.employeeNo);
  if (employeeNo && employeeNo.length) {
    return { key: employeeNo, priority: 0 } as const;
  }
  const fallback = row.employeeToken?.trim() || row.employeeId?.trim() || "";
  if (fallback) {
    return { key: fallback, priority: 1 } as const;
  }
  return { key: "", priority: 2 } as const;
};

const compareEmployeeIdentifiers = (
  a: Pick<PerEmployeeRow, "employeeNo" | "employeeToken" | "employeeId" | "employeeName">,
  b: Pick<PerEmployeeRow, "employeeNo" | "employeeToken" | "employeeId" | "employeeName">
) => {
  const aKey = getEmployeeIdentifierSortKey(a);
  const bKey = getEmployeeIdentifierSortKey(b);
  if (aKey.priority !== bKey.priority) {
    return aKey.priority - bKey.priority;
  }
  if (aKey.key && bKey.key) {
    const diff = aKey.key.localeCompare(bKey.key);
    if (diff !== 0) return diff;
  } else if (aKey.key) {
    return -1;
  } else if (bKey.key) {
    return 1;
  }
  const aName = a.employeeName?.trim() || "";
  const bName = b.employeeName?.trim() || "";
  return aName.localeCompare(bName);
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

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const MANUAL_REASON_OPTIONS: { value: ManualExclusionReason; label: string }[] = [
  { value: "SUSPENSION", label: "Suspension" },
  { value: "OFFICE_CLOSURE", label: "Office closure" },
  { value: "CALAMITY", label: "Calamity" },
  { value: "TRAINING", label: "Training" },
  { value: "LEAVE", label: "Leave" },
  { value: "LOCAL_HOLIDAY", label: "Local holiday" },
  { value: "OTHER", label: "Other" },
];

const LEAVE_NOTE_OPTIONS = [
  "Sick Leave",
  "Vacation Leave",
  "Emergency Leave",
  "Maternity Leave",
  "Paternity Leave",
  "Bereavement Leave",
  "Solo Parent Leave",
  "Special Leave",
];

const manualMonthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });
const manualDayFormatter = new Intl.DateTimeFormat("en-US", { day: "numeric" });
const manualFullFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

const normalizeManualNote = (note: unknown): string | undefined => {
  if (typeof note !== "string") return undefined;
  const trimmed = note.trim();
  return trimmed.length ? trimmed : undefined;
};

const toUtcDateFromIso = (iso: string): Date | null => {
  if (typeof iso !== "string" || !ISO_DATE_REGEX.test(iso)) return null;
  const [yearStr, monthStr, dayStr] = iso.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return new Date(Date.UTC(year, month - 1, day, 12));
};

const expandDatesFromRange = (range: DateRange | undefined): string[] => {
  if (!range?.from) return [];
  const fromTime = Date.UTC(range.from.getFullYear(), range.from.getMonth(), range.from.getDate());
  const toDate = range.to ?? range.from;
  const toTime = Date.UTC(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
  const start = Math.min(fromTime, toTime);
  const end = Math.max(fromTime, toTime);
  const dates: string[] = [];
  for (let time = start; time <= end; time += MS_PER_DAY) {
    const date = new Date(time);
    const iso = `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
    dates.push(iso);
  }
  return dates;
};

const toDateRangeFromDates = (dates: string[]): DateRange | undefined => {
  if (!dates.length) return undefined;
  const parsed = dates
    .map((iso) => toUtcDateFromIso(iso))
    .filter((date): date is Date => date instanceof Date)
    .sort((a, b) => a.getTime() - b.getTime());
  if (!parsed.length) return undefined;
  const first = parsed[0];
  const last = parsed[parsed.length - 1];
  return {
    from: new Date(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate()),
    to: new Date(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate()),
  };
};

const formatManualDateSegment = (start: Date, end: Date) => {
  if (start.getTime() === end.getTime()) {
    return manualFullFormatter.format(start);
  }
  const sameMonth =
    start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth();
  if (sameMonth) {
    return `${manualMonthFormatter.format(start)} ${manualDayFormatter.format(start)}–${manualDayFormatter.format(end)}`;
  }
  return `${manualFullFormatter.format(start)} – ${manualFullFormatter.format(end)}`;
};

const formatManualDateSummary = (dates: string[]): string => {
  if (!dates.length) return "";
  const parsed = dates
    .map((iso) => ({ iso, date: toUtcDateFromIso(iso) }))
    .filter((entry): entry is { iso: string; date: Date } => entry.date instanceof Date)
    .sort((a, b) => a.iso.localeCompare(b.iso));
  if (!parsed.length) return "";
  const segments: Array<{ start: Date; end: Date }> = [];
  let currentStart = parsed[0].date;
  let currentEnd = parsed[0].date;
  for (let index = 1; index < parsed.length; index += 1) {
    const current = parsed[index].date;
    const previous = parsed[index - 1].date;
    const diff = current.getTime() - previous.getTime();
    if (diff === 0) {
      continue;
    }
    if (diff === MS_PER_DAY) {
      currentEnd = current;
      continue;
    }
    segments.push({ start: currentStart, end: currentEnd });
    currentStart = current;
    currentEnd = current;
  }
  segments.push({ start: currentStart, end: currentEnd });
  return segments.map((segment) => formatManualDateSegment(segment.start, segment.end)).join(", ");
};

const formatManualReasonLabel = (reason: ManualExclusionReason, note?: string | null) => {
  const normalizedNote = note && note.trim().length ? note.trim() : undefined;
  if (reason === "LOCAL_HOLIDAY") {
    return normalizedNote ? `Local Holiday (${normalizedNote})` : "Local Holiday";
  }
  if (reason === "LEAVE") {
    return normalizedNote ? `Leave - ${normalizedNote}` : "Leave";
  }
  const base = reason
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  return normalizedNote ? `${base} - ${normalizedNote}` : base;
};

const isValidManualScope = (value: unknown): value is ManualExclusionScope =>
  value === "all" || value === "offices" || value === "employees";

const isValidManualReason = (value: unknown): value is ManualExclusionReason =>
  value === "SUSPENSION" ||
  value === "OFFICE_CLOSURE" ||
  value === "CALAMITY" ||
  value === "TRAINING" ||
  value === "LEAVE" ||
  value === "LOCAL_HOLIDAY" ||
  value === "OTHER";

const sanitizeManualIds = (values: unknown): string[] | undefined => {
  if (!Array.isArray(values)) return undefined;
  const unique = Array.from(
    new Set(
      values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    )
  ).map((value) => value.trim());
  return unique.length ? unique : undefined;
};

const sortManualExclusions = (values: ManualExclusion[]): ManualExclusion[] =>
  [...values].sort((a, b) => {
    const aDate = a.dates[0] ?? "";
    const bDate = b.dates[0] ?? "";
    const diff = aDate.localeCompare(bDate);
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });

const sanitizeManualExclusions = (value: unknown): ManualExclusion[] => {
  if (!Array.isArray(value)) return [];
  const sanitized: ManualExclusion[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const id = typeof (entry as ManualExclusion).id === "string" ? (entry as ManualExclusion).id : null;
    if (!id) continue;
    const scope = (entry as ManualExclusion).scope;
    if (!isValidManualScope(scope)) continue;
    const reason = (entry as ManualExclusion).reason;
    if (!isValidManualReason(reason)) continue;
    const rawDates = Array.isArray((entry as ManualExclusion).dates)
      ? (entry as ManualExclusion).dates
      : [];
    const dates = Array.from(
      new Set(
        rawDates
          .filter((date): date is string => typeof date === "string" && ISO_DATE_REGEX.test(date))
          .sort((a, b) => a.localeCompare(b))
      )
    );
    if (!dates.length) continue;
    const officeIds = scope === "offices" ? sanitizeManualIds((entry as ManualExclusion).officeIds) : undefined;
    if (scope === "offices" && !officeIds?.length) continue;
    const employeeIds = scope === "employees" ? sanitizeManualIds((entry as ManualExclusion).employeeIds) : undefined;
    if (scope === "employees" && !employeeIds?.length) continue;
    const note = normalizeManualNote((entry as ManualExclusion).note);
    sanitized.push({
      id,
      scope,
      reason,
      dates,
      officeIds,
      employeeIds,
      note,
    });
  }
  return sortManualExclusions(sanitized);
};

const generateManualExclusionId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `manual-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

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

const makeEvaluationPayloadKey = (
  manualKey: string,
  rows: ParsedPerDayRow[],
  manualExclusions: ManualExclusion[] | null | undefined
) => {
  const manualFragment = manualExclusions && manualExclusions.length
    ? manualExclusions
        .map((exclusion) => {
          const dates = exclusion.dates.join(",");
          const offices = (exclusion.officeIds ?? []).join(",");
          const employees = (exclusion.employeeIds ?? []).join(",");
          const note = exclusion.note ?? "";
          return `${exclusion.id}:${exclusion.reason}:${exclusion.scope}:${dates}:${offices}:${employees}:${note}`;
        })
        .join("|")
    : "none";
  const rowFragment = rows
    .map((row) => {
      const officeKey = row.officeId ?? row.officeName ?? "";
      const token = row.employeeToken ?? row.employeeId ?? row.employeeName ?? "";
      return `${token}:${row.dateISO}:${row.allTimes.join("|")}:${row.employeeName}:${officeKey}`;
    })
    .join("#");
  return `${manualKey}:${rows.length}:${rowFragment}::${manualFragment}`;
};

const getNormalizedTokenForRow = (row: {
  employeeToken?: string | null;
  employeeId?: string | null;
  employeeName?: string | null;
}) => normalizeBiometricToken(row.employeeToken ?? row.employeeId ?? row.employeeName ?? "");

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

const getOfficeSortLabel = (
  row: Pick<PerEmployeeRow, "officeName" | "identityStatus" | "resolvedEmployeeId">
) => {
  const label = row.officeName?.trim();
  if (label) return label.toLowerCase();
  if (row.identityStatus === "unmatched" && !row.resolvedEmployeeId) {
    return UNKNOWN_OFFICE_LABEL.toLowerCase();
  }
  if (row.resolvedEmployeeId) {
    return UNASSIGNED_OFFICE_LABEL.toLowerCase();
  }
  return UNKNOWN_OFFICE_LABEL.toLowerCase();
};

const getScheduleSortLabel = (row: Pick<PerEmployeeRow, "scheduleTypes">) => {
  if (!row.scheduleTypes?.length) return "";
  return row.scheduleTypes.slice().sort().join("|").toLowerCase();
};

const makeEmployeeDedupeKey = (row: PerEmployeeRow) => {
  const resolved = row.resolvedEmployeeId?.trim();
  if (resolved) return `resolved:${resolved}`;
  const employeeId = row.employeeId?.trim();
  if (employeeId) return `id:${employeeId}`;
  const employeeNo = firstEmployeeNoToken(row.employeeNo)?.trim();
  if (employeeNo) return `no:${employeeNo}`;
  const token = row.employeeToken?.trim();
  if (token) return `token:${token}`;
  const name = row.employeeName?.trim();
  if (name) return `name:${name}`;
  return `row:${row.employeeId ?? ""}:${row.employeeName ?? ""}`;
};

const getSummarySortValue = (row: PerEmployeeRow, field: SummarySortField): number | string => {
  switch (field) {
    case "employeeName":
      return row.employeeName?.toLowerCase() ?? "";
    case "employeeNo": {
      const employeeNo = firstEmployeeNoToken(row.employeeNo)?.toLowerCase();
      if (employeeNo) return employeeNo;
      const token = row.employeeToken?.toLowerCase();
      if (token) return token;
      return row.employeeId?.toLowerCase() ?? "";
    }
    case "office":
      return getOfficeSortLabel(row);
    case "schedule":
      return getScheduleSortLabel(row);
    case "days":
      return row.daysWithLogs ?? 0;
    case "noPunch":
      return row.noPunchDays ?? 0;
    case "absences":
      return row.absences ?? 0;
    case "lateDays":
      return row.lateDays ?? 0;
    case "undertimeDays":
      return row.undertimeDays ?? 0;
    case "latePercent":
      if (typeof row.lateRate === "number") return row.lateRate;
      return computeLatePercentMinutes(row) ?? Number.NEGATIVE_INFINITY;
    case "undertimePercent":
      if (typeof row.undertimeRate === "number") return row.undertimeRate;
      return computeUndertimePercentMinutes(row) ?? Number.NEGATIVE_INFINITY;
    case "lateMinutes":
      return row.totalLateMinutes ?? 0;
    case "undertimeMinutes":
      return row.totalUndertimeMinutes ?? 0;
    default:
      return 0;
  }
};

const compareSummaryField = (a: PerEmployeeRow, b: PerEmployeeRow, field: SummarySortField) => {
  const aValue = getSummarySortValue(a, field);
  const bValue = getSummarySortValue(b, field);
  if (typeof aValue === "string" || typeof bValue === "string") {
    return String(aValue).localeCompare(String(bValue));
  }
  return (aValue as number) - (bValue as number);
};

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
  employeeNo: string | null;
  isHead: boolean | null;
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
      employeeNo: null,
      isHead: null,
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
      employeeNo: null,
      isHead: null,
    };
  }

  return {
    status,
    employeeId: record.employeeId ?? null,
    employeeName: employeeName && employeeName.length ? employeeName : UNMATCHED_LABEL,
    officeId: record.officeId ?? null,
    officeName: officeName && officeName.length ? officeName : UNASSIGNED_OFFICE_LABEL,
    employeeNo: firstEmployeeNoToken(record.employeeNo) ?? null,
    isHead: typeof record.isHead === "boolean" ? record.isHead : null,
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

    const visibleCharts = Array.isArray(parsed.visibleCharts)
      ? (parsed.visibleCharts.filter(isChartId) as ChartId[])
      : undefined;
    const collapsed = typeof parsed.collapsed === "boolean" ? parsed.collapsed : undefined;

    return {
      visibleCharts,
      collapsed,
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

function BioLogUploaderContent() {
  const { toast } = useToast();
  const params = useParams<{ departmentId?: string }>();
  const rawDepartmentId = params?.departmentId;
  const departmentId =
    typeof rawDepartmentId === "string"
      ? rawDepartmentId
      : Array.isArray(rawDepartmentId)
      ? rawDepartmentId[0] ?? ""
      : "";
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
  const [manualResolved, setManualResolvedState] = useState<Set<string>>(() => new Set());
  const [manualResolvedHydrated, setManualResolvedHydrated] = useState(false);
  const [perEmployee, setPerEmployee] = useState<PerEmployeeRow[] | null>(null);
  const [perDay, setPerDay] = useState<PerDayRow[] | null>(null);
  const [page, setPage] = useState(0);
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
  const [manualExclusions, setManualExclusions] = useState<ManualExclusion[]>([]);
  const [manualExclusionsHydrated, setManualExclusionsHydrated] = useState(false);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualDialogEditing, setManualDialogEditing] = useState<ManualExclusion | null>(null);
  const [identityState, setIdentityState] = useState<IdentityStatus>({
    status: "idle",
    total: 0,
    completed: 0,
    unmatched: 0,
  });
  const [identityMap, setIdentityMap] = useState<Map<string, IdentityRecord>>(() => new Map());
  const {
    filters,
    setSearch,
    setHeads,
    setOffices,
    clearOffices,
    setSchedules,
    clearSchedules,
    setShowUnmatched,
    setShowNoPunch,
    setMetricMode,
    setSort,
    togglePrimarySort,
  } = useSummaryFilters();
  const {
    offices: selectedOffices,
    schedules: selectedScheduleTypes,
    heads: headsFilter,
    showUnmatched,
    showNoPunch: showNoPunchColumn,
    metricMode,
    search: employeeSearch,
    sortBy,
    sortDir,
    secondarySortBy,
    secondarySortDir,
  } = filters;
  const dedupedPerEmployee = useMemo(() => {
    if (!perEmployee?.length) return [] as PerEmployeeRow[];
    const seen = new Set<string>();
    const rows: PerEmployeeRow[] = [];
    for (const row of perEmployee) {
      const key = makeEmployeeDedupeKey(row);
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
    return rows;
  }, [perEmployee]);

  const [columnOrder, setColumnOrder] = useState<SummaryColumnKey[]>(initialColumnSettings.order);
  const [selectedColumnKeys, setSelectedColumnKeys] = useState<SummaryColumnKey[]>(
    initialColumnSettings.selected
  );
  const [columnSelectorOpen, setColumnSelectorOpen] = useState(false);
  const [columnFilters, setColumnFilters] = useState<Partial<Record<SummaryColumnKey, ColumnFilterState>>>(
    {}
  );
  const hasActiveColumnFilters = useMemo(
    () => Object.keys(columnFilters).length > 0,
    [columnFilters]
  );
  useEffect(() => {
    setColumnFilters((prev) => {
      let changed = false;
      const next: Partial<Record<SummaryColumnKey, ColumnFilterState>> = { ...prev };
      const migrateKey = (
        fromKey: SummaryColumnKey,
        toKey: SummaryColumnKey
      ) => {
        if (fromKey in next && !(toKey in next)) {
          next[toKey] = next[fromKey];
          delete next[fromKey];
          changed = true;
        } else if (fromKey in next && toKey in next) {
          delete next[fromKey];
          changed = true;
        }
      };
      if (metricMode === "minutes") {
        migrateKey("latePercent", "lateMinutes");
        migrateKey("undertimePercent", "undertimeMinutes");
      } else {
        migrateKey("lateMinutes", "latePercent");
        migrateKey("undertimeMinutes", "undertimePercent");
      }
      return changed ? next : prev;
    });
  }, [metricMode]);
  const hasActiveSummaryFilters = useMemo(() => {
    return (
      filters.search.trim().length > 0 ||
      filters.heads !== DEFAULT_SUMMARY_FILTERS.heads ||
      filters.offices.length > 0 ||
      filters.schedules.length > 0 ||
      filters.showUnmatched !== DEFAULT_SUMMARY_FILTERS.showUnmatched ||
      filters.showNoPunch !== DEFAULT_SUMMARY_FILTERS.showNoPunch ||
      filters.metricMode !== DEFAULT_SUMMARY_FILTERS.metricMode ||
      filters.sortBy !== DEFAULT_SUMMARY_FILTERS.sortBy ||
      filters.sortDir !== DEFAULT_SUMMARY_FILTERS.sortDir ||
      filters.secondarySortBy !== DEFAULT_SUMMARY_FILTERS.secondarySortBy ||
      filters.secondarySortDir !== DEFAULT_SUMMARY_FILTERS.secondarySortDir
    );
  }, [filters]);
  const hasAnyFilters = hasActiveSummaryFilters || hasActiveColumnFilters;

  const handleClearAllFilters = useCallback(() => {
    setColumnFilters({});
    setSearch(DEFAULT_SUMMARY_FILTERS.search);
    setHeads(DEFAULT_SUMMARY_FILTERS.heads);
    clearOffices();
    clearSchedules();
    setShowUnmatched(DEFAULT_SUMMARY_FILTERS.showUnmatched);
    setShowNoPunch(DEFAULT_SUMMARY_FILTERS.showNoPunch);
    setMetricMode(DEFAULT_SUMMARY_FILTERS.metricMode);
    setSort({
      sortBy: DEFAULT_SUMMARY_FILTERS.sortBy,
      sortDir: DEFAULT_SUMMARY_FILTERS.sortDir,
      secondarySortBy: DEFAULT_SUMMARY_FILTERS.secondarySortBy,
      secondarySortDir: DEFAULT_SUMMARY_FILTERS.secondarySortDir,
    });
  }, [
    clearOffices,
    clearSchedules,
    setColumnFilters,
    setHeads,
    setMetricMode,
    setSearch,
    setShowNoPunch,
    setShowUnmatched,
    setSort,
  ]);
  const handleManualDialogOpenChange = useCallback((open: boolean) => {
    setManualDialogOpen(open);
    if (!open) {
      setManualDialogEditing(null);
    }
  }, []);

  const handleAddManualExclusion = useCallback(() => {
    setManualDialogEditing(null);
    setManualDialogOpen(true);
  }, []);

  const handleEditManualExclusion = useCallback((exclusion: ManualExclusion) => {
    setManualDialogEditing(exclusion);
    setManualDialogOpen(true);
  }, []);

  const handleRemoveManualExclusion = useCallback((id: string) => {
    setManualExclusions((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const handleManualDialogSubmit = useCallback(
    (draft: Omit<ManualExclusion, "id">) => {
      setManualExclusions((prev) => {
        const normalized: Omit<ManualExclusion, "id"> = {
          ...draft,
          dates: Array.from(new Set(draft.dates)).sort((a, b) => a.localeCompare(b)),
          note: draft.note && draft.note.trim().length ? draft.note.trim() : undefined,
          officeIds:
            draft.scope === "offices" && draft.officeIds?.length ? [...draft.officeIds] : undefined,
          employeeIds:
            draft.scope === "employees" && draft.employeeIds?.length
              ? [...draft.employeeIds]
              : undefined,
        };
        if (manualDialogEditing) {
          return sortManualExclusions(
            prev.map((entry) =>
              entry.id === manualDialogEditing.id
                ? { ...manualDialogEditing, ...normalized, id: manualDialogEditing.id }
                : entry
            )
          );
        }
        const newEntry: ManualExclusion = {
          ...normalized,
          id: generateManualExclusionId(),
        };
        return sortManualExclusions([...prev, newEntry]);
      });
    },
    [manualDialogEditing]
  );
  const manualResolvedRef = useRef<Set<string>>(new Set());
  const manualResolvedTokens = useMemo(() => Array.from(manualResolved), [manualResolved]);
  useEffect(() => {
    manualResolvedRef.current = manualResolved;
  }, [manualResolved]);

  const addManualResolved = useCallback((token: string) => {
    if (!token) return;
    setManualResolvedState((prev) => {
      if (prev.has(token)) return prev;
      const next = new Set(prev);
      next.add(token);
      return next;
    });
  }, []);

  const removeManualResolved = useCallback((token: string) => {
    if (!token) return;
    setManualResolvedState((prev) => {
      if (!prev.has(token)) return prev;
      const next = new Set(prev);
      next.delete(token);
      return next;
    });
  }, []);

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
  const [expandedWarnings, setExpandedWarnings] = useState<Record<string, boolean>>({});
  const [resolveTarget, setResolveTarget] = useState<{
    token: string;
    name: string | null;
  } | null>(null);
  const [resolveBusy, setResolveBusy] = useState(false);

  useEffect(() => {
    if (metricMode === "minutes") {
      if (sortBy === "latePercent") {
        setSort({ sortBy: "lateMinutes" });
      } else if (sortBy === "undertimePercent") {
        setSort({ sortBy: "undertimeMinutes" });
      }
      if (secondarySortBy === "latePercent") {
        setSort({ secondarySortBy: "lateMinutes" });
      } else if (secondarySortBy === "undertimePercent") {
        setSort({ secondarySortBy: "undertimeMinutes" });
      }
    } else {
      if (sortBy === "lateMinutes") {
        setSort({ sortBy: "latePercent" });
      } else if (sortBy === "undertimeMinutes") {
        setSort({ sortBy: "undertimePercent" });
      }
      if (secondarySortBy === "lateMinutes") {
        setSort({ secondarySortBy: "latePercent" });
      } else if (secondarySortBy === "undertimeMinutes") {
        setSort({ secondarySortBy: "undertimePercent" });
      }
    }
  }, [metricMode, secondarySortBy, setSort, sortBy]);

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
  const skipAutoEvaluateRef = useRef(false);
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

  const activePeriod = useMemo(() => {
    if (useManualPeriod) {
      if (!manualSelectionValid || !manualPeriodSelection) return null;
      return { year: manualPeriodSelection.year, month: manualPeriodSelection.month };
    }
    const firstRow = filteredPerDayRows[0];
    if (!firstRow) return null;
    const [yearStr, monthStr] = firstRow.dateISO.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
    return { year, month };
  }, [filteredPerDayRows, manualPeriodSelection, manualSelectionValid, useManualPeriod]);

  const manualActivePeriodLabel = useMemo(() => {
    if (!activePeriod) return null;
    return manualPeriodFormatter.format(
      new Date(Date.UTC(activePeriod.year, activePeriod.month - 1, 1))
    );
  }, [activePeriod]);

  const manualExclusionStorageKey = useMemo(() => {
    if (!activePeriod) return null;
    return `hrps.biometrics.manualExclusions.${activePeriod.year}-${pad2(activePeriod.month)}`;
  }, [activePeriod]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!manualExclusionStorageKey) {
      setManualExclusions([]);
      setManualExclusionsHydrated(true);
      return;
    }
    setManualExclusionsHydrated(false);
    try {
      const raw = window.localStorage.getItem(manualExclusionStorageKey);
      if (!raw) {
        setManualExclusions([]);
      } else {
        const parsed = JSON.parse(raw);
        const sanitized = sanitizeManualExclusions(parsed);
        setManualExclusions(sanitized);
      }
    } catch (error) {
      console.warn("Failed to load manual exclusions", error);
      setManualExclusions([]);
    } finally {
      setManualExclusionsHydrated(true);
    }
  }, [manualExclusionStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!manualExclusionStorageKey || !manualExclusionsHydrated) return;
    try {
      if (!manualExclusions.length) {
        window.localStorage.removeItem(manualExclusionStorageKey);
      } else {
        window.localStorage.setItem(manualExclusionStorageKey, JSON.stringify(manualExclusions));
      }
    } catch (error) {
      console.warn("Failed to persist manual exclusions", error);
    }
  }, [manualExclusionStorageKey, manualExclusions, manualExclusionsHydrated]);

  const manualExclusionContext = useMemo(() => {
    if (!manualExclusions.length) {
      return {
        applicable: [] as ManualExclusion[],
        outOfPeriodCounts: new Map<string, number>(),
        totalOutOfPeriod: 0,
      };
    }
    if (!activePeriod) {
      return {
        applicable: manualExclusions.map((exclusion) => ({ ...exclusion })),
        outOfPeriodCounts: new Map<string, number>(),
        totalOutOfPeriod: 0,
      };
    }
    const prefix = `${activePeriod.year}-${pad2(activePeriod.month)}`;
    const outOfPeriodCounts = new Map<string, number>();
    const applicable: ManualExclusion[] = [];
    for (const exclusion of manualExclusions) {
      const inPeriod = exclusion.dates.filter((date) => date.startsWith(prefix));
      const outCount = exclusion.dates.length - inPeriod.length;
      if (outCount > 0) {
        outOfPeriodCounts.set(exclusion.id, outCount);
      }
      if (inPeriod.length) {
        applicable.push({ ...exclusion, dates: inPeriod });
      }
    }
    const totalOutOfPeriod = Array.from(outOfPeriodCounts.values()).reduce(
      (sum, value) => sum + value,
      0
    );
    return { applicable, outOfPeriodCounts, totalOutOfPeriod };
  }, [activePeriod, manualExclusions]);

  const manualApplicableCount = manualExclusionContext.applicable.length;
  const manualOutOfPeriodMap = manualExclusionContext.outOfPeriodCounts;
  const manualOutOfPeriodTotal = manualExclusionContext.totalOutOfPeriod;

  const manualResolvedStorageKey = useMemo(() => {
    if (!departmentId || !activePeriod) return null;
    return `hrps:manual-resolved:${departmentId}:${activePeriod.year}-${pad2(activePeriod.month)}`;
  }, [activePeriod, departmentId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!manualResolvedStorageKey) {
      setManualResolvedState(new Set<string>());
      setManualResolvedHydrated(true);
      return;
    }
    setManualResolvedHydrated(false);
    try {
      const raw = window.localStorage.getItem(manualResolvedStorageKey);
      if (!raw) {
        setManualResolvedState(new Set<string>(manualResolvedRef.current));
      } else {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const tokens = parsed
            .filter((value): value is string => typeof value === "string")
            .map((value) => normalizeBiometricToken(value))
            .filter((value) => value.length > 0);
          const merged = new Set<string>(tokens);
          for (const token of manualResolvedRef.current) {
            merged.add(token);
          }
          setManualResolvedState(merged);
        } else {
          setManualResolvedState(new Set<string>(manualResolvedRef.current));
        }
      }
    } catch (error) {
      console.warn("Failed to load manual resolved tokens", error);
      setManualResolvedState(new Set<string>(manualResolvedRef.current));
    } finally {
      setManualResolvedHydrated(true);
    }
  }, [manualResolvedStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!manualResolvedStorageKey) return;
    if (!manualResolvedHydrated) return;
    try {
      window.localStorage.setItem(
        manualResolvedStorageKey,
        JSON.stringify(Array.from(manualResolved))
      );
    } catch (error) {
      console.warn("Failed to persist manual resolved tokens", error);
    }
  }, [manualResolved, manualResolvedHydrated, manualResolvedStorageKey]);

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

    if (!manualExclusionsHydrated) return;

    const manualKey = manualPeriodSelection
      ? `${manualPeriodSelection.year}-${pad2(manualPeriodSelection.month)}`
      : "auto";

    if (skipAutoEvaluateRef.current) return;

    if (!filteredPerDayRows.length) {
      const emptyKey = `${manualKey}:empty`;
      if (lastEvaluatedKey.current !== emptyKey) {
        setPerDay([]);
        setPerEmployee([]);
        lastEvaluatedKey.current = emptyKey;
      }
      return;
    }

    const manualPayload = manualExclusionContext.applicable;
    const payloadKey = makeEvaluationPayloadKey(manualKey, filteredPerDayRows, manualPayload);
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
            composedFromDayOnly: row.composedFromDayOnly,
          })),
          manualExclusions: manualPayload,
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
    manualExclusionContext,
    manualExclusionsHydrated,
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
    if (!dedupedPerEmployee.length) return [];
    const set = new Set<string>();
    for (const row of dedupedPerEmployee) {
      if (!row.scheduleTypes?.length) continue;
      for (const type of row.scheduleTypes) {
        if (type) set.add(type);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [dedupedPerEmployee]);

  const manualOfficeOptions = useMemo<ManualDialogOfficeOption[]>(() => {
    if (!dedupedPerEmployee.length) return [];
    const map = new Map<string, string>();
    for (const row of dedupedPerEmployee) {
      const id = row.officeId?.trim();
      if (!id) continue;
      if (map.has(id)) continue;
      const label = row.officeName?.trim();
      map.set(id, label && label.length ? label : UNASSIGNED_OFFICE_LABEL);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [dedupedPerEmployee]);

  const manualEmployeeOptions = useMemo<ManualDialogEmployeeOption[]>(() => {
    if (!dedupedPerEmployee.length) return [];
    const map = new Map<string, { name: string; display: string }>();
    for (const row of dedupedPerEmployee) {
      const id = row.resolvedEmployeeId?.trim();
      if (!id || map.has(id)) continue;
      const employeeNo = firstEmployeeNoToken(row.employeeNo);
      const baseName = row.employeeName?.trim()?.length
        ? row.employeeName.trim()
        : row.employeeToken?.trim()?.length
        ? row.employeeToken.trim()
        : row.employeeId?.trim()?.length
        ? row.employeeId.trim()
        : "Unnamed employee";
      const display = employeeNo && employeeNo.length ? `${baseName} (${employeeNo})` : baseName;
      map.set(id, { name: baseName, display });
    }
    return Array.from(map.entries())
      .map(([id, value]) => ({ id, name: value.name, display: value.display }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [dedupedPerEmployee]);

  const manualOfficeNameMap = useMemo(
    () => new Map(manualOfficeOptions.map((option) => [option.id, option.name])),
    [manualOfficeOptions]
  );
  const manualEmployeeLabelMap = useMemo(
    () => new Map(manualEmployeeOptions.map((option) => [option.id, option.display])),
    [manualEmployeeOptions]
  );

  const filteredPerEmployee = useMemo(() => {
    if (!dedupedPerEmployee.length) return [] as PerEmployeeRow[];
    const officeKeys = selectedOffices.length ? new Set(selectedOffices) : null;
    const scheduleKeys = selectedScheduleTypes.length ? new Set(selectedScheduleTypes) : null;
    return dedupedPerEmployee.filter((row) => {
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
      if (headsFilter === "heads" && row.isHead !== true) {
        return false;
      }
      if (headsFilter === "nonHeads" && row.isHead !== false) {
        return false;
      }
      return true;
    });
  }, [
    headsFilter,
    dedupedPerEmployee,
    selectedOffices,
    selectedScheduleTypes,
    showUnmatched,
  ]);

  // Column filter helpers (placed before usage)
  const getSummaryValue = useCallback(
    (row: PerEmployeeRow, key: SummaryColumnKey): string | number | null => {
      switch (key) {
        case "employeeId": {
          const no = firstEmployeeNoToken(row.employeeNo);
          return (no && no.length ? no : row.employeeToken || row.employeeId || "").toString();
        }
        case "employeeName":
          return row.employeeName ?? "";
        case "office":
          return row.officeName ?? (row.resolvedEmployeeId ? UNASSIGNED_OFFICE_LABEL : UNKNOWN_OFFICE_LABEL);
        case "schedule":
          return (row.scheduleTypes ?? []).join(", ");
        case "matchStatus": {
          const isUnmatched = isUnmatchedIdentity(row.identityStatus, row.resolvedEmployeeId);
          if (isUnmatched) return UNMATCHED_LABEL;
          return row.resolvedEmployeeId ? "Resolved" : "Matched";
        }
        case "source":
          return formatScheduleSource(row.scheduleSource);
        case "head":
          return row.isHead ? "Yes" : "No";
      case "days":
        return row.daysWithLogs;
      case "noPunchDays":
        return row.noPunchDays;
      case "absences":
        return row.absences;
      case "excusedDays":
        return row.excusedDays;
        case "lateDays":
          return row.lateDays;
        case "undertimeDays":
          return row.undertimeDays;
        case "latePercent":
          return Math.round((row.lateRate ?? 0) * 10000) / 100;
        case "undertimePercent":
          return Math.round((row.undertimeRate ?? 0) * 10000) / 100;
        case "lateMinutes":
          return row.totalLateMinutes ?? 0;
        case "undertimeMinutes":
          return row.totalUndertimeMinutes ?? 0;
        case "resolvedEmployeeId":
          return row.resolvedEmployeeId ?? "";
        default:
          return null;
      }
    },
    []
  );

  const filterRowsByColumnFilters = useCallback(
    (
      rows: PerEmployeeRow[],
      filters: Partial<Record<SummaryColumnKey, ColumnFilterState>>
    ) => {
      const entries = Object.entries(filters).filter(([, value]) => value) as Array<
        [SummaryColumnKey, ColumnFilterState]
      >;
      if (!entries.length) return rows;
      return rows.filter((row) => {
        for (const [key, filter] of entries) {
          const value = getSummaryValue(row, key);
          if (filter.kind === "text") {
            const textValue = normalizeFilterText(value);
            if (!filter.values.includes(textValue)) {
              return false;
            }
          } else if (filter.kind === "number") {
            if (!filter.value.trim()) {
              continue;
            }
            const target = Number(filter.value);
            if (Number.isNaN(target)) {
              continue;
            }
            const numericValue = typeof value === "number" ? value : Number(value);
            if (Number.isNaN(numericValue)) {
              return false;
            }
            switch (filter.operator) {
              case "=":
                if (numericValue !== target) return false;
                break;
              case ">":
                if (!(numericValue > target)) return false;
                break;
              case ">=":
                if (!(numericValue >= target)) return false;
                break;
              case "<":
                if (!(numericValue < target)) return false;
                break;
              case "<=":
                if (!(numericValue <= target)) return false;
                break;
              default:
                break;
            }
          }
        }
        return true;
      });
    },
    [getSummaryValue]
  );

  const applyColumnFilters = useCallback(
    (rows: PerEmployeeRow[]) => filterRowsByColumnFilters(rows, columnFilters),
    [columnFilters, filterRowsByColumnFilters]
  );

  const clearColumnFilter = useCallback((key: SummaryColumnKey) => {
    setColumnFilters((prev) => {
      if (!(key in prev)) return prev;
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const searchedPerEmployee = useMemo(() => {
    if (!filteredPerEmployee.length) return filteredPerEmployee;
    const base = applyColumnFilters(filteredPerEmployee);
    const query = employeeSearch.trim().toLowerCase();
    if (!query) return base;
    return base.filter((row) => {
      const name = row.employeeName?.toLowerCase() ?? "";
      const id = row.employeeId?.toLowerCase() ?? "";
      const employeeNo = firstEmployeeNoToken(row.employeeNo)?.toLowerCase() ?? "";
      const token = row.employeeToken?.toLowerCase() ?? "";
      return (
        name.includes(query) ||
        employeeNo.includes(query) ||
        id.includes(query) ||
        token.includes(query)
      );
    });
  }, [applyColumnFilters, employeeSearch, filteredPerEmployee]);

  const lateMetricColumnKey: SummaryColumnKey =
    metricMode === "minutes" ? "lateMinutes" : "latePercent";
  const undertimeMetricColumnKey: SummaryColumnKey =
    metricMode === "minutes" ? "undertimeMinutes" : "undertimePercent";

  const ColumnFilterControl = ({ columnKey }: { columnKey: SummaryColumnKey }) => {
    const definition = SUMMARY_COLUMN_DEFINITION_MAP[columnKey];
    const filterState = columnFilters[columnKey];
    let options: Array<{ value: string; count: number }> = [];
    if (TEXT_FILTER_KEYS.has(columnKey)) {
      const filtersWithoutCurrent: Partial<Record<SummaryColumnKey, ColumnFilterState>> = {
        ...columnFilters,
      };
      delete filtersWithoutCurrent[columnKey];
      const scopedRows = filterRowsByColumnFilters(filteredPerEmployee, filtersWithoutCurrent);
      const counts = new Map<string, number>();
      for (const row of scopedRows) {
        const raw = getSummaryValue(row, columnKey);
        const textValue = normalizeFilterText(raw);
        counts.set(textValue, (counts.get(textValue) ?? 0) + 1);
      }
      options = Array.from(counts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => a.value.localeCompare(b.value));
    }
    const [open, setOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
      if (!open) {
        setSearchTerm("");
      }
    }, [open]);

    const isNumeric = definition ? NUMERIC_FILTER_TYPES.has(definition.type) : false;
    const isActive = filterState
      ? filterState.kind === "text" || (filterState.kind === "number" && filterState.value.trim().length > 0)
      : false;

    const triggerClass = cn(
      "inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-accent",
      isActive ? "text-primary" : "text-muted-foreground"
    );

    const allValues = options.map((option) => option.value);
    const selectedValues =
      filterState?.kind === "text" ? filterState.values : allValues;
    const selectedSet = new Set(selectedValues);
    const normalizedQuery = searchTerm.trim().toLowerCase();
    const filteredOptions = normalizedQuery.length
      ? options.filter((option) => option.value.toLowerCase().includes(normalizedQuery))
      : options;

    if (isNumeric) {
      const numberFilter: NumberColumnFilterState =
        filterState?.kind === "number"
          ? filterState
          : { kind: "number", operator: COLUMN_FILTER_OPERATORS[0], value: "" };

      const handleOperatorChange = (operator: ColumnFilterOperator) => {
        setColumnFilters((prev) => ({
          ...prev,
          [columnKey]: {
            kind: "number",
            operator,
            value:
              prev[columnKey]?.kind === "number" ? prev[columnKey].value : numberFilter.value,
          },
        }));
      };

      const handleValueChange = (value: string) => {
        setColumnFilters((prev) => ({
          ...prev,
          [columnKey]: {
            kind: "number",
            operator:
              prev[columnKey]?.kind === "number"
                ? prev[columnKey].operator
                : numberFilter.operator,
            value,
          },
        }));
      };

      return (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button type="button" className={triggerClass} aria-label={`Filter ${definition?.label ?? "column"}`}>
              <FilterIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 space-y-3 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Filter {definition?.label ?? "column"}</p>
              {filterState ? (
                <Button variant="ghost" size="sm" onClick={() => clearColumnFilter(columnKey)}>
                  Clear
                </Button>
              ) : null}
            </div>
            <Select
              value={numberFilter.operator}
              onValueChange={(op) => handleOperatorChange(op as ColumnFilterOperator)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Operator" />
              </SelectTrigger>
              <SelectContent>
                {COLUMN_FILTER_OPERATORS.map((operator) => (
                  <SelectItem key={operator} value={operator}>
                    {operator}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              value={numberFilter.value}
              onChange={(event) => handleValueChange(event.target.value)}
              placeholder="Value"
              className="h-9"
            />
            <div className="text-xs text-muted-foreground">
              Rows match when the column value {numberFilter.operator} {numberFilter.value || "…"}.
            </div>
          </PopoverContent>
        </Popover>
      );
    }

    const toggleValue = (value: string) => {
      setColumnFilters((prev) => {
        const base = options.map((option) => option.value);
        const current =
          prev[columnKey]?.kind === "text" ? prev[columnKey].values : base;
        const nextSet = new Set(current);
        if (nextSet.has(value)) {
          nextSet.delete(value);
        } else {
          nextSet.add(value);
        }
        const nextValues = base.filter((item) => nextSet.has(item));
        if (nextValues.length === base.length) {
          const { [columnKey]: _removed, ...rest } = prev;
          return rest;
        }
        return {
          ...prev,
          [columnKey]: { kind: "text", values: nextValues },
        };
      });
    };

    const handleSelectAll = () => {
      clearColumnFilter(columnKey);
    };

    const handleSelectNone = () => {
      setColumnFilters((prev) => ({
        ...prev,
        [columnKey]: { kind: "text", values: [] },
      }));
    };

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className={triggerClass} aria-label={`Filter ${definition?.label ?? "column"}`}>
            <FilterIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 space-y-3 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Filter {definition?.label ?? "column"}</p>
            {filterState?.kind === "text" ? (
              <Button variant="ghost" size="sm" onClick={() => clearColumnFilter(columnKey)}>
                Clear
              </Button>
            ) : null}
          </div>
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search values"
            className="h-9"
          />
          <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {filteredOptions.length ? (
              filteredOptions.map((option) => {
                const checked = selectedSet.has(option.value);
                return (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleValue(option.value)}
                      className="h-4 w-4"
                    />
                    <span className="flex-1 truncate" title={option.value}>
                      {option.value}
                    </span>
                    <span className="text-xs text-muted-foreground">{option.count}</span>
                  </label>
                );
              })
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">No matching values.</p>
            )}
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <Button type="button" variant="ghost" size="sm" onClick={handleSelectAll}>
              Select all
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={handleSelectNone}>
              Select none
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

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
      if (headsFilter === "heads" && row.isHead !== true) {
        return false;
      }
      if (headsFilter === "nonHeads" && row.isHead !== false) {
        return false;
      }
      if (!showUnmatched && isUnmatchedIdentity(row.identityStatus, row.resolvedEmployeeId)) {
        return false;
      }
      if (!hasQuery) return true;
      const name = row.employeeName?.toLowerCase() ?? "";
      const id = row.employeeId?.toLowerCase() ?? "";
      const employeeNo = firstEmployeeNoToken(row.employeeNo)?.toLowerCase() ?? "";
      const token = row.employeeToken?.toLowerCase() ?? "";
      return (
        name.includes(query) ||
        employeeNo.includes(query) ||
        id.includes(query) ||
        token.includes(query)
      );
    });
  }, [
    employeeSearch,
    headsFilter,
    perDay,
    selectedOffices,
    selectedScheduleTypes,
    showUnmatched,
  ]);

  useEffect(() => {
    setPage(0);
  }, [filteredPerDayPreview]);

  useEffect(() => {
    if (!selectedScheduleTypes.length) return;
    const available = new Set(scheduleTypeOptions);
    const filtered = selectedScheduleTypes.filter((type) => available.has(type));
    if (filtered.length !== selectedScheduleTypes.length) {
      setSchedules(filtered);
    }
  }, [scheduleTypeOptions, selectedScheduleTypes, setSchedules]);

  useEffect(() => {
    if (!selectedOffices.length) return;
    const available = new Set(officeOptions.map((option) => option.key));
    const filtered = selectedOffices.filter((key) => available.has(key));
    if (filtered.length !== selectedOffices.length) {
      setOffices(filtered);
    }
  }, [officeOptions, selectedOffices, setOffices]);

  useEffect(() => {
    if (perDay === null) {
      if (selectedOffices.length) {
        clearOffices();
      }
      if (selectedScheduleTypes.length) {
        clearSchedules();
      }
    }
  }, [clearOffices, clearSchedules, perDay, selectedOffices.length, selectedScheduleTypes.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: InsightsSettings = {
      visibleCharts,
      collapsed: insightsCollapsed,
    };
    window.localStorage.setItem(INSIGHTS_SETTINGS_KEY, JSON.stringify(payload));
  }, [
    visibleCharts,
    insightsCollapsed,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: StoredColumnSettings = {
      order: columnOrder,
      selected: selectedColumnKeys,
    };
    window.localStorage.setItem(EXPORT_COLUMNS_STORAGE_KEY, JSON.stringify(payload));
  }, [columnOrder, selectedColumnKeys]);

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

  const reEnrichToken = useCallback(
    async (token: string, identity: IdentityRecord | null) => {
      const normalizedToken = normalizeBiometricToken(token);
      if (!normalizedToken) return;

      const relevantRows = filteredPerDayRows.filter(
        (row) => getNormalizedTokenForRow(row) === normalizedToken
      );

      const manualKey =
        useManualPeriod && manualPeriodSelection
          ? `${manualPeriodSelection.year}-${pad2(manualPeriodSelection.month)}`
          : "auto";

      if (!manualExclusionsHydrated) {
        toast({
          title: "Manual exclusions loading",
          description: "Manual exclusions are still loading. Please try again shortly.",
          variant: "destructive",
        });
        return;
      }

      const manualPayload = manualExclusionContext.applicable;

      if (!relevantRows.length) {
        lastEvaluatedKey.current = makeEvaluationPayloadKey(
          manualKey,
          filteredPerDayRows,
          manualPayload
        );
        return;
      }

      const employeeName = identity?.employeeName ?? relevantRows[0]?.employeeName ?? null;
      const resolvedEmployeeId = identity?.employeeId ?? relevantRows[0]?.resolvedEmployeeId ?? null;
      const officeId = identity?.officeId ?? relevantRows[0]?.officeId ?? null;
      const officeName = identity?.officeName ?? relevantRows[0]?.officeName ?? null;
      const employeeNo =
        firstEmployeeNoToken(identity?.employeeNo) ??
        firstEmployeeNoToken(relevantRows[0]?.employeeNo) ??
        null;
      const isHead = identity?.isHead ?? relevantRows[0]?.isHead ?? null;

      const entries = relevantRows.map((row) => ({
        employeeId: row.employeeId,
        employeeName: employeeName ?? row.employeeName,
        employeeToken: row.employeeToken ?? token,
        resolvedEmployeeId,
        officeId,
        officeName,
        dateISO: row.dateISO,
        day: row.day,
        earliest: row.earliest,
        latest: row.latest,
        allTimes: row.allTimes,
        punches: row.punches,
        sourceFiles: row.sourceFiles,
        composedFromDayOnly: row.composedFromDayOnly,
      }));

      const response = await timeout(
        fetch("/api/biometrics/re-enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries, manualExclusions: manualPayload }),
        }),
        15_000
      );

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Unable to refresh attendance details.");
      }

      const payload = (await response.json()) as {
        perDay: PerDayRow[];
        perEmployee: PerEmployeeRow[];
      };

      const updatedPerDayRows = sortPerDayRows(
        payload.perDay.map((row) => toChronologicalRow(row))
      );

      setPerDay((prev) => {
        if (!prev) return prev;
        const filtered = prev.filter(
          (row) => getNormalizedTokenForRow(row) !== normalizedToken
        );
        return sortPerDayRows([...filtered, ...updatedPerDayRows]);
      });

      setPerEmployee((prev) => {
        if (!prev) return prev;
        const filtered = prev.filter(
          (row) =>
            normalizeBiometricToken(row.employeeToken ?? row.employeeId ?? "") !== normalizedToken
        );
        return [...filtered, ...payload.perEmployee];
      });

      const updatedFilteredRows = filteredPerDayRows.map((row) => {
        if (getNormalizedTokenForRow(row) !== normalizedToken) return row;
        return {
          ...row,
          employeeName: employeeName ?? row.employeeName,
          resolvedEmployeeId,
          officeId,
          officeName,
          employeeNo,
          isHead,
        };
      });
      lastEvaluatedKey.current = makeEvaluationPayloadKey(
        manualKey,
        updatedFilteredRows,
        manualPayload
      );

      const hasResolvedEmployee = payload.perEmployee.some((row) => row.resolvedEmployeeId);
      if (!hasResolvedEmployee) {
        removeManualResolved(normalizedToken);
      }
    },
    [
      filteredPerDayRows,
      manualExclusionContext,
      manualExclusionsHydrated,
      manualPeriodSelection,
      removeManualResolved,
      setPerDay,
      setPerEmployee,
      toast,
      useManualPeriod,
    ]
  );

  const handleResolveMapping = useCallback(
    async (token: string, employeeId: string, employeeName: string) => {
      const normalizedToken = normalizeBiometricToken(token);
      const wasManual = manualResolvedRef.current.has(normalizedToken);
      skipAutoEvaluateRef.current = true;
      setResolveBusy(true);
      let addedManual = false;
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

        if (!wasManual) {
          addManualResolved(normalizedToken);
          addedManual = true;
        }

        await reEnrichToken(token, normalized);

        setResolveTarget(null);
        toast({
          title: "Identity resolved",
          description: `${employeeName} is now linked to ${token}.`,
        });
      } catch (error) {
        console.error("Failed to resolve biometrics token", error);
        if (addedManual) {
          removeManualResolved(normalizedToken);
        }
        lastEvaluatedKey.current = "";
        const message =
          error instanceof Error ? error.message : "Unable to resolve biometrics token.";
        toast({
          title: "Resolve failed",
          description: message,
          variant: "destructive",
        });
      } finally {
        skipAutoEvaluateRef.current = false;
        setResolveBusy(false);
      }
    },
    [addManualResolved, reEnrichToken, removeManualResolved, toast]
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
    if (!searchedPerEmployee.length) return [] as PerEmployeeRow[];
    const rows = [...searchedPerEmployee];
    const primaryMultiplier = sortDir === "asc" ? 1 : -1;
    const secondaryMultiplier = secondarySortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const primary = compareSummaryField(a, b, sortBy);
      if (primary !== 0) {
        return primary * primaryMultiplier;
      }
      if (secondarySortBy) {
        const secondary = compareSummaryField(a, b, secondarySortBy);
        if (secondary !== 0) {
          return secondary * secondaryMultiplier;
        }
      }
      return compareEmployeeIdentifiers(a, b);
    });
    return rows;
  }, [searchedPerEmployee, secondarySortBy, secondarySortDir, sortBy, sortDir]);

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
    (field: SummarySortField) => {
      togglePrimarySort(field);
    },
    [togglePrimarySort]
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
    if (!dedupedPerEmployee.length || !perDay?.length) return;
    if (useManualPeriod && !manualSelectionValid) return;

    const employees = sortedPerEmployee;
    const days = filteredPerDayPreview;

    if (!employees.length || !days.length) {
      toast({
        title: "Export skipped",
        description: "No rows match the current filters.",
      });
      return;
    }

    const baseColumns = exportColumnKeys.length
      ? exportColumnKeys
      : DEFAULT_SUMMARY_SELECTED_COLUMNS;
    const baseOrder = columnOrder.length ? columnOrder : DEFAULT_SUMMARY_COLUMN_ORDER;

    const allowedColumns = baseColumns.filter((key) => {
      if (!showNoPunchColumn && key === "noPunchDays") return false;
      if (metricMode === "minutes") {
        return key !== "latePercent" && key !== "undertimePercent";
      }
      return key !== "lateMinutes" && key !== "undertimeMinutes";
    });

    const insertColumn = (key: SummaryColumnKey) => {
      if (allowedColumns.includes(key)) return;
      const targetIndex = baseOrder.indexOf(key);
      if (targetIndex === -1) {
        allowedColumns.push(key);
        return;
      }
      let inserted = false;
      for (let index = 0; index < allowedColumns.length; index += 1) {
        const current = allowedColumns[index];
        const currentIndex = baseOrder.indexOf(current);
        if (currentIndex === -1 || currentIndex > targetIndex) {
          allowedColumns.splice(index, 0, key);
          inserted = true;
          break;
        }
      }
      if (!inserted) {
        allowedColumns.push(key);
      }
    };

    const requiredMetricColumns: SummaryColumnKey[] =
      metricMode === "minutes"
        ? ["lateMinutes", "undertimeMinutes"]
        : ["latePercent", "undertimePercent"];
    requiredMetricColumns.forEach(insertColumn);

    if (showNoPunchColumn) {
      insertColumn("noPunchDays");
    }

    const columnsForExport = allowedColumns;

    const columnLabels = columnsForExport.map(
      (key) => SUMMARY_COLUMN_DEFINITION_MAP[key]?.label ?? key
    );

    const viewOfficeLabels = selectedOffices.map((key) => getOfficeLabel(key) ?? key);
    const officeIdentifiers = selectedOffices.map((key) =>
      key.startsWith(UNKNOWN_OFFICE_KEY_PREFIX) ? "__unknown__" : key
    );

    try {
      exportResultsToXlsx(employees, days, {
        columns: columnsForExport,
        filters: {
          offices: officeIdentifiers,
          labels: viewOfficeLabels,
          viewLabels: viewOfficeLabels,
          applied: selectedOffices.length > 0,
          applyToDownload: true,
          exportFilteredOnly: true,
        },
        metadata: {
          exportTime: new Date(),
          period: exportPeriodLabel,
          columnLabels,
          appVersion: APP_VERSION,
        },
        manualResolvedTokens: manualResolvedTokens,
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
    APP_VERSION,
    columnOrder,
    dedupedPerEmployee,
    exportColumnKeys,
    exportPeriodLabel,
    filteredPerDayPreview,
    manualSelectionValid,
    manualResolvedTokens,
    metricMode,
    perDay,
    selectedOffices,
    showNoPunchColumn,
    sortedPerEmployee,
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
        <div className="mt-4 space-y-3 rounded-lg border border-dashed border-muted-foreground/40 bg-background/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Manual exclusions</p>
              <p className="text-xs text-muted-foreground">
                Excuse specific dates from late, undertime, and absence calculations for this period.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAddManualExclusion}
              disabled={!manualExclusionsHydrated || !activePeriod}
            >
              <Plus className="mr-2 h-4 w-4" /> Add exclusion
            </Button>
          </div>
          {!manualExclusionsHydrated ? (
            <p className="text-xs text-muted-foreground">Loading manual exclusions…</p>
          ) : manualExclusions.length ? (
            <ul className="space-y-2">
              {manualExclusions.map((exclusion) => {
                const dateLabel = formatManualDateSummary(exclusion.dates);
                const reasonLabel = formatManualReasonLabel(exclusion.reason, exclusion.note);
                const officeNames = (exclusion.officeIds ?? []).map(
                  (id) => manualOfficeNameMap.get(id) ?? id
                );
                const employeeNames = (exclusion.employeeIds ?? []).map(
                  (id) => manualEmployeeLabelMap.get(id) ?? id
                );
                const scopeLabel =
                  exclusion.scope === "all"
                    ? "All employees"
                    : exclusion.scope === "offices"
                    ? `Offices (${officeNames.length})`
                    : `Employees (${employeeNames.length})`;
                const scopeDetails = exclusion.scope === "offices" ? officeNames : employeeNames;
                const outOfPeriod = manualOutOfPeriodMap.get(exclusion.id) ?? 0;
                return (
                  <li
                    key={exclusion.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded border border-border/60 bg-muted/30 px-3 py-2"
                  >
                    <div className="text-sm">
                      <p className="font-medium">{dateLabel || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {reasonLabel}
                        {" "}•{" "}
                        {scopeDetails.length ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help underline decoration-dotted underline-offset-2">
                                {scopeLabel}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              {scopeDetails.join(", ")}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          scopeLabel
                        )}
                        {outOfPeriod > 0 ? ` • ${outOfPeriod} out of period` : null}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditManualExclusion(exclusion)}
                      >
                        <Pencil className="mr-1 h-4 w-4" /> Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRemoveManualExclusion(exclusion.id)}
                      >
                        <Trash2 className="mr-1 h-4 w-4" /> Remove
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No manual exclusions for this period.</p>
          )}
          {manualOutOfPeriodTotal > 0 && manualActivePeriodLabel ? (
            <p className="text-xs text-amber-600">
              {manualOutOfPeriodTotal} date{manualOutOfPeriodTotal === 1 ? "" : "s"} outside {manualActivePeriodLabel}{" "}
              will be ignored during evaluation.
            </p>
          ) : null}
        </div>
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

      {perEmployee && perDay && dedupedPerEmployee.length > 0 && (
        <div className="space-y-4">
          {identityStatusBadge && (
            <div className="flex flex-wrap items-center gap-2">
              {identityStatusBadge}
              {identityState.status === "error" && identityState.message ? (
                <span className="text-xs text-destructive">{identityState.message}</span>
              ) : null}
            </div>
          )}
          {manualApplicableCount > 0 ? (
            <Badge
              variant="outline"
              className="border-amber-500/60 bg-amber-500/10 text-amber-800"
            >
              Manual exclusions active ({manualApplicableCount})
            </Badge>
          ) : null}
          <InsightsPanel
            collapsed={insightsCollapsed}
            onCollapsedChange={setInsightsCollapsed}
            visibleCharts={visibleCharts}
            onVisibleChartsChange={updateVisibleCharts}
            perEmployee={dedupedPerEmployee}
            perDay={perDay ?? []}
            filteredPerEmployee={sortedPerEmployee}
            filteredPerDay={filteredPerDayPreview}
          />
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Per-Employee Summary</h2>
              <div className="flex flex-wrap items-center gap-2">
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
                    !sortedPerEmployee.length
                  }
                >
                  Download Results (Excel)
                </Button>
                {hasAnyFilters ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="inline-flex items-center gap-1"
                    onClick={handleClearAllFilters}
                  >
                    <XCircle className="h-4 w-4" aria-hidden="true" />
                    Clear filters
                  </Button>
                ) : null}
              </div>
            </div>
            <SummaryFiltersBar officeOptions={officeOptions} scheduleOptions={scheduleTypeOptions} />
          </div>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 text-left">
                    <div className="flex items-center gap-1">
                      <span>Employee No</span>
                      <ColumnFilterControl columnKey="employeeId" />
                    </div>
                  </th>
                  <th className="p-2 text-left">
                    <div className="flex items-center gap-1">
                      <span>Name</span>
                      <ColumnFilterControl columnKey="employeeName" />
                    </div>
                  </th>
                  <th className="p-2 text-left">
                    <div className="flex items-center gap-1">
                      <span>Office</span>
                      <ColumnFilterControl columnKey="office" />
                    </div>
                  </th>
                  <th className="p-2 text-left">
                    <div className="flex items-center gap-1">
                      <span>Schedule</span>
                      <ColumnFilterControl columnKey="schedule" />
                    </div>
                  </th>
                  <th className="p-2 text-center">
                    <div className="inline-flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleSort("days")}
                        className="inline-flex items-center gap-1 font-semibold"
                        aria-label="Sort by evaluated days"
                      >
                        Days
                        <ArrowUpDown
                          className={cn(
                            "h-3.5 w-3.5 transition-transform",
                            sortBy === "days" ? "opacity-100" : "opacity-40",
                            sortBy === "days" && sortDir === "asc" ? "rotate-180" : undefined
                          )}
                        />
                      </button>
                      <ColumnFilterControl columnKey="days" />
                    </div>
                  </th>
                  {showNoPunchColumn ? (
                    <th className="p-2 text-center">
                      <div className="inline-flex items-center justify-center gap-1">
                        <span>No-punch</span>
                        <ColumnFilterControl columnKey="noPunchDays" />
                      </div>
                    </th>
                  ) : null}
                  <th className="p-2 text-right">
                    <div className="inline-flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleSort("absences")}
                        className="inline-flex items-center gap-1 font-semibold"
                        aria-label="Sort by absences"
                      >
                        Absences
                        <ArrowUpDown
                          className={cn(
                            "h-3.5 w-3.5 transition-transform",
                            sortBy === "absences" ? "opacity-100" : "opacity-40",
                            sortBy === "absences" && sortDir === "asc" ? "rotate-180" : undefined
                          )}
                        />
                      </button>
                      <ColumnFilterControl columnKey="absences" />
                    </div>
                  </th>
                  <th className="p-2 text-center">
                    <div className="inline-flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleSort("lateDays")}
                        className="inline-flex items-center gap-1 font-semibold"
                        aria-label="Sort by late days"
                      >
                        Late
                        <ArrowUpDown
                          className={cn(
                            "h-3.5 w-3.5 transition-transform",
                            sortBy === "lateDays" ? "opacity-100" : "opacity-40",
                            sortBy === "lateDays" && sortDir === "asc" ? "rotate-180" : undefined
                          )}
                        />
                      </button>
                      <ColumnFilterControl columnKey="lateDays" />
                    </div>
                  </th>
                  <th className="p-2 text-center">
                    <div className="inline-flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleSort("undertimeDays")}
                        className="inline-flex items-center gap-1 font-semibold"
                        aria-label="Sort by undertime days"
                      >
                        Undertime
                        <ArrowUpDown
                          className={cn(
                            "h-3.5 w-3.5 transition-transform",
                            sortBy === "undertimeDays" ? "opacity-100" : "opacity-40",
                            sortBy === "undertimeDays" && sortDir === "asc" ? "rotate-180" : undefined
                          )}
                        />
                      </button>
                      <ColumnFilterControl columnKey="undertimeDays" />
                    </div>
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
                          handleSort(metricMode === "minutes" ? "lateMinutes" : "latePercent")
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
                            "h-3.5 w-3.5 transition-transform",
                            sortBy === (metricMode === "minutes" ? "lateMinutes" : "latePercent")
                              ? "opacity-100"
                              : "opacity-40",
                            sortBy === (metricMode === "minutes" ? "lateMinutes" : "latePercent") &&
                              sortDir === "asc"
                              ? "rotate-180"
                              : undefined
                          )}
                        />
                      </button>
                      <ColumnFilterControl columnKey={lateMetricColumnKey} />
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
                            metricMode === "minutes" ? "undertimeMinutes" : "undertimePercent"
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
                            "h-3.5 w-3.5 transition-transform",
                            sortBy === (metricMode === "minutes" ? "undertimeMinutes" : "undertimePercent")
                              ? "opacity-100"
                              : "opacity-40",
                            sortBy === (metricMode === "minutes" ? "undertimeMinutes" : "undertimePercent") &&
                              sortDir === "asc"
                              ? "rotate-180"
                              : undefined
                          )}
                        />
                      </button>
                      <ColumnFilterControl columnKey={undertimeMetricColumnKey} />
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
                  const normalizedRowToken = normalizeBiometricToken(
                    row.employeeToken ?? row.employeeId ?? ""
                  );
                  const hasResolverMapping = Boolean(row.resolvedEmployeeId);
                  const isUnmatched = isUnmatchedIdentity(row.identityStatus, row.resolvedEmployeeId);
                  const isManualSolved = normalizedRowToken
                    ? manualResolved.has(normalizedRowToken)
                    : false;
                  const sourceLabel = formatScheduleSource(row.scheduleSource);
                  const resolvedEmployeeId = row.resolvedEmployeeId?.trim();
                  const employeeNo = firstEmployeeNoToken(row.employeeNo);
                  const tokenDisplay = row.employeeToken || row.employeeId || "—";
                  const displayEmployeeNo = resolvedEmployeeId
                    ? employeeNo && employeeNo.length
                      ? employeeNo
                      : "—"
                    : isUnmatched
                    ? tokenDisplay
                    : employeeNo && employeeNo.length
                    ? employeeNo
                    : tokenDisplay || "—";
                  const showTokenTooltip =
                    isUnmatched && Boolean(row.employeeToken || row.employeeId);
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
                  const canResolve = Boolean(row.employeeToken) && (isUnmatched || hasResolverMapping);
                  const resolveActionLabel = isUnmatched ? "Resolve…" : "Re-resolve…";
                  return (
                    <tr key={key} className="odd:bg-muted/20">
                      <td className="p-2">
                        {showTokenTooltip ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="font-mono">
                                {displayEmployeeNo}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent sideOffset={6}>
                              Unmatched token (resolve to link to an employee).
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="font-mono">{displayEmployeeNo}</span>
                        )}
                      </td>
                      <td className="p-2 max-w-[16rem]">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate" title={displayEmployeeName}>
                            {displayEmployeeName}
                          </span>
                          {isUnmatched ? (
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
                                Linked manually during this session. Attendance uses the selected employee details.
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
                  <td className="p-2 text-right font-medium">{row.absences}</td>
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
                  <th className="p-2 text-left">Employee No</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Office</th>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Status</th>
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
                  const evaluationStatus = row.evaluationStatus ??
                    (row.status === "no_punch" || row.status === "excused" || row.status === "evaluated"
                      ? (row.status as DayEvaluationStatus)
                      : row.earliest || row.latest || (row.allTimes?.length ?? 0) > 0
                      ? "evaluated"
                      : "no_punch");
                  const isNoPunch = evaluationStatus === "no_punch";
                  const isExcused = evaluationStatus === "excused";
                  const isUnmatched = isUnmatchedIdentity(row.identityStatus, row.resolvedEmployeeId);
                  const resolvedEmployeeId = row.resolvedEmployeeId?.trim();
                  const employeeNo = firstEmployeeNoToken(row.employeeNo);
                  const tokenDisplay = row.employeeToken || row.employeeId || "—";
                  const displayEmployeeId = resolvedEmployeeId
                    ? employeeNo && employeeNo.length
                      ? employeeNo
                      : "—"
                    : isUnmatched
                    ? tokenDisplay
                    : employeeNo && employeeNo.length
                    ? employeeNo
                    : tokenDisplay || "—";
                  const showTokenTooltip =
                    isUnmatched && Boolean(row.employeeToken || row.employeeId);
                  const statusLabel =
                    typeof row.status === "string" && row.status.length
                      ? row.status
                      : isExcused
                      ? "Excused"
                      : row.absent
                      ? "Absent"
                      : "Present";
                  return (
                    <tr
                      key={`${row.employeeId}-${row.employeeName}-${row.dateISO}-${index}`}
                      className="odd:bg-muted/20"
                    >
                      <td className="p-2">
                        {showTokenTooltip ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="font-mono">{displayEmployeeId}</span>
                            </TooltipTrigger>
                            <TooltipContent sideOffset={6}>
                              Unmatched token (resolve to link to an employee).
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="font-mono">{displayEmployeeId}</span>
                        )}
                      </td>
                      <td className="p-2">{row.employeeName || "—"}</td>
                      <td className="p-2">
                        {row.officeName ||
                          (row.resolvedEmployeeId ? UNASSIGNED_OFFICE_LABEL : UNKNOWN_OFFICE_LABEL)}
                      </td>
                      <td className="p-2">{dateFormatter.format(toDate(row.dateISO))}</td>
                      <td className="p-2">
                        {isExcused ? (
                          <Badge variant="outline" className="bg-muted/60 text-muted-foreground">
                            {statusLabel}
                          </Badge>
                        ) : row.absent ? (
                          <span className="font-semibold text-destructive">{statusLabel}</span>
                        ) : (
                          statusLabel
                        )}
                      </td>
                      <td className="p-2 text-center">{row.earliest ?? ""}</td>
                      <td className="p-2 text-center">{row.latest ?? ""}</td>
                      <td className="p-2 text-center">
                        {isExcused ? (
                          "—"
                        ) : row.absent ? (
                          <span className="font-semibold text-destructive">Absent</span>
                        ) : (
                          row.workedHHMM ?? ""
                        )}
                      </td>
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
                            {statusLabel}
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
      <ManualExclusionDialog
        open={manualDialogOpen}
        onOpenChange={handleManualDialogOpenChange}
        onSubmit={handleManualDialogSubmit}
        initial={manualDialogEditing}
        offices={manualOfficeOptions}
        employees={manualEmployeeOptions}
        activePeriodLabel={manualActivePeriodLabel}
        activePeriod={activePeriod}
      />
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

export default function BioLogUploader() {
  return (
    <SummaryFiltersProvider>
      <BioLogUploaderContent />
    </SummaryFiltersProvider>
  );
}
