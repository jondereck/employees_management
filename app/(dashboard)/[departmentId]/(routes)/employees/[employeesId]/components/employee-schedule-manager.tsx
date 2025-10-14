"use client";

import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Prisma, ScheduleType } from "@prisma/client";
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

type ScheduleTypeEnum = (typeof ScheduleType)[keyof typeof ScheduleType];

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
      return `Core ${schedule.coreStart ?? "—"}–${schedule.coreEnd ?? "—"}, Band ${schedule.bandwidthStart ?? "—"}–${schedule.bandwidthEnd ?? "—"}, Required ${schedule.requiredDailyMinutes ?? 0}m`;
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

  const resetScheduleForm = useCallback(() => {
    setEditingSchedule(null);
    scheduleForm.reset(scheduleDefaults);
  }, [scheduleForm]);

  const resetExceptionForm = useCallback(() => {
    setEditingException(null);
    exceptionForm.reset(exceptionDefaults);
  }, [exceptionForm]);

  const onSubmitSchedule = scheduleForm.handleSubmit(async (values) => {
    try {
      setSavingSchedule(true);
      const payload = {
        ...values,
        effectiveTo: values.effectiveTo ? values.effectiveTo : null,
      };
      const response = await fetch(
        editingSchedule
          ? `/api/employee/${employeeId}/work-schedules/${editingSchedule.id}`
          : `/api/employee/${employeeId}/work-schedules`,
        {
          method: editingSchedule ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
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
      try {
        const response = await fetch(
          `/api/employee/${employeeId}/work-schedules/${schedule.id}`,
          { method: "DELETE" }
        );
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
      }
    },
    [editingSchedule, employeeId, resetScheduleForm]
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
          <form onSubmit={onSubmitSchedule} className="space-y-4">
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
              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={scheduleForm.control}
                  name="coreStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Core start</FormLabel>
                      <FormControl>
                        <Input placeholder="10:00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={scheduleForm.control}
                  name="coreEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Core end</FormLabel>
                      <FormControl>
                        <Input placeholder="15:00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={scheduleForm.control}
                  name="requiredDailyMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Required minutes</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={1440}
                          value={field.value ?? 480}
                          onChange={(event) => field.onChange(event.target.valueAsNumber)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={scheduleForm.control}
                  name="bandwidthStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bandwidth start</FormLabel>
                      <FormControl>
                        <Input placeholder="06:00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={scheduleForm.control}
                  name="bandwidthEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bandwidth end</FormLabel>
                      <FormControl>
                        <Input placeholder="20:00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
              <Button type="submit" disabled={savingSchedule}>
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
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditSchedule(schedule)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteSchedule(schedule)}
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
                      <FormLabel>Core start</FormLabel>
                      <FormControl>
                        <Input placeholder="10:00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={exceptionForm.control}
                  name="coreEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Core end</FormLabel>
                      <FormControl>
                        <Input placeholder="15:00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={exceptionForm.control}
                  name="requiredDailyMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Required minutes</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={1440}
                          value={field.value ?? 480}
                          onChange={(event) => field.onChange(event.target.valueAsNumber)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={exceptionForm.control}
                  name="bandwidthStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bandwidth start</FormLabel>
                      <FormControl>
                        <Input placeholder="06:00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={exceptionForm.control}
                  name="bandwidthEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bandwidth end</FormLabel>
                      <FormControl>
                        <Input placeholder="20:00" {...field} />
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
                      <FormLabel>Shift start</FormLabel>
                      <FormControl>
                        <Input placeholder="22:00" {...field} />
                      </FormControl>
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
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditException(exception)}
                        >
                          Edit
                        </Button>
                        <Button
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
