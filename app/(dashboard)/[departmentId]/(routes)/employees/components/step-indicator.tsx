"use client";

import { useMemo } from "react";

interface StepIndicatorProps {
  dateHired?: string | number | Date; // Accept string, number, or Date
  latestAppointment?: string | number | Date; // optional latest appointment date
  maxStep?: number;
}

export function StepIndicator({
  dateHired,
  latestAppointment,
  maxStep = 32,
}: StepIndicatorProps) {
  const currentStep = useMemo(() => {
    const startDateRaw = latestAppointment || dateHired;
    if (!startDateRaw) return 1;

    // Convert to Date object
    const startDate = startDateRaw instanceof Date ? startDateRaw : new Date(startDateRaw);

    console.log("Raw start date:", startDateRaw);
    console.log("Parsed startDate:", startDate);

    const currentYear = new Date().getFullYear();
    const yearsWorked = currentYear - startDate.getFullYear();
    const stepIncrease = Math.floor(yearsWorked / 3); // every 3 years -> step up

    console.log("Years worked:", yearsWorked, "Step increase:", stepIncrease);

    return Math.min(stepIncrease + 1, maxStep); // start at step 1
  }, [dateHired, latestAppointment, maxStep]);

  return (
    <div className="text-sm font-medium text-gray-700">
      Step {currentStep}
    </div>
  );
}
