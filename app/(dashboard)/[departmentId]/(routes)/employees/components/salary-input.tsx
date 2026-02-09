"use client";

import { useEffect, useMemo, useState } from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import axios from "axios";
import { toast } from "sonner";
import { computeStep } from "@/utils/compute-step";
import { Switch } from "@/components/ui/switch"; // shadcn switch (or use Checkbox)
import { cn } from "@/lib/utils";

interface SalaryInputProps {
  form: any; // UseFormReturn<EmployeesFormValues>
  loading: boolean;
  maxStep?: number; // 8 or 32
}

export function SalaryInput({ form, loading, maxStep = 8 }: SalaryInputProps) {
  const sg = form.watch("salaryGrade");
  const dateHired = form.watch("dateHired");
  const latestAppointment = form.watch("latestAppointment");

  const currentStep = useMemo(
    () => computeStep({ dateHired, latestAppointment, maxStep }),
    [dateHired, latestAppointment, maxStep]
  );

  const [fetching, setFetching] = useState(false);
  const [salarySteps, setSalarySteps] = useState<Record<number, number>>({});

  const [fetchError, setFetchError] = useState<string | null>(null); // track 
  // fetch errors
  const [hasFetched, setHasFetched] = useState(false);
  const salaryMode = form.watch("salaryMode");
  const manual = salaryMode === "MANUAL";


  const isHydrated = form.formState.isDirty || form.formState.isSubmitted;

  useEffect(() => {
    form.register("salaryMode");
    form.register("salaryStep");
  }, [form]);

  useEffect(() => {
    const current = form.getValues("salaryStep");
    if (current !== currentStep) {
      form.setValue("salaryStep", currentStep);
    }
  }, [currentStep, form]);

  // fetch salary table by SG
 useEffect(() => {
  const fetchSalarySteps = async () => {
    const sgNum = Number(sg);
    if (!sgNum || Number.isNaN(sgNum)) {
      setSalarySteps({});
      setFetchError(null);
      setHasFetched(false);        // ❗ reset when SG not valid
      return;
    }

    setFetching(true);
    setFetchError(null);
    try {
      const res = await axios.get("/api/departments/salary/", { params: { sg: sgNum } });
      setSalarySteps(res.data.steps ?? {});
    } catch (e) {
      setSalarySteps({});
      setFetchError("Failed to fetch salary data.");
      toast.error("Failed to fetch salary data.");
    } finally {
      setFetching(false);
      setHasFetched(true);         // ✅ fetch cycle completed
    }
  };

  fetchSalarySteps();
}, [sg]);


  // computed from fetched steps
  const autoSalary = useMemo(() => {
    return salarySteps[currentStep] ?? 0;
  }, [salarySteps, currentStep]);

  // whether automatic value is available
  const autoAvailable = !!autoSalary && !Number.isNaN(autoSalary);


  const safeStep = Math.max(1, currentStep || 1);

useEffect(() => {
  const current = form.getValues("salaryStep");
  if (current !== safeStep) {
    form.setValue("salaryStep", safeStep, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }
}, [safeStep, form]);


  useEffect(() => {
    if (salaryMode === "AUTO") {
      form.setValue("salary", autoSalary, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  }, [autoSalary, form, salaryMode]);


  // formatting helpers
  const formatPeso = (n: number | string) => {
    const v = Number(n || 0);
    if (!Number.isFinite(v)) return "";
    return `₱ ${new Intl.NumberFormat().format(v)}`;
  };
  const parseNumber = (s: string) => {
    // strip currency symbols, commas, spaces
    const clean = s.replace(/[₱,\s]/g, "");
    const n = Number(clean);
    return Number.isFinite(n) ? n : 0;
  };

  // Manual input value handlers (avoid reformat while typing)
  const salaryValue = form.watch("salary");

  const onManualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // permit digits + dot; block letters
    const cleaned = raw.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
    // don’t format here to keep caret stable
    form.setValue("salary", cleaned === "" ? 0 : Number(cleaned), { shouldDirty: true });
  };

  const onManualBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const n = parseNumber(String(e.target.value));
    form.setValue("salary", n, { shouldValidate: true, shouldDirty: true });
  };

  return (
 <div className="grid lg:grid-cols-3 grid-cols-1 gap-6 items-start">
  {/* 1. Salary Grade */}
  <FormField
    control={form.control}
    name="salaryGrade"
    render={({ field }) => (
      <FormItem className="space-y-1.5">
        <FormLabel className="text-[13px] font-medium">
          Salary Grade {<span className="text-destructive/70">*</span>}
        </FormLabel>
        <FormControl>
          <div className="relative group">
  {/* LEFT PREFIX */}
  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2
                  text-[10px] font-bold tracking-widest
                  text-muted-foreground/40
                  group-focus-within:text-primary/50
                  transition-colors">
    S.G.
  </div>

  <Input
    className="h-9 pl-10 transition-all focus-visible:ring-1" // 👈 KEY CHANGE
    disabled={loading}
    inputMode="numeric"
    placeholder="e.g. 15"
    value={field.value ?? ""}
    onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ""))}
  />
</div>

        </FormControl>
        <FormMessage className="text-[11px]" />
      </FormItem>
    )}
  />

  {/* 2. Current Step (Refined as a 'Read-Only' Info Box) */}
  <div className="space-y-1.5">
    <label className="text-[13px] font-medium text-foreground/90">Current Step</label>
    <div className="h-9 px-3 rounded-md border border-dashed border-muted-foreground/20 bg-muted/20 flex items-center justify-between">
      <span className="text-sm font-semibold tabular-nums">Step {currentStep}</span>
      <div className="h-2 w-2 rounded-full bg-blue-500/50 animate-pulse" />
    </div>
  </div>

  {/* 3. Salary (Auto / Manual) */}
  <FormField
    control={form.control}
    name="salary"
    render={({ field }) => {
      const isManual = manual;
      return (
        <FormItem className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 bg-muted/40 px-2 py-0.5 rounded-full border border-border/50">
              <span className={cn(
                "text-[9px] font-bold tracking-tighter transition-colors", 
                isManual ? "text-amber-600" : "text-primary"
              )}>
                {isManual ? "MANUAL" : "AUTO-CALC"}
              </span>
              <Switch
                className="scale-75 origin-right" // Make switch smaller for minimal look
                checked={manual}
                onCheckedChange={(v) => {
                  form.setValue("salaryMode", v ? "MANUAL" : "AUTO", { shouldDirty: true });
                  if (!v) form.setValue("salary", autoSalary, { shouldValidate: true });
                }}
              />
            </div>
          </div>

          <FormControl>
            <div className="relative group">
              <Input
                className={cn(
                  "h-9 font-mono transition-all pr-12",
                  isManual 
                    ? "border-amber-200 focus:ring-amber-500/20" 
                    : "bg-primary/[0.03] border-primary/10 text-primary font-bold italic shadow-none cursor-default"
                )}
                inputMode="decimal"
                placeholder="0.00"
                value={
                  fetching ? "Loading…" : 
                  isManual ? field.value : 
                  autoAvailable ? formatPeso(field.value ?? autoSalary) : "—"
                }
                onChange={onManualChange}
                onBlur={onManualBlur}
                disabled={loading || !isManual}
                readOnly={!isManual}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold opacity-30">
                PHP
              </span>
            </div>
          </FormControl>
          <FormMessage className="text-[11px]" />
        </FormItem>
      );
    }}
  />
</div>
  );
}
