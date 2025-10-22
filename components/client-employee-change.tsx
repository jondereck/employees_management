"use client";

import { ArrowDown, ArrowUp } from "lucide-react";

interface ClientEmployeeChangeProps {
  currentCount: number;
  previousCount: number;
  label?: string;
}

const ClientEmployeeChange = ({
  currentCount,
  previousCount,
  label = "employees added or updated",
}: ClientEmployeeChangeProps) => {
  if (currentCount === 0 && previousCount === 0) {
    return (
      <p className="mt-1 text-xs text-muted-foreground">
        No {label} in the last two months.
      </p>
    );
  }

  if (previousCount === 0) {
    return (
      <p className="mt-1 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{currentCount}</span> {label} this month.
      </p>
    );
  }

  const change = currentCount - previousCount;
  const percentChange = Math.round((Math.abs(change) / previousCount) * 100);
  const isIncrease = change >= 0;
  const Icon = isIncrease ? ArrowUp : ArrowDown;
  const tone = isIncrease ? "text-green-600" : "text-red-600";
  const descriptor = isIncrease ? "more" : "fewer";

  return (
    <div className="mt-1 text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">{currentCount}</span> {label} this month{" "}
      <span className={`inline-flex items-center gap-1 font-medium ${tone}`}>
        <Icon className="h-3 w-3" />
        {percentChange}% {descriptor} than last month
      </span>
    </div>
  );
};

export default ClientEmployeeChange;
