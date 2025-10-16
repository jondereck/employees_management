"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
const CORE_START_HELP = "If set, arriving after this is late. Leave empty for floating day.";
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

type Props = {
  employeeId: string;
  schedules: WorkScheduleDTO[];
  exceptions: ScheduleExceptionDTO[];
};

export function EmployeeScheduleManager({ employeeId, schedules, exceptions }: Props) {
  const [scheduleList, setScheduleList] = useState<WorkScheduleDTO[]>(() => sortByDateDesc(schedules));
  const [exceptionList, setExceptionList] = useState<ScheduleExceptionDTO[]>(() => sortByDateDesc(exceptions));
  const [editingSchedule, setEditingSchedule] = useState<WorkScheduleDTO | null>(null);
  const [editingException, setEditingException] = useState<ScheduleExceptionDTO | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [savingException, setSavingException] = useState(false);
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null);
  const [weeklyPattern, setWeeklyPattern] = useState<WeeklyPatternFormState>(() => createEmptyWeeklyPatternState());
  const [weeklyPatternErrors, setWeeklyPatternErrors] = useState<WeeklyPatternErrorState>(() =>
    createEmptyWeeklyPatternErrors()
  );
  const [weeklyPatternOpen, setWeeklyPatternOpen] = useState(false);

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

  const scheduleType = scheduleForm.watch("type");
  const exceptionType = exceptionForm.watch("type");

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
    if (scheduleType === ScheduleType.FLEX && !weeklyPatternOpen && !hasWeeklyPatternConfigured) {
      setWeeklyPatternOpen(true);
    }
  }, [scheduleType, weeklyPatternOpen, hasWeeklyPatternConfigured]);

  const resetScheduleForm = useCallback(() => {
    setEditingSchedule(null);
    scheduleForm.reset(scheduleDefaults);
    setWeeklyPattern(createEmptyWeeklyPatternState());
    setWeeklyPatternErrors(createEmptyWeeklyPatternErrors());
    setWeeklyPatternOpen(false);
  }, [scheduleForm]);

  const resetExceptionForm = useCallback(() => {
    setEditingException(null);
    exceptionForm.reset(exceptionDefaults);
  }, [exceptionForm]);

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

  const scheduleRows = useMemo(() => sortByDateDesc(scheduleList), [scheduleList]);
  const exceptionRows = useMemo(() => sortByDateDesc(exceptionList), [exceptionList]);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Recurring work schedules</h3>
          <p className="text-sm text-muted-foreground">
            Define the base schedule per effective period. Overlaps are resolved by latest effective date.
          </p>
        </div>
        <Form {...scheduleForm}>
          <form onSubmit={handleScheduleFormSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={scheduleForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Schedule type</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => field.onChange(value as ScheduleTypeEnum)}
                    >
                      <FormControl>
                        <SelectTrigger>
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
                control={scheduleForm.control}
                name="breakMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paid break (minutes)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={720}
                        value={field.value ?? 60}
                        onChange={(event) => field.onChange(event.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {scheduleType === ScheduleType.FIXED && (
              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={scheduleForm.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start time</FormLabel>
                      <FormControl>
                        <Input placeholder="08:00" {...field} />
                      </FormControl>
                      <FormDescription>{SHIFT_TIMING_HELP}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={scheduleForm.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End time</FormLabel>
                      <FormControl>
                        <Input placeholder="17:00" {...field} />
                      </FormControl>
                      <FormDescription>{SHIFT_TIMING_HELP}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={scheduleForm.control}
                  name="graceMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grace minutes</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={180}
                          value={field.value ?? 0}
                          onChange={(event) => field.onChange(event.target.valueAsNumber)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {scheduleType === ScheduleType.FLEX && (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <FormField
                    control={scheduleForm.control}
                    name="coreStart"
                    render={({ field }) => (
                      <FormItem>
                        <InfoLabel label="Core Hours Start (optional)" tooltip={CORE_START_HELP} />
                        <FormControl>
                          <Input placeholder="10:00" {...field} />
                        </FormControl>
                        <FormDescription>{CORE_START_HELP}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={scheduleForm.control}
                    name="coreEnd"
                    render={({ field }) => (
                      <FormItem>
                        <InfoLabel label="Core Hours End (optional)" tooltip={CORE_END_HELP} />
                        <FormControl>
                          <Input placeholder="15:00" {...field} />
                        </FormControl>
                        <FormDescription>{CORE_END_HELP}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={scheduleForm.control}
                    name="requiredDailyMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <InfoLabel label="Required Work Minutes" tooltip={REQUIRED_MINUTES_HELP} />
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={1440}
                            value={field.value ?? 480}
                            onChange={(event) => field.onChange(event.target.valueAsNumber)}
                          />
                        </FormControl>
                        <FormDescription>{REQUIRED_MINUTES_HELP}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={scheduleForm.control}
                    name="bandwidthStart"
                    render={({ field }) => (
                      <FormItem>
                        <InfoLabel label="Work Window Start (Bandwidth)" tooltip={BANDWIDTH_START_HELP} />
                        <FormControl>
                          <Input placeholder="06:00" {...field} />
                        </FormControl>
                        <FormDescription>{BANDWIDTH_START_HELP}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={scheduleForm.control}
                    name="bandwidthEnd"
                    render={({ field }) => (
                      <FormItem>
                        <InfoLabel label="Work Window End (Bandwidth)" tooltip={BANDWIDTH_END_HELP} />
                        <FormControl>
                          <Input placeholder="20:00" {...field} />
                        </FormControl>
                        <FormDescription>{BANDWIDTH_END_HELP}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4 rounded-lg border border-muted p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h4 className="text-sm font-semibold">Weekly pattern (optional)</h4>
                      <p className="text-xs text-muted-foreground">{WEEKLY_PATTERN_HINT}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setWeeklyPatternOpen((prev) => !prev)}
                    >
                      {weeklyPatternOpen ? "Hide pattern" : "Edit pattern"}
                    </Button>
                  </div>
                  {!weeklyPatternOpen && (
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAY_KEYS.map((key) => (
                        <Badge key={key} variant="outline" className="font-normal">
                          {WEEKDAY_LABELS[key]}: {describeWeeklyPatternDay(weeklyPattern[key])}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {weeklyPatternOpen && (
                    <div className="space-y-4">
                      {WEEKDAY_KEYS.map((key) => {
                        const dayState = weeklyPattern[key];
                        const error = weeklyPatternErrors[key];
                        return (
                          <div key={key} className="rounded-md border p-3">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{WEEKDAY_LABELS[key]}</span>
                                  <Badge variant="secondary" className="font-normal">
                                    {describeWeeklyPatternDay(dayState)}
                                  </Badge>
                                </div>
                                {error ? (
                                  <p className="mt-1 text-xs text-destructive">{error}</p>
                                ) : null}
                              </div>
                              <Button type="button" variant="ghost" size="sm" onClick={() => handleClearWeeklyDay(key)}>
                                Clear day
                              </Button>
                            </div>
                            <div className="mt-3 space-y-3">
                              {dayState.windows.map((window) => (
                                <div key={window.id} className="grid gap-2 md:grid-cols-[1fr,1fr,auto] md:items-end">
                                  <div>
                                    <FormLabel>Start</FormLabel>
                                    <Input
                                      placeholder="08:00"
                                      value={window.start}
                                      onChange={(event) =>
                                        handleWeeklyWindowChange(key, window.id, "start", event.target.value)
                                      }
                                    />
                                  </div>
                                  <div>
                                    <FormLabel>End</FormLabel>
                                    <Input
                                      placeholder="12:00"
                                      value={window.end}
                                      onChange={(event) =>
                                        handleWeeklyWindowChange(key, window.id, "end", event.target.value)
                                      }
                                    />
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveWeeklyWindow(key, window.id)}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              ))}
                              {dayState.windows.length < 3 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAddWeeklyWindow(key)}
                                >
                                  Add window
                                </Button>
                              )}
                            </div>
                            <div className="mt-3 grid gap-2 md:grid-cols-[max-content,1fr] md:items-center">
                              <FormLabel>Required minutes</FormLabel>
                              <div>
                                <Input
                                  type="number"
                                  min={0}
                                  max={1440}
                                  placeholder="480"
                                  value={dayState.requiredMinutes ?? ""}
                                  onChange={(event) => handleWeeklyRequiredChange(key, event.target.value)}
                                />
                                <p className="mt-1 text-xs text-muted-foreground">480 = 8h, 720 = 12h</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {scheduleType === ScheduleType.SHIFT && (
              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={scheduleForm.control}
                  name="shiftStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shift start</FormLabel>
                      <FormControl>
                        <Input placeholder="22:00" {...field} />
                      </FormControl>
                      <FormDescription>{SHIFT_TIMING_HELP}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={scheduleForm.control}
                  name="shiftEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shift end</FormLabel>
                      <FormControl>
                        <Input placeholder="06:00" {...field} />
                      </FormControl>
                      <FormDescription>{SHIFT_TIMING_HELP}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={scheduleForm.control}
                  name="graceMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grace minutes</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={180}
                          value={field.value ?? 0}
                          onChange={(event) => field.onChange(event.target.valueAsNumber)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={scheduleForm.control}
                name="effectiveFrom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effective from</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
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
                    <FormLabel>Effective to</FormLabel>
                    <FormControl>
                      <Input type="date" value={field.value ?? ""} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={handleScheduleButtonClick} disabled={savingSchedule}>
                {savingSchedule ? "Saving..." : editingSchedule ? "Update schedule" : "Add schedule"}
              </Button>
              {editingSchedule && (
                <Button type="button" variant="outline" onClick={resetScheduleForm} disabled={savingSchedule}>
                  Cancel edit
                </Button>
              )}
            </div>
          </form>
        </Form>

        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Type</th>
                <th className="p-2 text-left">Details</th>
                <th className="p-2 text-left">Effective</th>
                <th className="p-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {scheduleRows.length === 0 ? (
                <tr>
                  <td className="p-3 text-center text-muted-foreground" colSpan={4}>
                    No schedules yet.
                  </td>
                </tr>
              ) : (
                scheduleRows.map((schedule) => (
                  <tr key={schedule.id} className="odd:bg-muted/20">
                    <td className="p-2">
                      <Badge variant="secondary">{formatTypeLabel(schedule.type)}</Badge>
                    </td>
                    <td className="p-2">{describeSchedule(schedule)}</td>
                    <td className="p-2">
                      {toDateInput(schedule.effectiveFrom)}
                      {" "}
                      {schedule.effectiveTo ? `to ${toDateInput(schedule.effectiveTo)}` : "onward"}
                    </td>
                    <td className="p-2 text-center">
                      <div className="flex justify-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditSchedule(schedule)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteSchedule(schedule)}
                          disabled={deletingScheduleId === schedule.id}
                        >
                          {deletingScheduleId === schedule.id ? "Removing…" : "Remove"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">One-day exceptions</h3>
          <p className="text-sm text-muted-foreground">
            Override the base schedule for specific dates (e.g., special shifts, field work).
          </p>
        </div>
        <Form {...exceptionForm}>
          <form onSubmit={onSubmitException} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={exceptionForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Exception type</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => field.onChange(value as ScheduleTypeEnum)}
                    >
                      <FormControl>
                        <SelectTrigger>
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
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {exceptionType === ScheduleType.FIXED && (
              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={exceptionForm.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start time</FormLabel>
                      <FormControl>
                        <Input placeholder="08:00" {...field} />
                      </FormControl>
                      <FormDescription>{SHIFT_TIMING_HELP}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={exceptionForm.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End time</FormLabel>
                      <FormControl>
                        <Input placeholder="17:00" {...field} />
                      </FormControl>
                      <FormDescription>{SHIFT_TIMING_HELP}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={exceptionForm.control}
                  name="graceMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grace minutes</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={180}
                          value={field.value ?? 0}
                          onChange={(event) => field.onChange(event.target.valueAsNumber)}
                        />
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
                      <InfoLabel label="Core Hours Start (optional)" tooltip={CORE_START_HELP} />
                      <FormControl>
                        <Input placeholder="10:00" {...field} />
                      </FormControl>
                      <FormDescription>{CORE_START_HELP}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={exceptionForm.control}
                  name="coreEnd"
                  render={({ field }) => (
                    <FormItem>
                      <InfoLabel label="Core Hours End (optional)" tooltip={CORE_END_HELP} />
                      <FormControl>
                        <Input placeholder="15:00" {...field} />
                      </FormControl>
                      <FormDescription>{CORE_END_HELP}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={exceptionForm.control}
                  name="requiredDailyMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <InfoLabel label="Required Work Minutes" tooltip={REQUIRED_MINUTES_HELP} />
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={1440}
                          value={field.value ?? 480}
                          onChange={(event) => field.onChange(event.target.valueAsNumber)}
                        />
                      </FormControl>
                      <FormDescription>{REQUIRED_MINUTES_HELP}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={exceptionForm.control}
                  name="bandwidthStart"
                  render={({ field }) => (
                    <FormItem>
                      <InfoLabel label="Work Window Start (Bandwidth)" tooltip={BANDWIDTH_START_HELP} />
                      <FormControl>
                        <Input placeholder="06:00" {...field} />
                      </FormControl>
                      <FormDescription>{BANDWIDTH_START_HELP}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={exceptionForm.control}
                  name="bandwidthEnd"
                  render={({ field }) => (
                    <FormItem>
                      <InfoLabel label="Work Window End (Bandwidth)" tooltip={BANDWIDTH_END_HELP} />
                      <FormControl>
                        <Input placeholder="20:00" {...field} />
                      </FormControl>
                      <FormDescription>{BANDWIDTH_END_HELP}</FormDescription>
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
                      <FormLabel>Shift start</FormLabel>
                      <FormControl>
                        <Input placeholder="22:00" {...field} />
                      </FormControl>
                      <FormDescription>{SHIFT_TIMING_HELP}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={exceptionForm.control}
                  name="shiftEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shift end</FormLabel>
                      <FormControl>
                        <Input placeholder="06:00" {...field} />
                      </FormControl>
                      <FormDescription>{SHIFT_TIMING_HELP}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={exceptionForm.control}
                  name="graceMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grace minutes</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={180}
                          value={field.value ?? 0}
                          onChange={(event) => field.onChange(event.target.valueAsNumber)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <FormField
              control={exceptionForm.control}
              name="breakMinutes"
              render={({ field }) => (
                <FormItem className="w-full md:w-48">
                  <FormLabel>Break minutes</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={720}
                      value={field.value ?? 60}
                      onChange={(event) => field.onChange(event.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={savingException}>
                {savingException ? "Saving..." : editingException ? "Update exception" : "Add exception"}
              </Button>
              {editingException && (
                <Button type="button" variant="outline" onClick={resetExceptionForm} disabled={savingException}>
                  Cancel edit
                </Button>
              )}
            </div>
          </form>
        </Form>

        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Type</th>
                <th className="p-2 text-left">Details</th>
                <th className="p-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {exceptionRows.length === 0 ? (
                <tr>
                  <td className="p-3 text-center text-muted-foreground" colSpan={4}>
                    No exceptions yet.
                  </td>
                </tr>
              ) : (
                exceptionRows.map((exception) => (
                  <tr key={exception.id} className="odd:bg-muted/20">
                    <td className="p-2">{toDateInput(exception.date)}</td>
                    <td className="p-2">
                      <Badge variant="outline">{formatTypeLabel(exception.type)}</Badge>
                    </td>
                    <td className="p-2">{describeException(exception)}</td>
                    <td className="p-2 text-center">
                      <div className="flex justify-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditException(exception)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteException(exception)}
                        >
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
