"use client";

import { useMemo } from "react";
import { useFormContext } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
  sortWeeklyPatternWindows,
  type WeeklyPattern,
} from "@/utils/weeklyPattern";

import type { WeeklyPatternInput } from "@/app/api/schedules/weekly-pattern-schema";

type WeeklyPatternFormContext = {
  weeklyPattern?: WeeklyPatternInput;
};

const formatPreview = (day: WeeklyPattern[typeof WEEKDAY_ORDER[number]] | undefined) => {
  if (!day) return "No windows";
  const ranges = sortWeeklyPatternWindows(day.windows).map((window) => `${window.start}–${window.end}`).join(", ");
  return `${ranges} • Req ${day.requiredMinutes}`;
};

const ensurePattern = (pattern: WeeklyPatternInput | undefined): WeeklyPatternInput => pattern ?? {};

export function WeeklyPatternEditor({ disabled = false }: { disabled?: boolean }) {
  const form = useFormContext<WeeklyPatternFormContext>();
  const pattern = ensurePattern(form.watch("weeklyPattern"));
  const errors = form.formState.errors.weeklyPattern as
    | Partial<Record<keyof WeeklyPatternInput, { message?: string; windows?: unknown }>>
    | undefined;

  const addWindow = (day: keyof WeeklyPatternInput) => {
    if (disabled) return;
    const current = ensurePattern(form.getValues("weeklyPattern"))[day];
    const windows = current?.windows ?? [];
    if (windows.length >= 3) return;
    const next = {
      windows: [...windows, { start: "08:00", end: "17:00" }],
      requiredMinutes: current?.requiredMinutes ?? 0,
    };
    form.setValue(`weeklyPattern.${day}` as const, next, { shouldDirty: true, shouldValidate: true });
  };

  const updateWindow = (
    day: keyof WeeklyPatternInput,
    index: number,
    field: "start" | "end",
    value: string
  ) => {
    const current = ensurePattern(form.getValues("weeklyPattern"))[day];
    if (!current) return;
    const windows = [...current.windows];
    windows[index] = { ...windows[index], [field]: value };
    form.setValue(`weeklyPattern.${day}` as const, { ...current, windows }, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const removeWindow = (day: keyof WeeklyPatternInput, index: number) => {
    const current = ensurePattern(form.getValues("weeklyPattern"))[day];
    if (!current) return;
    const windows = current.windows.filter((_, idx) => idx !== index);
    if (!windows.length) {
      form.setValue(`weeklyPattern.${day}` as const, undefined, {
        shouldDirty: true,
        shouldValidate: true,
      });
      return;
    }
    form.setValue(
      `weeklyPattern.${day}` as const,
      {
        ...current,
        windows,
      },
      { shouldDirty: true, shouldValidate: true }
    );
  };

  const clearDay = (day: keyof WeeklyPatternInput) => {
    form.setValue(`weeklyPattern.${day}` as const, undefined, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const updateRequired = (day: keyof WeeklyPatternInput, value: string) => {
    const minutes = Number.parseInt(value, 10);
    if (Number.isNaN(minutes) || minutes < 0) {
      form.setError(`weeklyPattern.${day}.requiredMinutes` as const, {
        type: "manual",
        message: "Required minutes must be a non-negative number.",
      });
      return;
    }
    const current = ensurePattern(form.getValues("weeklyPattern"))[day];
    const base = current ?? { windows: [], requiredMinutes: 0 };
    form.clearErrors(`weeklyPattern.${day}.requiredMinutes` as const);
    form.setValue(
      `weeklyPattern.${day}` as const,
      { ...base, requiredMinutes: minutes },
      { shouldDirty: true }
    );
  };

  const previewPattern: WeeklyPattern = useMemo(() => {
    const entries: WeeklyPattern = {};
    for (const key of WEEKDAY_ORDER) {
      const day = pattern[key];
      if (!day) continue;
      const windows = day.windows.filter((window) => window.start && window.end);
      if (!windows.length) continue;
      entries[key] = {
        windows,
        requiredMinutes: day.requiredMinutes ?? 0,
      };
    }
    return entries;
  }, [pattern]);

  return (
    <div className="space-y-4">
      <FormDescription>
        If set, presence is counted only within these hours. Day is floating; no core lateness. Undertime if
        net minutes &lt; required.
      </FormDescription>
      <div className="space-y-3">
        {WEEKDAY_ORDER.map((dayKey) => {
          const day = pattern[dayKey];
          const dayErrors = errors?.[dayKey];
          const windows = day?.windows ?? [];
          const preview = formatPreview(previewPattern[dayKey]);
          const windowArrayErrors = Array.isArray((dayErrors as any)?.windows)
            ? ((dayErrors as any).windows as Array<{ message?: string }>).map((entry) => entry?.message).filter(Boolean)
            : [];
          return (
            <div key={dayKey} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Label className="text-base font-medium">{WEEKDAY_LABELS[dayKey]}</Label>
                  <p className="text-sm text-muted-foreground">{preview}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addWindow(dayKey)}
                    disabled={disabled || windows.length >= 3}
                  >
                    Add window
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => clearDay(dayKey)}
                    disabled={disabled || !day}
                  >
                    Clear day
                  </Button>
                </div>
              </div>
              {dayErrors?.message ? (
                <p className="mt-2 text-sm text-destructive">{dayErrors.message}</p>
              ) : null}
              {windows.length ? (
                <div className="mt-3 space-y-3">
                  {windows.map((window, index) => (
                    <div key={`${dayKey}-${index}`} className="flex flex-wrap items-end gap-3">
                      <div className="flex flex-col">
                        <Label htmlFor={`${dayKey}-start-${index}`} className="text-xs uppercase text-muted-foreground">
                          Start
                        </Label>
                        <Input
                          id={`${dayKey}-start-${index}`}
                          type="time"
                          value={window.start}
                          onChange={(event) => updateWindow(dayKey, index, "start", event.target.value)}
                          disabled={disabled}
                          className="w-28"
                        />
                      </div>
                      <div className="flex flex-col">
                        <Label htmlFor={`${dayKey}-end-${index}`} className="text-xs uppercase text-muted-foreground">
                          End
                        </Label>
                        <Input
                          id={`${dayKey}-end-${index}`}
                          type="time"
                          value={window.end}
                          onChange={(event) => updateWindow(dayKey, index, "end", event.target.value)}
                          disabled={disabled}
                          className="w-28"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeWindow(dayKey, index)}
                        disabled={disabled}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <Label htmlFor={`${dayKey}-required`} className="text-xs uppercase text-muted-foreground">
                        Required minutes
                      </Label>
                      <Input
                        id={`${dayKey}-required`}
                        type="number"
                        min={0}
                        step={15}
                        value={day?.requiredMinutes ?? 0}
                        onChange={(event) => updateRequired(dayKey, event.target.value)}
                        disabled={disabled}
                        className="w-32"
                      />
                      <p className="text-xs text-muted-foreground">480 = 8h, 720 = 12h</p>
                    </div>
                    {dayErrors?.windows && typeof dayErrors.windows === "string" ? (
                      <p className="text-sm text-destructive">{dayErrors.windows}</p>
                    ) : null}
                    {windowArrayErrors.length ? (
                      <div className="space-y-1">
                        {windowArrayErrors.map((message, index) => (
                          <p key={`${dayKey}-window-error-${index}`} className="text-sm text-destructive">
                            {message}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  No windows configured. Add at least one window to enable this day.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
