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
    <div className="grid lg:grid-cols-3 grid-cols-1 gap-4">
      {/* Salary Grade */}

      <FormField
        control={form.control}
        name="salaryGrade"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Salary Grade <span className="text-red-500 align-top">*</span></FormLabel>
            <FormControl>
              <Input
                disabled={loading}
                inputMode="numeric"
                placeholder="Enter Salary Grade"
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ""))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Current Step */}
      <div className="flex flex-col">
        <label className="text-sm font-medium mb-2">Current Step</label>
        <div className="h-10 px-3 rounded-md border flex items-center bg-muted/30">
          Step {currentStep}
        </div>
      </div>

      {/* Salary (Auto / Manual) */}
      <FormField
        control={form.control}
        name="salary"
        render={({ field }) => {
          const isManual = manual;
          return (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Salary</FormLabel>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs", isManual ? "text-amber-600" : "text-muted-foreground")}>
                    {isManual ? "MANUAL" : "AUTO"}
                  </span>
<Switch
  checked={manual}
  onCheckedChange={(v) => {
    form.setValue("salaryMode", v ? "MANUAL" : "AUTO", { shouldDirty: true });

    if (!v) {
      // switching back to AUTO
      form.setValue("salary", autoSalary, { shouldValidate: true });
    }
  }}
/>


                </div>
              </div>

              <FormControl>
                {isManual ? (
                  <Input
                    inputMode="decimal"
                    placeholder="Enter Salary"
                    value={String(field.value ?? "")}
                    onChange={onManualChange}
                    onBlur={onManualBlur}
                    disabled={loading}
                  />
                ) : (
                  <Input
                    disabled
                    readOnly
                    value={
                      fetching
                        ? "Loading…"
                        : autoAvailable
                        ? formatPeso(field.value ?? autoSalary)
                        : ""
                    }
                  />
                )}
              </FormControl>
              <FormMessage />
            </FormItem>
          );
        }}
      />
    </div>
  );
}
