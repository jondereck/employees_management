"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, CalendarClock, Ban } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ScheduleExceptionDTO, WorkScheduleDTO } from "@/lib/schedules";
import {
  WEEKLY_EXCLUSION_MODES,
  weekdayNumberToLabel,
  type WeeklyExclusionDTO,
  type WeeklyExclusionMode,
} from "@/lib/weeklyExclusions";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  WEEKDAY_KEYS,
  WEEKDAY_LABELS,
  WEEKLY_PATTERN_HINT,
  hasWeeklyPattern,
  validateWeeklyPatternDay,
} from "@/utils/weeklyPattern";
import type { WeekdayKey, WeeklyPattern, WeeklyPatternDay } from "@/utils/weeklyPattern";
import { CalendarIcon, CalendarX, CheckCircle2, Clock, EditIcon, HelpCircle, Info, Loader2, Pencil, Settings2, ShieldCheck, Trash2, TrashIcon, XIcon } from "lucide-react";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { TimeButtonField } from "./time-button-field";

const ScheduleType = {
  FIXED: "FIXED",
  FLEX: "FLEX",
  SHIFT: "SHIFT",
} as const;

type ScheduleTypeEnum = (typeof ScheduleType)[keyof typeof ScheduleType];

type WeeklyPatternWindowForm = { id: string; start: string; end: string };
type WeeklyPatternDayForm = { windows: WeeklyPatternWindowForm[]; requiredMinutes: number };
type WeeklyPatternFormState = Record<WeekdayKey, WeeklyPatternDayForm>;
type WeeklyPatternErrorState = Record<WeekdayKey, string | null>;

const randomId = () => Math.random().toString(36).slice(2, 10);

const createEmptyWeeklyPatternState = (): WeeklyPatternFormState => {
  const state = {} as WeeklyPatternFormState;
  for (const key of WEEKDAY_KEYS) {
    state[key] = { windows: [], requiredMinutes: 0 };
  }
  return state;
};

const createEmptyWeeklyPatternErrors = (): WeeklyPatternErrorState => {
  const errors = {} as WeeklyPatternErrorState;
  for (const key of WEEKDAY_KEYS) {
    errors[key] = null;
  }
  return errors;
};

const toFormStateFromPattern = (pattern: WeeklyPattern | null | undefined): WeeklyPatternFormState => {
  const state = createEmptyWeeklyPatternState();
  if (!pattern) return state;
  for (const key of WEEKDAY_KEYS) {
    const day = pattern[key];
    if (!day) continue;
    state[key] = {
      windows: day.windows.map((window) => ({
        id: randomId(),
        start: window.start,
        end: window.end,
      })),
      requiredMinutes: day.requiredMinutes,
    };
  }
  return state;
};

const describeWeeklyPatternDay = (day: WeeklyPatternDayForm): string => {
  if (!day.windows.length) return "—";
  const segments = day.windows
    .filter((window) => window.start.trim() && window.end.trim())
    .map((window) => `${window.start.trim()}–${window.end.trim()}`);
  if (!segments.length) return "Incomplete";
  return `${segments.join(", ")} • Req ${day.requiredMinutes || 0}`;
};

const scheduleFormSchema = z
  .object({
    type: z.nativeEnum(ScheduleType),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    graceMinutes: z.coerce.number().int().min(0).max(180).default(0),
    coreStart: z.string().optional(),
    coreEnd: z.string().optional(),
    bandwidthStart: z.string().optional(),
    bandwidthEnd: z.string().optional(),
    requiredDailyMinutes: z.coerce.number().int().min(0).max(1440).default(480),
    shiftStart: z.string().optional(),
    shiftEnd: z.string().optional(),
    breakMinutes: z.coerce.number().int().min(0).max(720).default(60),
    effectiveFrom: z.string().min(1, "Effective from date is required"),
    effectiveTo: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === ScheduleType.FIXED) {
      if (!data.startTime || !data.endTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["startTime"],
          message: "Start and end times are required for fixed schedules",
        });
      }
    }
    if (data.type === ScheduleType.FLEX) {
      const required = [
        "coreStart",
        "coreEnd",
        "bandwidthStart",
        "bandwidthEnd",
      ] as const;
      for (const key of required) {
        if (!data[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: "All flex schedule fields are required",
          });
        }
      }
      if (!data.requiredDailyMinutes) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["requiredDailyMinutes"],
          message: "Required daily minutes is mandatory",
        });
      }
    }
    if (data.type === ScheduleType.SHIFT) {
      if (!data.shiftStart || !data.shiftEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["shiftStart"],
          message: "Shift start and end are required",
        });
      }
    }
  });

type ScheduleFormValues = z.infer<typeof scheduleFormSchema>;

const exceptionFormSchema = z
  .object({
    type: z.nativeEnum(ScheduleType),
    date: z.string().min(1, "Date is required"),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    graceMinutes: z.coerce.number().int().min(0).max(180).default(0),
    coreStart: z.string().optional(),
    coreEnd: z.string().optional(),
    bandwidthStart: z.string().optional(),
    bandwidthEnd: z.string().optional(),
    requiredDailyMinutes: z.coerce.number().int().min(0).max(1440).default(480),
    shiftStart: z.string().optional(),
    shiftEnd: z.string().optional(),
    breakMinutes: z.coerce.number().int().min(0).max(720).default(60),
  })
  .superRefine((data, ctx) => {
    if (data.type === ScheduleType.FIXED) {
      if (!data.startTime || !data.endTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["startTime"],
          message: "Start and end times are required",
        });
      }
    }
    if (data.type === ScheduleType.FLEX) {
      const required = [
        "coreStart",
        "coreEnd",
        "bandwidthStart",
        "bandwidthEnd",
      ] as const;
      for (const key of required) {
        if (!data[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: "All flex fields are required",
          });
        }
      }
      if (!data.requiredDailyMinutes) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["requiredDailyMinutes"],
          message: "Required daily minutes is mandatory",
        });
      }
    }
    if (data.type === ScheduleType.SHIFT) {
      if (!data.shiftStart || !data.shiftEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["shiftStart"],
          message: "Shift start and end are required",
        });
      }
    }
  });

type ExceptionFormValues = z.infer<typeof exceptionFormSchema>;

const WeeklyExclusionModeSchema = z.enum(["EXCUSED", "IGNORE_LATE_UNTIL"] as const);

type WeeklyExclusionModeEnum = z.infer<typeof WeeklyExclusionModeSchema>;

const weeklyExclusionFormSchema = z
  .object({
    weekdays: z
      .array(z.number().int().min(1).max(7))
      .min(1, "Select at least one weekday"),
    mode: WeeklyExclusionModeSchema,
    ignoreUntil: z.string().optional(),
    effectiveFrom: z.string().min(1, "Effective from date is required"),
    effectiveTo: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const trimmedIgnore = data.ignoreUntil?.trim() ?? "";
    if (data.mode === "IGNORE_LATE_UNTIL") {
      if (!trimmedIgnore || !HHMM_REGEX.test(trimmedIgnore)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ignoreUntil"],
          message: "Enter time as HH:MM (e.g., 08:30)",
        });
      }
    }
    if (data.effectiveTo && data.effectiveTo < data.effectiveFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["effectiveTo"],
        message: "Effective to must be on or after effective from",
      });
    }
  });

type WeeklyExclusionFormValues = z.infer<typeof weeklyExclusionFormSchema>;

const scheduleDefaults: ScheduleFormValues = {
  type: ScheduleType.FIXED,
  startTime: "08:00",
  endTime: "17:00",
  graceMinutes: 0,
  coreStart: "10:00",
  coreEnd: "15:00",
  bandwidthStart: "06:00",
  bandwidthEnd: "20:00",
  requiredDailyMinutes: 480,
  shiftStart: "22:00",
  shiftEnd: "06:00",
  breakMinutes: 60,
  effectiveFrom: "",
  effectiveTo: "",
};

const exceptionDefaults: ExceptionFormValues = {
  type: ScheduleType.FIXED,
  date: "",
  startTime: "08:00",
  endTime: "17:00",
  graceMinutes: 0,
  coreStart: "10:00",
  coreEnd: "15:00",
  bandwidthStart: "06:00",
  bandwidthEnd: "20:00",
  requiredDailyMinutes: 480,
  shiftStart: "22:00",
  shiftEnd: "06:00",
  breakMinutes: 60,
};

const weeklyExclusionDefaults: WeeklyExclusionFormValues = {
  weekdays: [],
  mode: "EXCUSED",
  ignoreUntil: "",
  effectiveFrom: "",
  effectiveTo: "",
};

const scheduleTypes = Object.values(ScheduleType) as ScheduleTypeEnum[];

const formatTypeLabel = (type: ScheduleTypeEnum) =>
  type.charAt(0) + type.slice(1).toLowerCase();

const toDateInput = (value: string | null | undefined) =>
  value ? value.slice(0, 10) : "";

const describeSchedule = (schedule: WorkScheduleDTO) => {
  switch (schedule.type) {
    case ScheduleType.FLEX:
      {
        const base = `Core ${schedule.coreStart ?? "—"}–${schedule.coreEnd ?? "—"}, Band ${schedule.bandwidthStart ?? "—"}–${schedule.bandwidthEnd ?? "—"}, Required ${schedule.requiredDailyMinutes ?? 0}m`;
        return hasWeeklyPattern(schedule.weeklyPattern)
          ? `${base} • Weekly pattern`
          : base;
      }
    case ScheduleType.SHIFT:
      return `Shift ${schedule.shiftStart ?? "—"}–${schedule.shiftEnd ?? "—"} (grace ${schedule.graceMinutes ?? 0}m)`;
    case ScheduleType.FIXED:
    default:
      return `${schedule.startTime ?? "—"}–${schedule.endTime ?? "—"} (grace ${schedule.graceMinutes ?? 0}m)`;
  }
};

const describeException = (exception: ScheduleExceptionDTO) => {
  switch (exception.type) {
    case ScheduleType.FLEX:
      return `Core ${exception.coreStart ?? "—"}–${exception.coreEnd ?? "—"}, Band ${exception.bandwidthStart ?? "—"}–${exception.bandwidthEnd ?? "—"}, Required ${exception.requiredDailyMinutes ?? 0}m`;
    case ScheduleType.SHIFT:
      return `Shift ${exception.shiftStart ?? "—"}–${exception.shiftEnd ?? "—"} (grace ${exception.graceMinutes ?? 0}m)`;
    case ScheduleType.FIXED:
    default:
      return `${exception.startTime ?? "—"}–${exception.endTime ?? "—"} (grace ${exception.graceMinutes ?? 0}m)`;
  }
};

const BANDWIDTH_START_HELP = "Earliest time counted as presence in a flexible day.";
const BANDWIDTH_END_HELP = "Latest time counted as presence in a flexible day.";
const CORE_START_HELP =
  "Late if earliest punch > Core Start + Grace. Arrivals before core are on time.";
const CORE_END_HELP = "If set, you must stay at least until this time.";
const REQUIRED_MINUTES_HELP = "Minimum total minutes to avoid undertime (e.g., 720 = 12h).";
const SHIFT_TIMING_HELP = "Late if first punch > Start (+grace). Undertime if last punch < End.";

type InfoLabelProps = {
  label: string;
  tooltip: string;
};

const InfoLabel = ({ label, tooltip }: InfoLabelProps) => (
  <div className="flex items-center gap-2">
    <FormLabel className="mb-0">{label}</FormLabel>
    <TooltipProvider delayDuration={50}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="h-5 w-5 grid place-items-center rounded border border-input bg-muted/40 text-[10px] font-semibold uppercase text-muted-foreground transition-colors hover:bg-muted"
            aria-label={tooltip}
          >
            i
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-[260px] text-sm">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
);

const sortByDateDesc = <T extends { effectiveFrom?: string; date?: string }>(items: T[]): T[] => {
  return [...items].sort((a, b) => {
    const aDate = a.effectiveFrom ?? a.date ?? "";
    const bDate = b.effectiveFrom ?? b.date ?? "";
    return bDate.localeCompare(aDate);
  });
};

const sortWeeklyExclusions = (items: WeeklyExclusionDTO[]): WeeklyExclusionDTO[] => {
  return [...items].sort((a, b) => {
    const aFrom = a.effectiveFrom ?? "";
    const bFrom = b.effectiveFrom ?? "";
    if (aFrom !== bFrom) {
      return bFrom.localeCompare(aFrom);
    }
    const aTo = a.effectiveTo ?? "9999-12-31T23:59:59.999Z";
    const bTo = b.effectiveTo ?? "9999-12-31T23:59:59.999Z";
    if (aTo !== bTo) {
      return bTo.localeCompare(aTo);
    }
    if (a.weekday !== b.weekday) {
      return a.weekday - b.weekday;
    }
    return a.mode.localeCompare(b.mode);
  });
};

const WEEKDAY_NUMBERS = [1, 2, 3, 4, 5, 6, 7] as const;
const WEEKDAY_LONG_LABELS: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

const WEEKLY_EXCLUSION_MODE_LABELS: Record<WeeklyExclusionMode, string> = {
  EXCUSED: "Excused (skip Late/UT)",
  IGNORE_LATE_UNTIL: "Ignore lateness until",
};

const WEEKLY_EXCLUSION_MODE_DESCRIPTIONS: Record<WeeklyExclusionMode, string> = {
  EXCUSED: "Days are excluded from Late/UT and Days counts. Punches remain visible.",
  IGNORE_LATE_UNTIL: "Late is suppressed until the specified time. Undertime still applies.",
};

const WEEKLY_EXCLUSION_HELP_TEXT =
  "Excused days are excluded from Late/UT and the Days count. Punches remain visible in Per-Day details.";

const HHMM_REGEX = /^\d{1,2}:\d{2}$/;

type Props = {
  employeeId: string;
  schedules: WorkScheduleDTO[];
  exceptions: ScheduleExceptionDTO[];
  weeklyExclusions: WeeklyExclusionDTO[];
};

export function EmployeeScheduleManager({
  employeeId,
  schedules,
  exceptions,
  weeklyExclusions,
}: Props) {
  const [scheduleList, setScheduleList] = useState<WorkScheduleDTO[]>(() => sortByDateDesc(schedules));
  const [exceptionList, setExceptionList] = useState<ScheduleExceptionDTO[]>(() => sortByDateDesc(exceptions));
  const [editingSchedule, setEditingSchedule] = useState<WorkScheduleDTO | null>(null);
  const [editingException, setEditingException] = useState<ScheduleExceptionDTO | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [savingException, setSavingException] = useState(false);
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null);
  const [weeklyExclusionList, setWeeklyExclusionList] = useState<WeeklyExclusionDTO[]>(() =>
    sortWeeklyExclusions(weeklyExclusions)
  );
  const [editingWeeklyExclusion, setEditingWeeklyExclusion] = useState<WeeklyExclusionDTO | null>(null);
  const [savingWeeklyExclusion, setSavingWeeklyExclusion] = useState(false);
  const [deletingWeeklyExclusionId, setDeletingWeeklyExclusionId] = useState<string | null>(null);
  const [weeklyPattern, setWeeklyPattern] = useState<WeeklyPatternFormState>(() => createEmptyWeeklyPatternState());
  const [weeklyPatternErrors, setWeeklyPatternErrors] = useState<WeeklyPatternErrorState>(() =>
    createEmptyWeeklyPatternErrors()
  );
  const [weeklyPatternOpen, setWeeklyPatternOpen] = useState(false);
  const [weeklyPatternAutoOpenDisabled, setWeeklyPatternAutoOpenDisabled] = useState(false);

  const handleAddWeeklyWindow = useCallback((day: WeekdayKey) => {
    setWeeklyPattern((prev) => {
      const current = prev[day];
      if (current.windows.length >= 3) return prev;
      const nextDay: WeeklyPatternDayForm = {
        ...current,
        windows: [...current.windows, { id: randomId(), start: "", end: "" }],
      };
      return { ...prev, [day]: nextDay };
    });
    setWeeklyPatternErrors((prev) => ({ ...prev, [day]: null }));
  }, []);

  const handleRemoveWeeklyWindow = useCallback((day: WeekdayKey, windowId: string) => {
    setWeeklyPattern((prev) => {
      const current = prev[day];
      const nextDay: WeeklyPatternDayForm = {
        ...current,
        windows: current.windows.filter((window) => window.id !== windowId),
      };
      return { ...prev, [day]: nextDay };
    });
    setWeeklyPatternErrors((prev) => ({ ...prev, [day]: null }));
  }, []);

  const handleWeeklyWindowChange = useCallback(
    (day: WeekdayKey, windowId: string, field: "start" | "end", value: string) => {
      setWeeklyPattern((prev) => {
        const current = prev[day];
        const nextDay: WeeklyPatternDayForm = {
          ...current,
          windows: current.windows.map((window) =>
            window.id === windowId ? { ...window, [field]: value } : window
          ),
        };
        return { ...prev, [day]: nextDay };
      });
      setWeeklyPatternErrors((prev) => ({ ...prev, [day]: null }));
    },
    []
  );

  const handleClearWeeklyDay = useCallback((day: WeekdayKey) => {
    setWeeklyPattern((prev) => ({
      ...prev,
      [day]: { windows: [], requiredMinutes: 0 },
    }));
    setWeeklyPatternErrors((prev) => ({ ...prev, [day]: null }));
  }, []);

  const handleWeeklyRequiredChange = useCallback((day: WeekdayKey, value: string) => {
    const parsed = Number(value);
    setWeeklyPattern((prev) => {
      const current = prev[day];
      const nextDay: WeeklyPatternDayForm = {
        ...current,
        requiredMinutes: Number.isFinite(parsed) ? Math.min(1440, Math.max(0, Math.round(parsed))) : 0,
      };
      return { ...prev, [day]: nextDay };
    });
    setWeeklyPatternErrors((prev) => ({ ...prev, [day]: null }));
  }, []);

  const handleToggleWeeklyPattern = useCallback(() => {
    setWeeklyPatternAutoOpenDisabled(true);
    setWeeklyPatternOpen((prev) => !prev);
  }, []);

  const buildWeeklyPatternSubmission = useCallback(() => {
    const errors = createEmptyWeeklyPatternErrors();
    const pattern: WeeklyPattern = {};
    let hasError = false;

    for (const key of WEEKDAY_KEYS) {
      const dayState = weeklyPattern[key];
      const trimmedWindows = dayState.windows.map((window) => ({
        start: window.start.trim(),
        end: window.end.trim(),
      }));
      const requiredMinutes = Number.isFinite(dayState.requiredMinutes)
        ? Math.min(1440, Math.max(0, Math.round(dayState.requiredMinutes)))
        : 0;

      if (!trimmedWindows.length && requiredMinutes <= 0) {
        errors[key] = null;
        continue;
      }

      const dayValue: WeeklyPatternDay = {
        windows: trimmedWindows as WeeklyPatternDay["windows"],
        requiredMinutes,
      };

      const error = validateWeeklyPatternDay(dayValue);
      if (error) {
        errors[key] = error;
        hasError = true;
        continue;
      }

      const validWindows = trimmedWindows.filter((window) => window.start && window.end);
      if (!validWindows.length) {
        errors[key] = null;
        continue;
      }

      errors[key] = null;
      pattern[key] = {
        windows: validWindows as WeeklyPatternDay["windows"],
        requiredMinutes,
      };
    }

    return { pattern: Object.keys(pattern).length ? pattern : null, errors, hasError };
  }, [weeklyPattern]);

  const scheduleForm = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: scheduleDefaults,
  });

  const exceptionForm = useForm<ExceptionFormValues>({
    resolver: zodResolver(exceptionFormSchema),
    defaultValues: exceptionDefaults,
  });

  const weeklyExclusionForm = useForm<WeeklyExclusionFormValues>({
    resolver: zodResolver(weeklyExclusionFormSchema),
    defaultValues: weeklyExclusionDefaults,
  });

  const scheduleType = scheduleForm.watch("type");
  const exceptionType = exceptionForm.watch("type");
  const weeklyExclusionMode = weeklyExclusionForm.watch("mode");
  const isEditingWeeklyExclusion = Boolean(editingWeeklyExclusion);

  const hasWeeklyPatternConfigured = useMemo(() => {
    return WEEKDAY_KEYS.some((key) => {
      const day = weeklyPattern[key];
      if (!day) return false;
      if (day.windows.some((window) => window.start.trim() || window.end.trim())) {
        return true;
      }
      return day.requiredMinutes > 0;
    });
  }, [weeklyPattern]);

  useEffect(() => {
    if (
      scheduleType === ScheduleType.FLEX &&
      !weeklyPatternOpen &&
      !hasWeeklyPatternConfigured &&
      !weeklyPatternAutoOpenDisabled
    ) {
      setWeeklyPatternOpen(true);
      setWeeklyPatternAutoOpenDisabled(true);
    }
  }, [
    scheduleType,
    weeklyPatternOpen,
    hasWeeklyPatternConfigured,
    weeklyPatternAutoOpenDisabled,
  ]);

  const resetScheduleForm = useCallback(() => {
    setEditingSchedule(null);
    scheduleForm.reset(scheduleDefaults);
    setWeeklyPattern(createEmptyWeeklyPatternState());
    setWeeklyPatternErrors(createEmptyWeeklyPatternErrors());
    setWeeklyPatternOpen(false);
    setWeeklyPatternAutoOpenDisabled(false);
  }, [scheduleForm]);

  const resetExceptionForm = useCallback(() => {
    setEditingException(null);
    exceptionForm.reset(exceptionDefaults);
  }, [exceptionForm]);

  const resetWeeklyExclusionForm = useCallback(() => {
    setEditingWeeklyExclusion(null);
    weeklyExclusionForm.reset(weeklyExclusionDefaults);
  }, [weeklyExclusionForm]);

  const onSubmitSchedule = scheduleForm.handleSubmit(async (values) => {
    const usingWeeklyPattern = values.type === ScheduleType.FLEX;
    const submission = usingWeeklyPattern
      ? buildWeeklyPatternSubmission()
      : { pattern: null, errors: createEmptyWeeklyPatternErrors(), hasError: false };

    setWeeklyPatternErrors(submission.errors);
    if (usingWeeklyPattern && submission.hasError) {
      setWeeklyPatternOpen(true);
      toast.error("Resolve weekly pattern errors before saving.");
      return;
    }

    try {
      setSavingSchedule(true);
      const payload = {
        ...values,
        effectiveTo: values.effectiveTo ? values.effectiveTo : null,
        weeklyPattern: usingWeeklyPattern ? submission.pattern : null,
      };
      const endpoint = editingSchedule
        ? `/api/employee/${employeeId}/work-schedules/${editingSchedule.id}`
        : `/api/schedules`;
      const method = editingSchedule ? "PATCH" : "POST";
      const bodyPayload = editingSchedule ? payload : { ...payload, employeeId };
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Unable to save schedule");
      }
      const data = body as WorkScheduleDTO;
      setScheduleList((prev) =>
        sortByDateDesc(
          editingSchedule
            ? prev.map((item) => (item.id === data.id ? data : item))
            : [data, ...prev]
        )
      );
      toast.success(editingSchedule ? "Schedule updated" : "Schedule added");
      resetScheduleForm();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Unable to save schedule");
    } finally {
      setSavingSchedule(false);
    }
  });

  const handleScheduleFormSubmit = useCallback(
    (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      event?.stopPropagation();
      void onSubmitSchedule();
    },
    [onSubmitSchedule]
  );

  const handleScheduleButtonClick = useCallback(() => {
    void onSubmitSchedule();
  }, [onSubmitSchedule]);

  const onSubmitException = exceptionForm.handleSubmit(async (values) => {
    try {
      setSavingException(true);
      const response = await fetch(
        editingException
          ? `/api/employee/${employeeId}/schedule-exceptions/${editingException.id}`
          : `/api/employee/${employeeId}/schedule-exceptions`,
        {
          method: editingException ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Unable to save schedule exception");
      }
      const data = body as ScheduleExceptionDTO;
      setExceptionList((prev) =>
        sortByDateDesc(
          editingException
            ? prev.map((item) => (item.id === data.id ? data : item))
            : [data, ...prev]
        )
      );
      toast.success(editingException ? "Exception updated" : "Exception added");
      resetExceptionForm();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Unable to save schedule exception");
    } finally {
      setSavingException(false);
    }
  });

  const onSubmitWeeklyExclusion = weeklyExclusionForm.handleSubmit(async (values) => {
    try {
      setSavingWeeklyExclusion(true);
      const trimmedIgnore = values.ignoreUntil?.trim() ?? "";
      const basePayload = {
        effectiveFrom: values.effectiveFrom,
        effectiveTo: values.effectiveTo ? values.effectiveTo : null,
        mode: values.mode,
        ignoreUntil:
          values.mode === "IGNORE_LATE_UNTIL" ? (trimmedIgnore ? trimmedIgnore : null) : null,
      };

      if (editingWeeklyExclusion) {
        const payload = {
          ...basePayload,
          weekday: values.weekdays[0],
        };
        const response = await fetch(
          `/api/employee/${employeeId}/weekly-exclusions/${editingWeeklyExclusion.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(body?.error ?? "Unable to save weekly exclusion");
        }
        const data = body as WeeklyExclusionDTO;
        setWeeklyExclusionList((prev) =>
          sortWeeklyExclusions(prev.map((item) => (item.id === data.id ? data : item)))
        );
        toast.success("Weekly exclusion updated");
        resetWeeklyExclusionForm();
        return;
      }

      const created: WeeklyExclusionDTO[] = [];
      for (const weekday of values.weekdays) {
        const response = await fetch(`/api/employee/${employeeId}/weekly-exclusions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...basePayload, weekday }),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(body?.error ?? "Unable to save weekly exclusion");
        }
        created.push(body as WeeklyExclusionDTO);
      }
      if (created.length) {
        setWeeklyExclusionList((prev) => sortWeeklyExclusions([...created, ...prev]));
        toast.success(
          created.length > 1
            ? `${created.length} weekly exclusions added`
            : "Weekly exclusion added"
        );
        resetWeeklyExclusionForm();
      }
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Unable to save weekly exclusion");
    } finally {
      setSavingWeeklyExclusion(false);
    }
  });

  const handleWeeklyExclusionFormSubmit = useCallback(
    (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      event?.stopPropagation();
      void onSubmitWeeklyExclusion();
    },
    [onSubmitWeeklyExclusion]
  );

  const handleWeeklyExclusionButtonClick = useCallback(() => {
    void onSubmitWeeklyExclusion();
  }, [onSubmitWeeklyExclusion]);

  const handleEditSchedule = useCallback(
    (schedule: WorkScheduleDTO) => {
      setEditingSchedule(schedule);
      scheduleForm.reset({
        type: schedule.type,
        startTime: schedule.startTime ?? "",
        endTime: schedule.endTime ?? "",
        graceMinutes: schedule.graceMinutes ?? 0,
        coreStart: schedule.coreStart ?? "",
        coreEnd: schedule.coreEnd ?? "",
        bandwidthStart: schedule.bandwidthStart ?? "",
        bandwidthEnd: schedule.bandwidthEnd ?? "",
        requiredDailyMinutes: schedule.requiredDailyMinutes ?? 480,
        shiftStart: schedule.shiftStart ?? "",
        shiftEnd: schedule.shiftEnd ?? "",
        breakMinutes: schedule.breakMinutes ?? 60,
        effectiveFrom: toDateInput(schedule.effectiveFrom),
        effectiveTo: toDateInput(schedule.effectiveTo),
      });
      setWeeklyPattern(toFormStateFromPattern(schedule.weeklyPattern ?? null));
      setWeeklyPatternErrors(createEmptyWeeklyPatternErrors());
      setWeeklyPatternOpen(hasWeeklyPattern(schedule.weeklyPattern));
      setWeeklyPatternAutoOpenDisabled(hasWeeklyPattern(schedule.weeklyPattern));
    },
    [scheduleForm]
  );

  const handleEditException = useCallback(
    (exception: ScheduleExceptionDTO) => {
      setEditingException(exception);
      exceptionForm.reset({
        type: exception.type,
        date: toDateInput(exception.date),
        startTime: exception.startTime ?? "",
        endTime: exception.endTime ?? "",
        graceMinutes: exception.graceMinutes ?? 0,
        coreStart: exception.coreStart ?? "",
        coreEnd: exception.coreEnd ?? "",
        bandwidthStart: exception.bandwidthStart ?? "",
        bandwidthEnd: exception.bandwidthEnd ?? "",
        requiredDailyMinutes: exception.requiredDailyMinutes ?? 480,
        shiftStart: exception.shiftStart ?? "",
        shiftEnd: exception.shiftEnd ?? "",
        breakMinutes: exception.breakMinutes ?? 60,
      });
    },
    [exceptionForm]
  );

  const handleDeleteSchedule = useCallback(
    async (schedule: WorkScheduleDTO) => {
      if (!confirm("Remove this work schedule?")) return;
      setDeletingScheduleId(schedule.id);
      try {
        const response = await fetch(`/api/schedules/${schedule.id}`, {
          method: "DELETE",
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(body?.error ?? "Unable to delete schedule");
        }
        setScheduleList((prev) => prev.filter((item) => item.id !== schedule.id));
        toast.success("Schedule removed");
        if (editingSchedule?.id === schedule.id) {
          resetScheduleForm();
        }
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "Unable to delete schedule");
      } finally {
        setDeletingScheduleId(null);
      }
    },
    [editingSchedule, resetScheduleForm]
  );

  

  const handleDeleteException = useCallback(
    async (exception: ScheduleExceptionDTO) => {
      if (!confirm("Remove this exception?")) return;
      try {
        const response = await fetch(
          `/api/employee/${employeeId}/schedule-exceptions/${exception.id}`,
          { method: "DELETE" }
        );
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(body?.error ?? "Unable to delete schedule exception");
        }
        setExceptionList((prev) => prev.filter((item) => item.id !== exception.id));
        toast.success("Exception removed");
        if (editingException?.id === exception.id) {
          resetExceptionForm();
        }
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "Unable to delete schedule exception");
      }
    },
    [editingException, employeeId, resetExceptionForm]
  );

  const handleEditWeeklyExclusion = useCallback(
    (exclusion: WeeklyExclusionDTO) => {
      setEditingWeeklyExclusion(exclusion);
      weeklyExclusionForm.reset({
        weekdays: [exclusion.weekday],
        mode: exclusion.mode,
        ignoreUntil: exclusion.ignoreUntil ?? "",
        effectiveFrom: toDateInput(exclusion.effectiveFrom),
        effectiveTo: toDateInput(exclusion.effectiveTo),
      });
    },
    [weeklyExclusionForm]
  );

  const handleDeleteWeeklyExclusion = useCallback(
    async (exclusion: WeeklyExclusionDTO) => {
      if (!confirm("Remove this weekly exclusion?")) return;
      try {
        setDeletingWeeklyExclusionId(exclusion.id);
        const response = await fetch(
          `/api/employee/${employeeId}/weekly-exclusions/${exclusion.id}`,
          { method: "DELETE" }
        );
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(body?.error ?? "Unable to delete weekly exclusion");
        }
        setWeeklyExclusionList((prev) => prev.filter((item) => item.id !== exclusion.id));
        toast.success("Weekly exclusion removed");
        if (editingWeeklyExclusion?.id === exclusion.id) {
          resetWeeklyExclusionForm();
        }
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "Unable to delete weekly exclusion");
      } finally {
        setDeletingWeeklyExclusionId(null);
      }
    },
    [editingWeeklyExclusion, employeeId, resetWeeklyExclusionForm]
  );

  const scheduleRows = useMemo(() => sortByDateDesc(scheduleList), [scheduleList]);
  const exceptionRows = useMemo(() => sortByDateDesc(exceptionList), [exceptionList]);
  const weeklyExclusionRows = useMemo(
    () => sortWeeklyExclusions(weeklyExclusionList),
    [weeklyExclusionList]
  );


  return (
    <div className="mt-10 space-y-8">

      <Tabs defaultValue="recurring" className="w-full">
    <TabsList className="grid w-full grid-cols-3 h-14 bg-slate-100/50 p-1 rounded-xl">
      <TabsTrigger value="recurring" className="gap-2 rounded-lg data-[state=active]:shadow-sm">
        <CalendarClock className="h-4 w-4" />
        <span className="font-bold">Recurring Schedules</span>
        <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] bg-slate-200">
          {scheduleList.length}
        </Badge>
      </TabsTrigger>
      
      <TabsTrigger value="exclusions" className="gap-2 rounded-lg data-[state=active]:shadow-sm">
        <Ban className="h-4 w-4" />
        <span className="font-bold">Weekly Exclusions</span>
        <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] bg-slate-200">
          {weeklyExclusionList.length}
        </Badge>
      </TabsTrigger>
      
      <TabsTrigger value="exceptions" className="gap-2 rounded-lg data-[state=active]:shadow-sm">
        <CalendarDays className="h-4 w-4" />
        <span className="font-bold">One-day Exceptions</span>
        <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] bg-slate-200">
          {exceptionList.length}
        </Badge>
      </TabsTrigger>
    </TabsList>
    
{/* RECURRING WORK SCHEDULES*/}

<TabsContent value="recurring" className="mt-6 animate-in fade-in-50 duration-300">
        <section className="space-y-6">

{/* Header Section */}
<div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-4">
  <div className="space-y-1">
    <div className="flex items-center gap-2">
      <h3 className="text-lg font-bold tracking-tight text-slate-800">
        Recurring Work Schedules
      </h3>
      <ActionTooltip 
        label="How do schedules work?" 
        description="Define base schedules per period. Overlaps are automatically resolved by the latest effective date." 
        side="right"
      >
        <HelpCircle className="h-4 w-4 text-slate-400 cursor-help" />
      </ActionTooltip>
    </div>
    <p className="text-sm text-muted-foreground max-w-2xl">
      Define base work hours and timing rules. Overlaps are resolved by the latest effective date.
    </p>
  </div>
</div>
  {/* Form Editor Card */}
  <div className={`rounded-xl border shadow-sm transition-all ${editingSchedule ? 'ring-2 ring-blue-500/20 border-blue-200 bg-blue-50/10' : 'bg-white'}`}>
    <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
      <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {editingSchedule ? "Modifying Schedule" : "Add New Schedule"}
      </span>
      {editingSchedule && (
        <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">Editing Mode</Badge>
      )}
    </div>

    <Form {...scheduleForm}>
      <form onSubmit={handleScheduleFormSubmit} className="p-6 space-y-8">
        {/* Basic Config Group */}
        <div className="grid gap-6 md:grid-cols-2">
          <FormField
            control={scheduleForm.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-bold">Schedule Type</FormLabel>
                <Select value={field.value} onValueChange={(value) => field.onChange(value as ScheduleTypeEnum)}>
                  <FormControl>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {scheduleTypes.map((type) => (
                      <SelectItem key={type} value={type}>{formatTypeLabel(type)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={scheduleForm.control}
            name="breakMinutes"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-bold">Paid Break (min)</FormLabel>
                <FormControl>
                  <Input type="number" className="bg-white" value={field.value ?? 60} onChange={(e) => field.onChange(e.target.valueAsNumber)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Dynamic Fields Container - SEE PART 2 BELOW */}
        {/* ... */}

     {(scheduleType === ScheduleType.FIXED || scheduleType === ScheduleType.SHIFT || scheduleType === ScheduleType.FLEX) && (
          <div className="p-6 rounded-xl bg-slate-50/50 border border-slate-200 space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
              <div className="h-4 w-1 bg-indigo-500 rounded-full" />
              <h4 className="text-xs font-bold uppercase text-slate-600 tracking-wider">
                Timing Configuration
              </h4>
            </div>

            {/* FIXED & SHIFT Start/End */}
            {(scheduleType === ScheduleType.FIXED || scheduleType === ScheduleType.SHIFT) && (
              <div className="grid gap-6 md:grid-cols-3">
                <FormField
                  control={scheduleForm.control}
                  name={scheduleType === ScheduleType.FIXED ? "startTime" : "shiftStart"}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase text-slate-500">
                        {scheduleType === ScheduleType.FIXED ? "Standard Start" : "Shift Start"}
                      </FormLabel>
                      <Input
                        type="time"
                        className="bg-white shadow-sm font-mono tabular-nums focus-visible:ring-indigo-500"
                        {...field}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={scheduleForm.control}
                  name={scheduleType === ScheduleType.FIXED ? "endTime" : "shiftEnd"}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase text-slate-500">
                        {scheduleType === ScheduleType.FIXED ? "Standard End" : "Shift End"}
                      </FormLabel>
                      <Input
                        type="time"
                        className="bg-white shadow-sm font-mono tabular-nums focus-visible:ring-indigo-500"
                        {...field}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* FLEX Rules */}
            {scheduleType === ScheduleType.FLEX && (
              <div className="space-y-6">
                <div className="grid gap-6 p-5 rounded-xl border border-indigo-100 bg-indigo-50/30 shadow-sm md:grid-cols-3">
                  {/* Required Mins, Bandwidth Start/End with type="time" */}
                  <FormField
                    control={scheduleForm.control}
                    name="bandwidthStart"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase text-slate-500">Earliest Start</FormLabel>
                        <Input type="time" className="bg-white border-indigo-200 font-mono" {...field} />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={scheduleForm.control}
                    name="bandwidthEnd"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase text-slate-500">Latest End</FormLabel>
                        <Input type="time" className="bg-white border-indigo-200 font-mono" {...field} />
                      </FormItem>
                    )}
                  />
                </div>

        {/* 2. Weekly Pattern Interface */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="flex items-center justify-between p-4 border-b bg-slate-50/80">
            <div className="space-y-0.5">
              <h4 className="text-sm font-bold text-slate-800 tracking-tight">Weekly Breakdown</h4>
              <p className="text-[11px] text-slate-500 font-medium">Define specific core windows or targets per day</p>
            </div>
            <Button
              type="button"
              variant={weeklyPatternOpen ? "ghost" : "outline"}
              size="sm"
              onClick={handleToggleWeeklyPattern}
              className={`h-8 text-xs font-bold transition-all ${weeklyPatternOpen ? 'text-rose-500 hover:text-rose-600 hover:bg-rose-50' : 'text-indigo-600 border-indigo-200'}`}
            >
              {weeklyPatternOpen ? "Close Editor" : "Configure Days"}
            </Button>
          </div>

          <div className="p-4">
            {/* Day Picker Summaries */}
            <div className="flex items-center gap-2 mb-4">
              {WEEKDAY_KEYS.map((key) => {
                const isActive = weeklyPattern[key].windows.length > 0 || (weeklyPattern[key].requiredMinutes > 0);
                return (
                  <div
                    key={key}
                    className={`flex flex-col h-12 w-12 items-center justify-center rounded-lg border text-[11px] font-bold transition-all
                      ${isActive 
                        ? 'bg-indigo-600 border-indigo-700 text-white shadow-md shadow-indigo-100' 
                        : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                  >
                    <span>{WEEKDAY_LABELS[key].substring(0, 3)}</span>
                  </div>
                );
              })}
            </div>

            {/* Expanded Day-by-Day Editor */}
            {weeklyPatternOpen && (
              <div className="space-y-2 mt-4 animate-in slide-in-from-top-2 duration-300">
                {WEEKDAY_KEYS.map((key) => (
                  <div key={key} className="group flex flex-col md:flex-row md:items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/40 p-3 hover:bg-white hover:border-indigo-200 hover:shadow-md transition-all">
                    <div className="w-16 shrink-0">
                      <span className="text-xs font-black text-slate-600 uppercase tracking-tighter">
                        {WEEKDAY_LABELS[key]}
                      </span>
                    </div>
                    
                    <div className="flex flex-1 flex-wrap gap-3 items-center">
                      {weeklyPattern[key].windows.map((window) => (
                        <div key={window.id} className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 border border-slate-200 shadow-sm ring-offset-background focus-within:ring-2 focus-within:ring-indigo-500">
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black uppercase text-indigo-500 leading-none mb-1">In</span>
                            <input
                              type="time"
                              className="bg-transparent text-xs font-bold focus:outline-none"
                              value={window.start || ""}
                              onChange={(e) => handleWeeklyWindowChange(key, window.id, "start", e.target.value)}
                            />
                          </div>
                          <div className="h-6 w-[1px] bg-slate-200 mx-1" />
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black uppercase text-rose-500 leading-none mb-1">Out</span>
                            <input
                              type="time"
                              className="bg-transparent text-xs font-bold focus:outline-none"
                              value={window.end || ""}
                              onChange={(e) => handleWeeklyWindowChange(key, window.id, "end", e.target.value)}
                            />
                          </div>
                          <button 
                            type="button" 
                            onClick={() => handleRemoveWeeklyWindow(key, window.id)} 
                            className="ml-2 p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-rose-500 transition-colors"
                          >
                            <XIcon className="h-3 w-3" />
                          </button>
                        </div>
                      ))}

                      {weeklyPattern[key].windows.length < 2 && (
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="h-9 border border-dashed border-slate-300 px-3 text-[10px] font-bold text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50" 
                          onClick={() => handleAddWeeklyWindow(key)}
                        >
                          + Core Window
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-4">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-400 uppercase mb-1">Target Min</span>
                        <div className="relative">
                          <input
                            type="number"
                            className="w-20 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            value={weeklyPattern[key].requiredMinutes ?? ""}
                            onChange={(e) => handleWeeklyRequiredChange(key, e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )}
  </div>
)}

              {/* Date Range Section */}
    
{/* Date Range Section */}
        <div className="grid gap-6 md:grid-cols-2 pt-4 border-t">
          <FormField
            control={scheduleForm.control}
            name="effectiveFrom"
            render={({ field }) => (
              <FormItem>
                <ActionTooltip 
                  label="Activation Date" 
                  description="When this schedule starts applying."
                  side="top"
                  align="start"
                >
                  <FormLabel className="flex items-center gap-2 font-bold cursor-help">
                    <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                    Effective From
                  </FormLabel>
                </ActionTooltip>
                <FormControl>
                  <Input 
                    type="date" 
                    className="bg-white hover:border-indigo-200 transition-colors focus:ring-indigo-500" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={scheduleForm.control}
            name="effectiveTo"
            render={({ field }) => (
              <FormItem>
                <ActionTooltip 
                  label="Expiry Date" 
                  description="Leave blank for permanent schedules."
                  side="top"
                  align="start"
                >
                  <FormLabel className="flex items-center gap-2 font-bold cursor-help">
                    <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                    Effective Until (Optional)
                  </FormLabel>
                </ActionTooltip>
                <FormControl>
                  <Input 
                    type="date" 
                    className="bg-white hover:border-indigo-200 transition-colors focus:ring-indigo-500" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-6 border-t border-slate-100 mt-4">
          <Button
            type="button"
            onClick={handleScheduleButtonClick}
            disabled={savingSchedule}
            className={`
              relative px-8 shadow-sm transition-all duration-200
              ${savingSchedule ? "opacity-90 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg active:scale-95 text-white"}
            `}
          >
            {savingSchedule && (
              <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            <span className="font-medium">
              {savingSchedule ? "Saving..." : editingSchedule ? "Update Schedule" : "Add Schedule"}
            </span>
          </Button>

          {editingSchedule && !savingSchedule && (
            <Button 
              type="button" 
              variant="ghost" 
              onClick={resetScheduleForm}
              className="text-slate-500 hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              Cancel Edit
            </Button>
          )}
        </div>
      </form>
    </Form>
  </div>

        {/* Summary Table - Made more scan-able */}
    {/* Summary Table */}
  <div className="rounded-xl border bg-white overflow-hidden shadow-sm mt-8">
    <div className="px-4 py-3 bg-slate-50 border-b">
      <h4 className="text-sm font-bold text-slate-700">Existing Schedules</h4>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50/50 text-slate-500 border-b">
            <th className="px-6 py-3 text-left font-semibold uppercase tracking-tighter text-[10px]">Type</th>
            <th className="px-6 py-3 text-left font-semibold uppercase tracking-tighter text-[10px]">Details</th>
            <th className="px-6 py-3 text-left font-semibold uppercase tracking-tighter text-[10px]">Validity Period</th>
            <th className="px-6 py-3 text-center font-semibold uppercase tracking-tighter text-[10px]">Manage</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {scheduleRows.length === 0 ? (
            <tr><td colSpan={4} className="py-12 text-center text-slate-400 italic">No schedules defined yet.</td></tr>
          ) : (
            scheduleRows.map((schedule) => (
              <tr key={schedule.id} className="hover:bg-slate-50/80 transition-colors group">
                <td className="px-6 py-4">
                  <Badge variant="outline" className="font-bold shadow-sm bg-white border-slate-200">
                    {formatTypeLabel(schedule.type)}
                  </Badge>
                </td>
                <td className="px-6 py-4 font-medium text-slate-600 italic">
                  {describeSchedule(schedule)}
                </td>
                <td className="px-6 py-4 text-slate-500">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-indigo-400 uppercase w-7">From</span>
                      <span className="font-mono text-xs font-bold">{toDateInput(schedule.effectiveFrom)}</span>
                    </div>
                    {schedule.effectiveTo && (
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-rose-400 uppercase w-7">To</span>
                        <span className="font-mono text-xs font-bold">{toDateInput(schedule.effectiveTo)}</span>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                        type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                      onClick={() => handleEditSchedule(schedule)}
                    >
                      <EditIcon className="h-4 w-4" />
                    </Button>
                    <Button
                        type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                      onClick={() => handleDeleteSchedule(schedule)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
</section>
    </TabsContent>


{/* WEEKLY INCLUSIONS*/}
<TabsContent value="exclusions" className="mt-6 animate-in fade-in-50 duration-300">
         <section className="space-y-6">
  {/* Header Section */}
  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-bold tracking-tight text-slate-800">Weekly Exclusions</h3>
        <ActionTooltip label="What are exclusions?" description={WEEKLY_EXCLUSION_HELP_TEXT} side="right">
          <HelpCircle className="h-4 w-4 text-slate-400 cursor-help" />
        </ActionTooltip>
      </div>
      <p className="text-sm text-muted-foreground max-w-2xl">
        Set specific days where late rules or attendance tracking are relaxed.
      </p>
    </div>
  </div>

  <Form {...weeklyExclusionForm}>
    <form onSubmit={handleWeeklyExclusionFormSubmit} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-8">
      
      {/* Weekday Selection - Better Visual Feedback */}
      <FormField
        control={weeklyExclusionForm.control}
        name="weekdays"
        render={({ field }) => {
          const value = Array.isArray(field.value) ? field.value : [];
          return (
            <FormItem className="space-y-4">
              <div className="flex items-center justify-between">
                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-indigo-500">
                  Select Days to Apply
                </FormLabel>
                {value.length > 0 && (
                  <span className="text-[10px] font-bold text-slate-400 italic">
                    {value.length} days selected
                  </span>
                )}
              </div>
              <FormControl>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_NUMBERS.map((weekday) => {
                    const isChecked = value.includes(weekday);
                    return (
                      <button
                        key={weekday}
                        type="button"
                        onClick={() => {
                          const next = new Set(value);
                          if (isChecked) next.delete(weekday);
                          else {
                            if (isEditingWeeklyExclusion) next.clear();
                            next.add(weekday);
                          }
                          field.onChange(Array.from(next).sort((a, b) => a - b));
                        }}
                        className={`min-w-[54px] px-3 py-2 rounded-xl text-xs font-bold border transition-all duration-200 flex flex-col items-center gap-1 ${
                          isChecked 
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100 scale-105" 
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-white"
                        }`}
                      >
                        <span className={isChecked ? "text-indigo-200" : "text-slate-400"}>
                          {weekdayNumberToLabel(weekday).substring(0, 1)}
                        </span>
                        {weekdayNumberToLabel(weekday)}
                      </button>
                    );
                  })}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          );
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-100">
        {/* Mode Selection with Card Style */}
        <FormField
          control={weeklyExclusionForm.control}
          name="mode"
          render={({ field }) => (
            <FormItem className="space-y-4">
              <FormLabel className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Exclusion Rule</FormLabel>
              <FormControl>
                <div className="grid gap-3">
                  {WEEKLY_EXCLUSION_MODES.map((mode) => {
                    const isSelected = field.value === mode;
                    return (
                      <label
                        key={mode}
                        className={`relative flex items-center gap-4 rounded-xl border-2 p-4 cursor-pointer transition-all ${
                          isSelected 
                            ? "bg-indigo-50/50 border-indigo-600 shadow-sm" 
                            : "bg-white border-slate-100 hover:border-slate-200"
                        }`}
                      >
                        <input
                          type="radio"
                          className="sr-only" // Hide native radio
                          checked={isSelected}
                          onChange={() => field.onChange(mode)}
                        />
                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                           {mode === "IGNORE_LATE_UNTIL" ? <Clock className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-bold ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                            {WEEKLY_EXCLUSION_MODE_LABELS[mode]}
                          </p>
                          <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                            {WEEKLY_EXCLUSION_MODE_DESCRIPTIONS[mode]}
                          </p>
                        </div>
                        {isSelected && <CheckCircle2 className="h-5 w-5 text-indigo-600 shrink-0" />}
                      </label>
                    );
                  })}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Dynamic Inputs Section */}
        <div className="space-y-6 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
             <CalendarIcon className="h-4 w-4 text-slate-400" />
             <span className="text-xs font-bold text-slate-600">Validity Period</span>
          </div>
          
          {weeklyExclusionMode === "IGNORE_LATE_UNTIL" && (
            <FormField
              control={weeklyExclusionForm.control}
              name="ignoreUntil"
              render={({ field }) => (
                <FormItem className="animate-in fade-in slide-in-from-right-4">
                  <FormLabel className="text-xs font-bold text-slate-500">Ignore Late Arrivals Until</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input type="time" className="bg-white border-slate-200 focus:ring-indigo-500" {...field} />
                      <div className="absolute right-3 top-2.5">
                         <ActionTooltip label="Hint" description="Employees clocking in before this time won't be marked late.">
                            <Info className="h-4 w-4 text-slate-300" />
                         </ActionTooltip>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={weeklyExclusionForm.control}
              name="effectiveFrom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold text-slate-500">Effective From</FormLabel>
                  <FormControl><Input type="date" className="bg-white border-slate-200" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={weeklyExclusionForm.control}
              name="effectiveTo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold text-slate-500">Until (Optional)</FormLabel>
                  <FormControl><Input type="date" className="bg-white border-slate-200" value={field.value ?? ""} onChange={field.onChange} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
        {editingWeeklyExclusion && (
          <Button type="button" variant="ghost" onClick={resetWeeklyExclusionForm} className="text-slate-500 font-bold">
            Discard Changes
          </Button>
        )}
        <Button
          type="button"
          onClick={handleWeeklyExclusionButtonClick}
          disabled={savingWeeklyExclusion}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 rounded-xl shadow-lg shadow-indigo-100 transition-all active:scale-95"
        >
          {savingWeeklyExclusion ? (
            <span className="flex items-center gap-2">
               <Loader2 className="h-4 w-4 animate-spin" /> Saving
            </span>
          ) : editingWeeklyExclusion ? "Update Exclusion" : "Create Exclusion"}
        </Button>
      </div>
    </form>
  </Form>

  {/* Results Table - Compact and Clean */}
  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
       <span className="text-xs font-black uppercase tracking-widest text-slate-500">Applied Exceptions</span>
       <Badge variant="outline" className="text-[10px] bg-white">{weeklyExclusionRows.length} Total</Badge>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-slate-100">
          {weeklyExclusionRows.length === 0 ? (
            <tr>
              <td className="py-12 text-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center">
                    <CalendarX className="h-5 w-5 text-slate-300" />
                  </div>
                  <p className="text-slate-400 font-medium">No exclusions active for this schedule.</p>
                </div>
              </td>
            </tr>
          ) : (
            weeklyExclusionRows.map((exclusion) => (
              <tr key={exclusion.id} className="hover:bg-indigo-50/20 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs">
                      {weekdayNumberToLabel(exclusion.weekday).substring(0, 3)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{WEEKDAY_LONG_LABELS[exclusion.weekday]}</p>
                      <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-tighter">
                         {exclusion.mode === "IGNORE_LATE_UNTIL" ? `Ignore until ${exclusion.ignoreUntil}` : "Full Exemption"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                   <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Timeline</span>
                      <span className="text-xs font-medium text-slate-600">
                         {toDateInput(exclusion.effectiveFrom)} 
                         <span className="mx-2 text-slate-300">→</span> 
                         {exclusion.effectiveTo ? toDateInput(exclusion.effectiveTo) : "Permanent"}
                      </span>
                   </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg border-slate-200" onClick={() => handleEditWeeklyExclusion(exclusion)}>
                       <Pencil className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button 
                      variant="ghost" 
                      type="button"
                      size="sm" 
                      className="h-8 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-600" 
                      onClick={() => handleDeleteWeeklyExclusion(exclusion)}
                      disabled={deletingWeeklyExclusionId === exclusion.id}
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Remove
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
</section>
    </TabsContent>

{/* ONE DAY EXCEPTIONS*/}

<TabsContent value="exceptions" className="mt-6 animate-in fade-in-50 duration-300">
             <section className="space-y-6">
  {/* Header Section */}
  <div className="space-y-1">
    <div className="flex items-center gap-2">
      <h3 className="text-lg font-bold tracking-tight text-slate-800">One-day exceptions</h3>
      <ActionTooltip label="What are exceptions?" description="Override the base schedule for specific dates (e.g., special shifts, field work).">
        <HelpCircle className="h-4 w-4 text-slate-400 cursor-help" />
      </ActionTooltip>
    </div>
    <p className="text-sm text-muted-foreground">
      Specific date overrides for events, field work, or irregular shift changes.
    </p>
  </div>

  <Form {...exceptionForm}>
    <form onSubmit={onSubmitException} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      
      {/* Primary Selection Row */}
      <div className="grid gap-6 md:grid-cols-2">
        <FormField
          control={exceptionForm.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Exception type</FormLabel>
              <Select
                value={field.value}
                onValueChange={(value) => field.onChange(value as ScheduleTypeEnum)}
              >
                <FormControl>
                  <SelectTrigger className="bg-slate-50/50 border-slate-200 rounded-xl focus:ring-indigo-500">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {scheduleTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {formatTypeLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={exceptionForm.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Target Date</FormLabel>
              <FormControl>
                <Input type="date" className="bg-slate-50/50 border-slate-200 rounded-xl focus:ring-indigo-500" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Dynamic Configuration Area */}
      {(exceptionType === ScheduleType.FIXED || exceptionType === ScheduleType.FLEX || exceptionType === ScheduleType.SHIFT) && (
        <div className="p-5 rounded-2xl bg-indigo-50/30 border border-indigo-100/50 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-2 mb-4 text-indigo-600">
            <Settings2 className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Configure Parameters</span>
          </div>

          {exceptionType === ScheduleType.FIXED && (
            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={exceptionForm.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold text-slate-500">Start Time</FormLabel>
                    <FormControl><Input type="time" className="bg-white" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={exceptionForm.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold text-slate-500">End Time</FormLabel>
                    <FormControl><Input type="time" className="bg-white" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={exceptionForm.control}
                name="graceMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold text-slate-500">Grace (Mins)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} className="bg-white" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {exceptionType === ScheduleType.FLEX && (
            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={exceptionForm.control}
                name="coreStart"
                render={({ field }) => (
                  <FormItem>
                    <InfoLabel label="Core Start" tooltip={CORE_START_HELP} />
                    <FormControl><Input type="time" className="bg-white" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={exceptionForm.control}
                name="coreEnd"
                render={({ field }) => (
                  <FormItem>
                    <InfoLabel label="Core End" tooltip={CORE_END_HELP} />
                    <FormControl><Input type="time" className="bg-white" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={exceptionForm.control}
                name="requiredDailyMinutes"
                render={({ field }) => (
                  <FormItem>
                    <InfoLabel label="Work Mins" tooltip={REQUIRED_MINUTES_HELP} />
                    <FormControl>
                      <Input type="number" className="bg-white" value={field.value ?? 480} onChange={e => field.onChange(e.target.valueAsNumber)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {exceptionType === ScheduleType.SHIFT && (
            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={exceptionForm.control}
                name="shiftStart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold text-slate-500">Shift Start</FormLabel>
                    <FormControl><Input type="time" className="bg-white" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={exceptionForm.control}
                name="shiftEnd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold text-slate-500">Shift End</FormLabel>
                    <FormControl><Input type="time" className="bg-white" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={exceptionForm.control}
                name="graceMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold text-slate-500">Grace (Mins)</FormLabel>
                    <FormControl>
                      <Input type="number" className="bg-white" value={field.value ?? 0} onChange={e => field.onChange(e.target.valueAsNumber)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
        </div>
      )}

      {/* Break Minutes & Actions */}
      <div className="flex flex-col md:flex-row items-end justify-between gap-4 pt-4 border-t border-slate-100">
        <FormField
          control={exceptionForm.control}
          name="breakMinutes"
          render={({ field }) => (
            <FormItem className="w-full md:w-48">
              <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Break Mins</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  className="bg-slate-50/50 border-slate-200 rounded-xl"
                  value={field.value ?? 60}
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center gap-2">
          {editingException && (
            <Button type="button" variant="ghost" onClick={resetExceptionForm} className="font-bold text-slate-500">
              Discard
            </Button>
          )}
          <Button 
            type="submit" 
            onClick={onSubmitException}
            disabled={savingException}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 rounded-xl shadow-lg shadow-indigo-100"
          >
            {savingException ? "Saving..." : editingException ? "Update Exception" : "Add Exception"}
          </Button>
        </div>
      </div>
    </form>
  </Form>
 {/* List of Exceptions Table */}
  <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm mt-8">
    <div className="px-6 py-4 border-b bg-slate-50/50 flex justify-between items-center">
      <h4 className="text-xs font-black uppercase tracking-widest text-slate-700">Active Overrides</h4>
      <Badge variant="outline" className="bg-white text-[10px] font-bold">
        {exceptions.length} Total
      </Badge>
    </div>
    
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b bg-slate-50/30 text-slate-500">
            <th className="px-6 py-3 font-bold uppercase text-[10px]">Target Date</th>
            <th className="px-6 py-3 font-bold uppercase text-[10px]">Type</th>
            <th className="px-6 py-3 font-bold uppercase text-[10px]">Parameters</th>
            <th className="px-6 py-3 text-right font-bold uppercase text-[10px]">Manage</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
         {exceptionRows.length === 0 ? (

            <tr>
              <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                No exceptions scheduled. Use the form above to add one.
              </td>
            </tr>
          ) : (
          exceptionRows.map((exc) => (

              <tr key={exc.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-3.5 w-3.5 text-indigo-500" />
                    <span className="font-mono font-bold text-slate-700">
                      {new Date(exc.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <Badge className="bg-indigo-50 text-indigo-700 border-none shadow-none font-bold">
                    {formatTypeLabel(exc.type)}
                  </Badge>
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs text-slate-600 font-medium italic">
                    {describeException(exc)}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                     type="button"
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                      onClick={() => handleEditException(exc)}
                    >
                      <EditIcon className="h-3.5 w-3.5" />
                    </Button>
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-slate-400 hover:text-rose-500"
                      onClick={() => handleDeleteException(exc)}
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
</section>
    </TabsContent>

</Tabs>
    </div>
  );
}
