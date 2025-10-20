"use client";

<<<<<<< ours
import { useEffect, useState } from "react";

import type { ManualExclusion } from "@/types/autoDtr";
=======
import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { useParams } from "next/navigation";
import type { DayContentProps } from "react-day-picker";

import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { ManualExclusion, ManualExclusionReason } from "@/types/autoDtr";

export type HolidayHint = { date: string; name?: string };
>>>>>>> theirs

export type PeriodStepState = {
  month: number;
  year: number;
<<<<<<< ours
  holidays: string[];
=======
  holidays: HolidayHint[];
>>>>>>> theirs
  manualExclusions: ManualExclusion[];
};

type StepPeriodProps = {
  value: PeriodStepState;
  onChange: (update: Partial<PeriodStepState>) => void;
  onNext: () => void;
};

const MONTH_OPTIONS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

<<<<<<< ours
const storageKeyFor = (year: number, month: number) => `hrps.autoDtr.exclusions.${year}-${String(month).padStart(2, "0")}`;
=======
const storageKeyFor = (year: number, month: number) =>
  `hrps.autoDtr.exclusions.${year}-${String(month).padStart(2, "0")}`;
>>>>>>> theirs

type ManualDraft = Omit<ManualExclusion, "id">;

const createDraft = (): ManualDraft => ({
  dates: [],
  scope: "all",
  reason: "LEAVE",
});

<<<<<<< ours
export default function StepPeriod({ value, onChange, onNext }: StepPeriodProps) {
=======
type OfficeOption = { id: string; name: string };
type EmployeeOption = { id: string; label: string };

const MANUAL_REASON_LABELS: Record<ManualExclusionReason, string> = {
  SUSPENSION: "Suspension",
  OFFICE_CLOSURE: "Office closure",
  CALAMITY: "Calamity",
  TRAINING: "Training",
  LEAVE: "Leave",
  LOCAL_HOLIDAY: "Local holiday",
  OTHER: "Other",
};

const toDateSafe = (iso: string): Date | null => {
  if (typeof iso !== "string" || !iso.trim()) return null;
  try {
    const parsed = parseISO(iso);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch (error) {
    return null;
  }
};

export default function StepPeriod({ value, onChange, onNext }: StepPeriodProps) {
  const params = useParams<{ departmentId?: string }>();
  const rawDepartmentId = params?.departmentId;
  const departmentId =
    typeof rawDepartmentId === "string"
      ? rawDepartmentId
      : Array.isArray(rawDepartmentId)
      ? rawDepartmentId[0] ?? ""
      : "";

>>>>>>> theirs
  const [manualHydratedKey, setManualHydratedKey] = useState<string | null>(null);
  const [manualDraft, setManualDraft] = useState<ManualDraft>(createDraft);
  const [dateInput, setDateInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
<<<<<<< ours
=======
  const [officeOptions, setOfficeOptions] = useState<OfficeOption[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [officePopoverOpen, setOfficePopoverOpen] = useState(false);
  const [employeePopoverOpen, setEmployeePopoverOpen] = useState(false);
  const [loadingOffices, setLoadingOffices] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
>>>>>>> theirs

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = storageKeyFor(value.year, value.month);
    if (manualHydratedKey === key) return;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as ManualExclusion[];
        if (Array.isArray(parsed)) {
          onChange({ manualExclusions: parsed });
        }
      }
    } catch (error) {
      console.warn("Failed to hydrate manual exclusions", error);
    }
    setManualHydratedKey(key);
  }, [manualHydratedKey, onChange, value.month, value.year]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = storageKeyFor(value.year, value.month);
    if (!manualHydratedKey || manualHydratedKey !== key) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value.manualExclusions));
    } catch (error) {
      console.warn("Failed to persist manual exclusions", error);
    }
  }, [manualHydratedKey, value.manualExclusions, value.month, value.year]);

<<<<<<< ours
  const handleAddManual = () => {
    const dates = dateInput
      .split(",")
      .map((token) => token.trim())
      .filter((token) => /^\d{4}-\d{2}-\d{2}$/.test(token));
    if (!dates.length) return;
    const entry: ManualExclusion = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      dates,
      scope: manualDraft.scope,
      officeIds: manualDraft.officeIds,
      employeeIds: manualDraft.employeeIds,
      reason: manualDraft.reason,
      note: noteInput || manualDraft.note,
    };
=======
  useEffect(() => {
    if (!departmentId) return;
    let cancelled = false;
    const loadOffices = async () => {
      setLoadingOffices(true);
      try {
        const response = await fetch(`/api/${departmentId}/offices`);
        if (!response.ok) throw new Error(response.statusText);
        const data = (await response.json()) as unknown;
        if (!Array.isArray(data)) return;
        const options: OfficeOption[] = data
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const id = typeof (item as { id?: unknown }).id === "string" ? (item as { id: string }).id : null;
            const name = typeof (item as { name?: unknown }).name === "string" ? (item as { name: string }).name.trim() : "";
            if (!id) return null;
            return { id, name: name || id } satisfies OfficeOption;
          })
          .filter(Boolean) as OfficeOption[];
        if (!cancelled) {
          setOfficeOptions(options.sort((a, b) => a.name.localeCompare(b.name)));
        }
      } catch (error) {
        console.warn("Failed to load offices", error);
        if (!cancelled) {
          setOfficeOptions([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingOffices(false);
        }
      }
    };
    loadOffices();
    return () => {
      cancelled = true;
    };
  }, [departmentId]);

  useEffect(() => {
    if (!departmentId) return;
    let cancelled = false;
    const loadEmployees = async () => {
      setLoadingEmployees(true);
      try {
        const response = await fetch(`/api/${departmentId}/employees?status=active`);
        if (!response.ok) throw new Error(response.statusText);
        const data = (await response.json()) as unknown;
        if (!Array.isArray(data)) return;
        const options: EmployeeOption[] = data
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const id = typeof (item as { id?: unknown }).id === "string" ? (item as { id: string }).id : null;
            if (!id) return null;
            const firstName = typeof (item as { firstName?: unknown }).firstName === "string"
              ? ((item as { firstName: string }).firstName ?? "").trim()
              : "";
            const lastName = typeof (item as { lastName?: unknown }).lastName === "string"
              ? ((item as { lastName: string }).lastName ?? "").trim()
              : "";
            const employeeNo = typeof (item as { employeeNo?: unknown }).employeeNo === "string"
              ? ((item as { employeeNo: string }).employeeNo ?? "").trim()
              : "";
            const baseName = [lastName, firstName].filter(Boolean).join(", ");
            const fallback = typeof (item as { position?: unknown }).position === "string"
              ? ((item as { position: string }).position ?? "").trim()
              : "";
            const labelBase = baseName || fallback || "Unnamed employee";
            const label = employeeNo ? `${labelBase} (${employeeNo})` : labelBase;
            return { id, label } satisfies EmployeeOption;
          })
          .filter(Boolean) as EmployeeOption[];
        if (!cancelled) {
          setEmployeeOptions(options.sort((a, b) => a.label.localeCompare(b.label)));
        }
      } catch (error) {
        console.warn("Failed to load employees", error);
        if (!cancelled) {
          setEmployeeOptions([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingEmployees(false);
        }
      }
    };
    loadEmployees();
    return () => {
      cancelled = true;
    };
  }, [departmentId]);

  const officeOrderMap = useMemo(
    () => new Map(officeOptions.map((option, index) => [option.id, index])),
    [officeOptions]
  );
  const employeeOrderMap = useMemo(
    () => new Map(employeeOptions.map((option, index) => [option.id, index])),
    [employeeOptions]
  );
  const officeNameMap = useMemo(
    () => new Map(officeOptions.map((option) => [option.id, option.name])),
    [officeOptions]
  );
  const employeeLabelMap = useMemo(
    () => new Map(employeeOptions.map((option) => [option.id, option.label])),
    [employeeOptions]
  );

  const handleScopeChange = useCallback((scope: ManualExclusion["scope"]) => {
    setManualDraft((prev) => ({
      ...prev,
      scope,
      officeIds: scope === "offices" ? prev.officeIds ?? [] : undefined,
      employeeIds: scope === "employees" ? prev.employeeIds ?? [] : undefined,
    }));
  }, []);

  const toggleOffice = useCallback(
    (id: string) => {
      setManualDraft((prev) => {
        if (prev.scope !== "offices") return prev;
        const set = new Set(prev.officeIds ?? []);
        if (set.has(id)) {
          set.delete(id);
        } else {
          set.add(id);
        }
        const ordered = Array.from(set).sort((a, b) => {
          const aIndex = officeOrderMap.get(a) ?? Number.MAX_SAFE_INTEGER;
          const bIndex = officeOrderMap.get(b) ?? Number.MAX_SAFE_INTEGER;
          if (aIndex !== bIndex) return aIndex - bIndex;
          return a.localeCompare(b);
        });
        return { ...prev, officeIds: ordered };
      });
    },
    [officeOrderMap]
  );

  const toggleEmployee = useCallback(
    (id: string) => {
      setManualDraft((prev) => {
        if (prev.scope !== "employees") return prev;
        const set = new Set(prev.employeeIds ?? []);
        if (set.has(id)) {
          set.delete(id);
        } else {
          set.add(id);
        }
        const ordered = Array.from(set).sort((a, b) => {
          const aIndex = employeeOrderMap.get(a) ?? Number.MAX_SAFE_INTEGER;
          const bIndex = employeeOrderMap.get(b) ?? Number.MAX_SAFE_INTEGER;
          if (aIndex !== bIndex) return aIndex - bIndex;
          return a.localeCompare(b);
        });
        return { ...prev, employeeIds: ordered };
      });
    },
    [employeeOrderMap]
  );

  const formatScopeLabel = useCallback(
    (entry: ManualExclusion) => {
      if (entry.scope === "all") return "All employees";
      if (entry.scope === "offices") {
        const ids = entry.officeIds ?? [];
        if (!ids.length) return "Specific offices";
        const labels = ids.map((id) => officeNameMap.get(id) ?? id);
        return `Offices: ${labels.join(", ")}`;
      }
      if (entry.scope === "employees") {
        const ids = entry.employeeIds ?? [];
        if (!ids.length) return "Specific employees";
        const labels = ids.map((id) => employeeLabelMap.get(id) ?? id);
        return `Employees: ${labels.join(", ")}`;
      }
      return "";
    },
    [employeeLabelMap, officeNameMap]
  );

  const formatManualLabel = useCallback(
    (entry: ManualExclusion) => {
      const reasonLabel = MANUAL_REASON_LABELS[entry.reason] ?? entry.reason;
      const note = entry.note?.trim();
      const scopeLabel = formatScopeLabel(entry);
      const segments = [reasonLabel];
      if (note && note.length) {
        segments.push(note);
      }
      const joined = segments.join(" — ");
      return scopeLabel ? (joined ? `${joined} — ${scopeLabel}` : scopeLabel) : joined;
    },
    [formatScopeLabel]
  );

  const manualList = useMemo(
    () =>
      value.manualExclusions.map((entry) => ({
        entry,
        reasonLabel: MANUAL_REASON_LABELS[entry.reason] ?? entry.reason,
        scopeLabel: formatScopeLabel(entry),
        note: entry.note?.trim() ?? "",
        dates: [...entry.dates].sort((a, b) => a.localeCompare(b)),
      })),
    [formatScopeLabel, value.manualExclusions]
  );

  const manualDatesSet = useMemo(() => {
    const set = new Set<string>();
    for (const entry of value.manualExclusions) {
      for (const date of entry.dates) {
        if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
          set.add(date);
        }
      }
    }
    return set;
  }, [value.manualExclusions]);

  const holidayLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const holiday of value.holidays) {
      if (!holiday || typeof holiday.date !== "string") continue;
      const label = holiday.name?.trim()?.length ? holiday.name.trim() : "Holiday";
      map.set(holiday.date, label);
    }
    return map;
  }, [value.holidays]);

  const holidayDates = useMemo(
    () => value.holidays.map((holiday) => holiday.date).filter((date) => typeof date === "string"),
    [value.holidays]
  );

  const manualOnlyDates = useMemo(() => {
    const result: string[] = [];
    for (const date of manualDatesSet) {
      if (!holidayLabelMap.has(date)) {
        result.push(date);
      }
    }
    return result;
  }, [holidayLabelMap, manualDatesSet]);

  const holidayOnlyDates = useMemo(() => {
    const manualDates = new Set(manualDatesSet);
    return holidayDates.filter((date) => !manualDates.has(date));
  }, [holidayDates, manualDatesSet]);

  const manualHolidayDates = useMemo(() => {
    const result: string[] = [];
    for (const date of manualDatesSet) {
      if (holidayLabelMap.has(date)) {
        result.push(date);
      }
    }
    return result;
  }, [holidayLabelMap, manualDatesSet]);

  const manualDateObjects = useMemo(
    () => manualOnlyDates.map((date) => toDateSafe(date)).filter((value): value is Date => value !== null),
    [manualOnlyDates]
  );
  const holidayDateObjects = useMemo(
    () => holidayOnlyDates.map((date) => toDateSafe(date)).filter((value): value is Date => value !== null),
    [holidayOnlyDates]
  );
  const manualHolidayDateObjects = useMemo(
    () => manualHolidayDates.map((date) => toDateSafe(date)).filter((value): value is Date => value !== null),
    [manualHolidayDates]
  );

  const calendarModifiers = useMemo(
    () => ({
      manual: manualDateObjects,
      holiday: holidayDateObjects,
      manualHoliday: manualHolidayDateObjects,
    }),
    [holidayDateObjects, manualDateObjects, manualHolidayDateObjects]
  );

  const calendarMonth = useMemo(() => new Date(value.year, value.month - 1, 1), [value.month, value.year]);

  const manualByDate = useMemo(() => {
    const map = new Map<string, ManualExclusion[]>();
    for (const entry of value.manualExclusions) {
      for (const date of entry.dates) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        const list = map.get(date) ?? [];
        list.push(entry);
        map.set(date, list);
      }
    }
    return map;
  }, [value.manualExclusions]);

  const dayInfoMap = useMemo(() => {
    const map = new Map<string, { holiday?: string; manual: ManualExclusion[] }>();
    for (const [date, entries] of manualByDate.entries()) {
      map.set(date, { manual: entries.slice() });
    }
    for (const [date, label] of holidayLabelMap.entries()) {
      const existing = map.get(date) ?? { manual: [] as ManualExclusion[] };
      existing.holiday = label;
      map.set(date, existing);
    }
    return map;
  }, [holidayLabelMap, manualByDate]);

  const draftSelectedDates = useMemo(() => {
    const tokens = dateInput
      .split(",")
      .map((token) => token.trim())
      .filter((token) => /^\d{4}-\d{2}-\d{2}$/.test(token));
    return tokens
      .map((token) => toDateSafe(token))
      .filter((value): value is Date => value !== null);
  }, [dateInput]);

  const handleCalendarMonthChange = useCallback(
    (month: Date) => {
      onChange({ month: month.getMonth() + 1, year: month.getFullYear() });
    },
    [onChange]
  );

  const handleCalendarDayClick = useCallback(
    (day: Date, modifiers: { outside?: boolean }) => {
      if (modifiers.outside) return;
      const iso = format(day, "yyyy-MM-dd");
      setDateInput((prev) => {
        const tokens = prev
          .split(",")
          .map((token) => token.trim())
          .filter((token) => /^\d{4}-\d{2}-\d{2}$/.test(token));
        const set = new Set(tokens);
        if (set.has(iso)) {
          set.delete(iso);
        } else {
          set.add(iso);
        }
        return Array.from(set)
          .sort((a, b) => a.localeCompare(b))
          .join(", ");
      });
    },
    []
  );

  const renderDayContent = useCallback(
    ({ date, children }: DayContentProps) => {
      const key = format(date, "yyyy-MM-dd");
      const info = dayInfoMap.get(key);
      const content = (
        <div className="relative flex h-full w-full items-center justify-center">
          {children}
          {info?.holiday ? <span className="absolute bottom-1 left-1 h-1.5 w-1.5 rounded-full bg-emerald-500" /> : null}
          {info?.manual?.length ? (
            <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-500" />
          ) : null}
        </div>
      );
      if (!info) {
        return content;
      }
      const manualLabels = info.manual.map((entry, index) => ({ id: `${entry.id}-${index}`, label: formatManualLabel(entry) }));
      return (
        <Tooltip delayDuration={100} key={key}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs space-y-1 text-xs">
            {info.holiday ? <p className="font-medium text-emerald-600">{info.holiday}</p> : null}
            {manualLabels.map((item) => (
              <p key={item.id} className="text-amber-600">
                {item.label}
              </p>
            ))}
          </TooltipContent>
        </Tooltip>
      );
    },
    [dayInfoMap, formatManualLabel]
  );

  const validDateTokens = useMemo(
    () =>
      dateInput
        .split(",")
        .map((token) => token.trim())
        .filter((token) => /^\d{4}-\d{2}-\d{2}$/.test(token)),
    [dateInput]
  );

  const canAddManual =
    validDateTokens.length > 0 &&
    (manualDraft.scope !== "offices" || (manualDraft.officeIds?.length ?? 0) > 0) &&
    (manualDraft.scope !== "employees" || (manualDraft.employeeIds?.length ?? 0) > 0);

  const handleAddManual = () => {
    if (!canAddManual) return;
    const uniqueDates = Array.from(new Set(validDateTokens)).sort((a, b) => a.localeCompare(b));
    const entry: ManualExclusion = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      dates: uniqueDates,
      scope: manualDraft.scope,
      reason: manualDraft.reason,
      note: noteInput.trim().length ? noteInput.trim() : undefined,
    };
    if (manualDraft.scope === "offices") {
      entry.officeIds = Array.from(new Set(manualDraft.officeIds ?? []));
    }
    if (manualDraft.scope === "employees") {
      entry.employeeIds = Array.from(new Set(manualDraft.employeeIds ?? []));
    }
>>>>>>> theirs
    onChange({ manualExclusions: [...value.manualExclusions, entry] });
    setManualDraft(createDraft());
    setDateInput("");
    setNoteInput("");
<<<<<<< ours
=======
    setOfficePopoverOpen(false);
    setEmployeePopoverOpen(false);
>>>>>>> theirs
  };

  const handleRemoveManual = (id: string) => {
    onChange({ manualExclusions: value.manualExclusions.filter((entry) => entry.id !== id) });
  };

<<<<<<< ours
=======
  const selectedOfficeNames = useMemo(
    () => (manualDraft.officeIds ?? []).map((id) => officeNameMap.get(id) ?? id),
    [manualDraft.officeIds, officeNameMap]
  );

  const selectedEmployeeLabels = useMemo(
    () => (manualDraft.employeeIds ?? []).map((id) => employeeLabelMap.get(id) ?? id),
    [employeeLabelMap, manualDraft.employeeIds]
  );

>>>>>>> theirs
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">Month</span>
          <select
            value={value.month}
            onChange={(event) => onChange({ month: Number(event.target.value) })}
            className="rounded-md border px-3 py-2"
          >
            {MONTH_OPTIONS.map((label, index) => (
              <option key={label} value={index + 1}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">Year</span>
          <input
            type="number"
            min={2000}
            max={2100}
            value={value.year}
            onChange={(event) => onChange({ year: Number(event.target.value) })}
            className="rounded-md border px-3 py-2"
          />
        </label>
      </div>

      <div className="rounded-lg border p-4">
<<<<<<< ours
=======
        <div className="flex flex-col gap-2">
          <div>
            <h2 className="text-base font-semibold">Calendar overview</h2>
            <p className="text-xs text-muted-foreground">
              Holidays and manual exclusions for the selected month appear below. Click a date to toggle it in the form.
            </p>
          </div>
          <TooltipProvider>
            <Calendar
              month={calendarMonth}
              onMonthChange={handleCalendarMonthChange}
              selected={draftSelectedDates}
              onDayClick={handleCalendarDayClick}
              modifiers={calendarModifiers}
              modifiersClassNames={{
                manual: "border border-amber-400 bg-amber-50 text-amber-900",
                holiday: "border border-emerald-400 bg-emerald-50 text-emerald-900",
                manualHoliday: "border border-sky-400 bg-sky-50 text-sky-900",
              }}
              components={{ DayContent: renderDayContent }}
            />
          </TooltipProvider>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Holiday
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Manual exclusion
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-sky-500" /> Holiday + manual
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-4">
>>>>>>> theirs
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Manual exclusions</h2>
            <p className="text-xs text-muted-foreground">
<<<<<<< ours
              Excuse dates from DTR computation. Enter dates as comma-separated yyyy-mm-dd values.
=======
              Excuse dates from DTR computation. Toggle days in the calendar or enter them manually below.
>>>>>>> theirs
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-2 text-xs">
            <span className="font-medium uppercase text-muted-foreground">Dates</span>
            <input
              value={dateInput}
              onChange={(event) => setDateInput(event.target.value)}
              placeholder="2024-04-01, 2024-04-02"
              className="rounded-md border px-3 py-2"
            />
<<<<<<< ours
=======
            <span className="text-[10px] text-muted-foreground">
              {validDateTokens.length} selected date{validDateTokens.length === 1 ? "" : "s"}
            </span>
>>>>>>> theirs
          </label>
          <label className="flex flex-col gap-2 text-xs">
            <span className="font-medium uppercase text-muted-foreground">Scope</span>
            <select
              value={manualDraft.scope}
<<<<<<< ours
              onChange={(event) =>
                setManualDraft((prev) => ({
                  ...prev,
                  scope: event.target.value as ManualExclusion["scope"],
                }))
              }
              className="rounded-md border px-3 py-2"
            >
              <option value="all">All employees</option>
              <option value="offices">Offices (IDs)</option>
              <option value="employees">Employees (IDs)</option>
=======
              onChange={(event) => handleScopeChange(event.target.value as ManualExclusion["scope"])}
              className="rounded-md border px-3 py-2"
            >
              <option value="all">All employees</option>
              <option value="offices">Specific offices</option>
              <option value="employees">Specific employees</option>
>>>>>>> theirs
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs">
            <span className="font-medium uppercase text-muted-foreground">Reason</span>
            <select
              value={manualDraft.reason}
              onChange={(event) =>
                setManualDraft((prev) => ({
                  ...prev,
                  reason: event.target.value as ManualExclusion["reason"],
                }))
              }
              className="rounded-md border px-3 py-2"
            >
              <option value="SUSPENSION">Suspension</option>
              <option value="OFFICE_CLOSURE">Office closure</option>
              <option value="CALAMITY">Calamity</option>
              <option value="TRAINING">Training</option>
              <option value="LEAVE">Leave</option>
              <option value="LOCAL_HOLIDAY">Local holiday</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {manualDraft.scope === "offices" ? (
<<<<<<< ours
            <label className="flex flex-col gap-2 text-xs">
              <span className="font-medium uppercase text-muted-foreground">Office IDs</span>
              <input
                value={(manualDraft.officeIds ?? []).join(", ")}
                onChange={(event) =>
                  setManualDraft((prev) => ({
                    ...prev,
                    officeIds: event.target.value
                      .split(",")
                      .map((token) => token.trim())
                      .filter(Boolean),
                  }))
                }
                placeholder="office-1, office-2"
                className="rounded-md border px-3 py-2"
              />
            </label>
          ) : null}

          {manualDraft.scope === "employees" ? (
            <label className="flex flex-col gap-2 text-xs">
              <span className="font-medium uppercase text-muted-foreground">Employee IDs</span>
              <input
                value={(manualDraft.employeeIds ?? []).join(", ")}
                onChange={(event) =>
                  setManualDraft((prev) => ({
                    ...prev,
                    employeeIds: event.target.value
                      .split(",")
                      .map((token) => token.trim())
                      .filter(Boolean),
                  }))
                }
                placeholder="emp-1, emp-2"
                className="rounded-md border px-3 py-2"
              />
            </label>
=======
            <div className="flex flex-col gap-2 text-xs">
              <span className="font-medium uppercase text-muted-foreground">Offices</span>
              <Popover open={officePopoverOpen} onOpenChange={setOfficePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="justify-between">
                    <span>
                      {manualDraft.officeIds?.length
                        ? `${manualDraft.officeIds.length} selected`
                        : loadingOffices
                        ? "Loading offices..."
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
                        {officeOptions.map((office) => {
                          const selected = manualDraft.officeIds?.includes(office.id) ?? false;
                          return (
                            <CommandItem
                              key={office.id}
                              value={office.id}
                              onSelect={(value) => {
                                toggleOffice(value);
                              }}
                              className="flex items-center gap-2"
                            >
                              <Check className={selected ? "h-4 w-4 opacity-100" : "h-4 w-4 opacity-0"} />
                              <span>{office.name}</span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedOfficeNames.length ? (
                <span className="text-[10px] text-muted-foreground">{selectedOfficeNames.join(", ")}</span>
              ) : null}
            </div>
          ) : null}

          {manualDraft.scope === "employees" ? (
            <div className="flex flex-col gap-2 text-xs">
              <span className="font-medium uppercase text-muted-foreground">Employees</span>
              <Popover open={employeePopoverOpen} onOpenChange={setEmployeePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="justify-between">
                    <span>
                      {manualDraft.employeeIds?.length
                        ? `${manualDraft.employeeIds.length} selected`
                        : loadingEmployees
                        ? "Loading employees..."
                        : "Select employees"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search employees" />
                    <CommandList>
                      <CommandEmpty>No employees found.</CommandEmpty>
                      <CommandGroup>
                        {employeeOptions.map((employee) => {
                          const selected = manualDraft.employeeIds?.includes(employee.id) ?? false;
                          return (
                            <CommandItem
                              key={employee.id}
                              value={employee.id}
                              onSelect={(value) => {
                                toggleEmployee(value);
                              }}
                              className="flex items-center gap-2"
                            >
                              <Check className={selected ? "h-4 w-4 opacity-100" : "h-4 w-4 opacity-0"} />
                              <span>{employee.label}</span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedEmployeeLabels.length ? (
                <span className="text-[10px] text-muted-foreground">{selectedEmployeeLabels.join(", ")}</span>
              ) : null}
            </div>
>>>>>>> theirs
          ) : null}

          <label className="flex flex-col gap-2 text-xs">
            <span className="font-medium uppercase text-muted-foreground">Note</span>
            <input
              value={noteInput}
              onChange={(event) => setNoteInput(event.target.value)}
              placeholder="Optional note"
              className="rounded-md border px-3 py-2"
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end">
<<<<<<< ours
          <button
            type="button"
            className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
            onClick={handleAddManual}
            disabled={!dateInput.trim()}
          >
            Add exclusion
          </button>
        </div>

        {value.manualExclusions.length ? (
          <ul className="mt-6 space-y-3">
            {value.manualExclusions.map((entry) => (
              <li key={entry.id} className="rounded-md border bg-muted/40 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{entry.reason}</p>
                    <p className="text-xs text-muted-foreground">{entry.dates.join(", ")}</p>
                    {entry.note ? <p className="text-xs text-muted-foreground">{entry.note}</p> : null}
                  </div>
                  <button
                    type="button"
                    className="text-xs text-destructive"
                    onClick={() => handleRemoveManual(entry.id)}
                  >
                    Remove
                  </button>
=======
          <Button type="button" onClick={handleAddManual} disabled={!canAddManual}>
            Add exclusion
          </Button>
        </div>

        {manualList.length ? (
          <ul className="mt-6 space-y-3">
            {manualList.map(({ entry, reasonLabel, scopeLabel, note, dates }) => (
              <li key={entry.id} className="rounded-md border bg-muted/40 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{reasonLabel}</Badge>
                      <span className="text-xs text-muted-foreground">{dates.join(", ")}</span>
                    </div>
                    {scopeLabel ? (
                      <p className="text-xs text-muted-foreground">{scopeLabel}</p>
                    ) : null}
                    {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => handleRemoveManual(entry.id)}
                  >
                    Remove
                  </Button>
>>>>>>> theirs
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">No manual exclusions added.</p>
        )}
      </div>

      <div className="flex justify-end">
<<<<<<< ours
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          onClick={onNext}
        >
          Continue to uploads
        </button>
=======
        <Button type="button" className="px-4" onClick={onNext}>
          Continue to uploads
        </Button>
>>>>>>> theirs
      </div>
    </div>
  );
}
