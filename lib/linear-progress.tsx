"use client";

import LinearLoader from "@/components/ui/progress-toast";
import React from "react";
import { toast } from "sonner";


export type ProgressReporter = {
  set: (pct: number) => void;                  // 0..100
  label: (text: React.ReactNode) => void;      // change loader label
};

// optional result text types
type TextOrFn<T> =
  | string
  | React.ReactNode
  | ((data: T) => string | React.ReactNode | Promise<string | React.ReactNode>);

/**
 * toastProgress(work, opts) — behaves like toast.promise but with a linear loader
 * - indeterminate until there’s a % (autoTick or progress.set)
 * - switches to determinate when value exists
 */
export function toastProgress<T>(
  work: (progress: ProgressReporter) => Promise<T>,
  opts?: {
    id?: string;
    width?: number;
    loading?: string | React.ReactNode;
    success?: TextOrFn<T>;
    error?: TextOrFn<any>;
    /** auto visual ticking while pending */
    autoTick?: { start?: number; max?: number; step?: number; intervalMs?: number };
    /** show percent text under the bar when determinate */
    showPercent?: boolean;
  }
): Promise<T> {
  const id = opts?.id ?? `progress-${Math.random().toString(36).slice(2)}`;
  const width = opts?.width ?? 280;
  const showPercent = opts?.showPercent ?? true;

  let pct = Math.max(0, Math.min(100, opts?.autoTick?.start ?? 0));
  let label: React.ReactNode = opts?.loading ?? "Processing…";
  let hasExplicitPct = false; // becomes true once progress.set is called

  // When to render determinate:
  // - if autoTick is enabled (we’re synthesizing %), or
  // - if user called progress.set at least once
  const isDeterminate = () => Boolean(opts?.autoTick) || hasExplicitPct;

  const render = () =>
    toast.custom(
      () => (
        <LinearLoader
          label={label}
          value={isDeterminate() ? pct : undefined} // undefined => indeterminate sweep
          width={width}
          showPercent={showPercent}
        />
      ),
      { id, duration: Infinity }
    );

  render();

  // Optional soft progress
  let timer: ReturnType<typeof setInterval> | undefined;
  if (opts?.autoTick) {
    const max = Math.max(0, Math.min(100, opts.autoTick.max ?? 88));
    const step = opts.autoTick.step ?? 2;
    const intervalMs = opts.autoTick.intervalMs ?? 120;
    timer = setInterval(() => {
      pct = Math.min(max, pct + step);
      render();
    }, intervalMs);
  }

  const progress: ProgressReporter = {
    set(next) {
      hasExplicitPct = true;
      pct = Math.max(0, Math.min(100, next));
      render();
    },
    label(next) {
      label = next;
      render();
    },
  };

  const run = Promise.resolve().then(() => work(progress));

  return run
    .then(async (data) => {
      if (timer) clearInterval(timer);
      pct = 100;
      label =
        typeof opts?.success === "function"
          ? await (opts.success as any)(data)
          : opts?.success ?? "Done!";
      render();
      setTimeout(() => toast.dismiss(id), 700);
      return data;
    })
    .catch(async (err) => {
      if (timer) clearInterval(timer);
      // On error we’ll just dismiss and show a standard error toast
      label =
        typeof opts?.error === "function"
          ? await (opts.error as any)(err)
          : opts?.error ?? "Something went wrong";
      // Keep final look briefly, then dismiss + show error
      render();
      setTimeout(() => {
        toast.dismiss(id);
        toast.error(typeof label === "string" ? label : "Error");
      }, 900);
      throw err;
    });
}
