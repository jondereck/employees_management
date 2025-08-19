"use client";

import { useState, useEffect } from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import axios from "axios";

interface SalaryInputProps {
  form: any; // react-hook-form instance
  loading: boolean;
  dateHired?: string | number | Date;
  latestAppointment?: string | number | Date;
  maxStep?: number;
}

export const SalaryInput = ({
  form,
  loading,
  dateHired,
  latestAppointment,
  maxStep = 32,
}: SalaryInputProps) => {
  const [salary, setSalary] = useState<number | null>(null);

  // Compute step based on latestAppointment or dateHired
  const computeStep = () => {
    const startDateRaw = latestAppointment || dateHired;
    if (!startDateRaw) return 1;

    const startDate = startDateRaw instanceof Date ? startDateRaw : new Date(startDateRaw);

    const currentYear = new Date().getFullYear();
    const yearsWorked = currentYear - startDate.getFullYear();
    const stepIncrease = Math.floor(yearsWorked / 3); // every 3 years -> step up

    return Math.min(stepIncrease + 1, maxStep);
  };

  const handleSalaryGradeChange = async (sgValue: number) => {
    const step = computeStep();

    try {
      const res = await axios.get(`/api/departments/salary`, {
        params: { sg: sgValue, step },
      });

      const fetchedSalary = res.data.salary;
      setSalary(fetchedSalary);

      form.setValue("salaryGrade",  String(sgValue));
      form.setValue("salary", fetchedSalary);
    } catch (err) {
      console.error("Failed to fetch salary:", err);
      setSalary(null);
      form.setValue("salary", null);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 grid-cols-1 gap-4">
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
                placeholder="Enter Salary Grade"
                {...field}
                type="number"
                min={1}
                max={32}
                onChange={(e) => {
                  const sgValue = Number(e.target.value);
                  field.onChange(sgValue);
                  handleSalaryGradeChange(sgValue);
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

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
                placeholder="Salary"
                {...field}
                value={salary ? `${new Intl.NumberFormat().format(salary)}` : ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};
