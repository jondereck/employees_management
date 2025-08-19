"use client";

import { useEffect, useMemo, useState } from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import axios from "axios";
import { toast } from "sonner";
import { computeStep } from "@/utils/compute-step";

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

  useEffect(() => {
    const fetchSalarySteps = async () => {
      const sgNum = Number(sg);
      if (!sgNum || Number.isNaN(sgNum)) return;

      setFetching(true);
      try {
        const res = await axios.get("/api/departments/salary/", { params: { sg: sgNum } });
        setSalarySteps(res.data.steps);
      } catch (e) {
        toast.error("Failed to fetch salary data.");
        setSalarySteps({});
      } finally {
        setFetching(false);
      }
    };

    fetchSalarySteps();
  }, [sg]);

  // Compute current salary from fetched steps
  const currentSalary = useMemo(() => {
    return salarySteps[currentStep] ?? 0;
  }, [salarySteps, currentStep]);

  // Update form whenever currentSalary changes
  useEffect(() => {
    form.setValue("salary", currentSalary, { shouldValidate: true, shouldDirty: true });
  }, [currentSalary, form]);

  return (
    <div className="grid lg:grid-cols-3 grid-cols-1 gap-4">
      {/* Salary Grade */}
      <FormField
        control={form.control}
        name="salaryGrade"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Salary Grade</FormLabel>
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

      {/* Salary */}
      <FormField
        control={form.control}
        name="salary"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Salary</FormLabel>
            <FormControl>
              <Input
                disabled
                value={
                  field.value
                    ? `₱ ${new Intl.NumberFormat().format(Number(field.value))}`
                    : fetching
                    ? "Loading…"
                    : ""
                }
                readOnly
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
