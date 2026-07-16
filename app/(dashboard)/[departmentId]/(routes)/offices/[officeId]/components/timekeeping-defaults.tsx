"use client";

import * as React from "react";
import { ScheduleType } from "@prisma/client";
import * as z from "zod";
import axios from "axios";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

import { timekeepingOfficeScheduleSchema } from "@/lib/timekeepingScheduleInput";

type OfficeScheduleDto = {
  id: string;
  departmentId: string;
  officeId: string;
  officeName: string | null;
  type: ScheduleType;
  startTime: string | null;
  endTime: string | null;
  graceMinutes: number | null;
  coreStart: string | null;
  coreEnd: string | null;
  bandwidthStart: string | null;
  bandwidthEnd: string | null;
  requiredDailyMinutes: number | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  breakMinutes: number;
  timezone: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  weeklyPattern: unknown | null;
  createdAt: string;
  updatedAt: string;
};

const formSchema = timekeepingOfficeScheduleSchema;
type FormValues = z.infer<typeof formSchema>;

const toDateInput = (value: string | null | undefined) => {
  if (!value) return "";
  // Accept either YYYY-MM-DD or ISO datetime.
  return value.length >= 10 ? value.slice(0, 10) : value;
};

const formatTypeLabel = (value: ScheduleType) => {
  if (value === ScheduleType.FIXED) return "Fixed";
  if (value === ScheduleType.FLEX) return "Flex";
  return "Shift";
};

const describeSchedule = (s: OfficeScheduleDto) => {
  if (s.type === ScheduleType.FIXED) {
    return `${s.startTime ?? "--:--"} - ${s.endTime ?? "--:--"} (grace ${s.graceMinutes ?? 0}m)`;
  }
  if (s.type === ScheduleType.SHIFT) {
    return `${s.shiftStart ?? "--:--"} - ${s.shiftEnd ?? "--:--"} (grace ${s.graceMinutes ?? 0}m)`;
  }
  return `Core ${s.coreStart ?? "--:--"}-${s.coreEnd ?? "--:--"}, Band ${s.bandwidthStart ?? "--:--"}-${s.bandwidthEnd ?? "--:--"}, Req ${s.requiredDailyMinutes ?? 0}m`;
};

export default function TimekeepingDefaultsSection() {
  const params = useParams() as { departmentId: string; officeId: string };
  const departmentId = params.departmentId;
  const officeId = params.officeId;

  const [items, setItems] = React.useState<OfficeScheduleDto[]>([]);
  const [listLoading, setListLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<OfficeScheduleDto | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<OfficeScheduleDto | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      officeId,
      type: ScheduleType.FIXED,
      startTime: "08:00",
      endTime: "17:00",
      graceMinutes: 0,
      breakMinutes: 60,
      timezone: "Asia/Manila",
      effectiveFrom: toDateInput(new Date().toISOString()),
      effectiveTo: null,
    } as any,
  });

  const scheduleType = form.watch("type");

  const refresh = React.useCallback(async () => {
    setListLoading(true);
    try {
      const response = await axios.get(`/api/${departmentId}/biometrics/office-schedules`, {
        params: { officeId },
      });
      const next: OfficeScheduleDto[] = Array.isArray(response.data?.items) ? response.data.items : [];
      setItems(next);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Unable to load schedules",
        description: error?.response?.data?.error ?? error?.message ?? "Request failed.",
      });
    } finally {
      setListLoading(false);
    }
  }, [departmentId, officeId]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const openCreate = () => {
    setEditing(null);
    form.reset({
      officeId,
      type: ScheduleType.FIXED,
      startTime: "08:00",
      endTime: "17:00",
      graceMinutes: 0,
      coreStart: null,
      coreEnd: null,
      bandwidthStart: null,
      bandwidthEnd: null,
      requiredDailyMinutes: null,
      shiftStart: null,
      shiftEnd: null,
      breakMinutes: 60,
      timezone: "Asia/Manila",
      effectiveFrom: toDateInput(new Date().toISOString()),
      effectiveTo: null,
      weeklyPattern: undefined,
    } as any);
    setDialogOpen(true);
  };

  const openEdit = (schedule: OfficeScheduleDto) => {
    setEditing(schedule);
    form.reset({
      id: schedule.id,
      officeId: schedule.officeId,
      type: schedule.type,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      graceMinutes: schedule.graceMinutes,
      coreStart: schedule.coreStart,
      coreEnd: schedule.coreEnd,
      bandwidthStart: schedule.bandwidthStart,
      bandwidthEnd: schedule.bandwidthEnd,
      requiredDailyMinutes: schedule.requiredDailyMinutes,
      shiftStart: schedule.shiftStart,
      shiftEnd: schedule.shiftEnd,
      breakMinutes: schedule.breakMinutes,
      timezone: schedule.timezone,
      effectiveFrom: toDateInput(schedule.effectiveFrom),
      effectiveTo: schedule.effectiveTo ? toDateInput(schedule.effectiveTo) : null,
      weeklyPattern: schedule.weeklyPattern ?? undefined,
    } as any);
    setDialogOpen(true);
  };

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const payload = {
        ...values,
        officeId,
        effectiveTo: values.effectiveTo ? values.effectiveTo : null,
      };

      if (editing) {
        const response = await axios.patch(`/api/${departmentId}/biometrics/office-schedules/${editing.id}`, payload);
        const appliedCount = response.data?.appliedCount ?? 0;
        toast({ title: "Saved", description: `Office schedule updated and applied to ${appliedCount} employees.` });
      } else {
        const response = await axios.post(`/api/${departmentId}/biometrics/office-schedules`, payload);
        const appliedCount = response.data?.appliedCount ?? 0;
        toast({ title: "Saved", description: `Office schedule created and applied to ${appliedCount} employees.` });
      }
      setDialogOpen(false);
      await refresh();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: error?.response?.data?.error ?? error?.message ?? "Request failed.",
      });
    } finally {
      setSaving(false);
    }
  };

  const onConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/${departmentId}/biometrics/office-schedules/${deleteTarget.id}`);
      toast({ title: "Deleted", description: "Office schedule removed." });
      setDeleteTarget(null);
      await refresh();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error?.response?.data?.error ?? error?.message ?? "Request failed.",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold">Timekeeping Defaults</h3>
            <p className="text-sm text-muted-foreground">
              Office schedules are automatically applied to all active employees in this office when saved.
            </p>
          </div>
          <Button type="button" onClick={openCreate} disabled={listLoading}>
            <Plus className="mr-2 h-4 w-4" /> Add schedule
          </Button>
        </div>
      </div>

      <Separator />

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
            {listLoading ? (
              <tr>
                <td className="p-3 text-center text-muted-foreground" colSpan={4}>
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading schedules…
                  </span>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="p-3 text-center text-muted-foreground" colSpan={4}>
                  No schedules yet.
                </td>
              </tr>
            ) : (
              items.map((schedule) => (
                <tr key={schedule.id} className="odd:bg-muted/20">
                  <td className="p-2">
                    <Badge variant="secondary">{formatTypeLabel(schedule.type)}</Badge>
                  </td>
                  <td className="p-2">{describeSchedule(schedule)}</td>
                  <td className="p-2">
                    {toDateInput(schedule.effectiveFrom)}{" "}
                    {schedule.effectiveTo ? `to ${toDateInput(schedule.effectiveTo)}` : "onward"}
                  </td>
                  <td className="p-2">
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => openEdit(schedule)}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteTarget(schedule)}
                        disabled={deleting}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !saving && setDialogOpen(open)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit schedule" : "Add schedule"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select
                        disabled={saving}
                        onValueChange={(value) => field.onChange(value as ScheduleType)}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={ScheduleType.FIXED}>Fixed</SelectItem>
                          <SelectItem value={ScheduleType.FLEX}>Flex</SelectItem>
                          <SelectItem value={ScheduleType.SHIFT}>Shift</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timezone</FormLabel>
                      <FormControl>
                        <Input disabled={saving} placeholder="Asia/Manila" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="effectiveFrom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Effective from</FormLabel>
                      <FormControl>
                        <Input disabled={saving} type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="effectiveTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Effective to</FormLabel>
                      <FormControl>
                        <Input
                          disabled={saving}
                          type="date"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? e.target.value : null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="breakMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Break (min)</FormLabel>
                      <FormControl>
                        <Input
                          disabled={saving}
                          type="number"
                          min={0}
                          max={720}
                          value={field.value ?? 60}
                          onChange={(e) => field.onChange(e.target.valueAsNumber)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {scheduleType === ScheduleType.FIXED ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start</FormLabel>
                        <FormControl>
                          <Input disabled={saving} type="time" step={60} value={field.value ?? ""} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End</FormLabel>
                        <FormControl>
                          <Input disabled={saving} type="time" step={60} value={field.value ?? ""} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="graceMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grace (min)</FormLabel>
                        <FormControl>
                          <Input
                            disabled={saving}
                            type="number"
                            min={0}
                            max={180}
                            value={field.value ?? 0}
                            onChange={(e) => field.onChange(e.target.valueAsNumber)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : null}

              {scheduleType === ScheduleType.SHIFT ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="shiftStart"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shift start</FormLabel>
                        <FormControl>
                          <Input disabled={saving} placeholder="22:00" value={field.value ?? ""} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="shiftEnd"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shift end</FormLabel>
                        <FormControl>
                          <Input disabled={saving} placeholder="06:00" value={field.value ?? ""} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="graceMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grace (min)</FormLabel>
                        <FormControl>
                          <Input
                            disabled={saving}
                            type="number"
                            min={0}
                            max={180}
                            value={field.value ?? 0}
                            onChange={(e) => field.onChange(e.target.valueAsNumber)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : null}

              {scheduleType === ScheduleType.FLEX ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="coreStart"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Core start</FormLabel>
                        <FormControl>
                          <Input disabled={saving} placeholder="09:00" value={field.value ?? ""} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="coreEnd"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Core end</FormLabel>
                        <FormControl>
                          <Input disabled={saving} placeholder="15:00" value={field.value ?? ""} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bandwidthStart"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bandwidth start</FormLabel>
                        <FormControl>
                          <Input disabled={saving} placeholder="07:00" value={field.value ?? ""} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bandwidthEnd"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bandwidth end</FormLabel>
                        <FormControl>
                          <Input disabled={saving} placeholder="19:00" value={field.value ?? ""} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="requiredDailyMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Required minutes</FormLabel>
                        <FormControl>
                          <Input
                            disabled={saving}
                            type="number"
                            min={0}
                            max={1440}
                            value={field.value ?? 480}
                            onChange={(e) => field.onChange(e.target.valueAsNumber)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : null}

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                    </span>
                  ) : (
                    "Save"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete schedule?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will remove the office schedule entry. Analyzer will fall back to older defaults if available.
          </p>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={onConfirmDelete} disabled={deleting}>
              {deleting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Deleting…
                </span>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
