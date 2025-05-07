"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

interface ClientEmployeeChangeProps {
  departmentId: string;
  currentTotal: number;
}

const ClientEmployeeChange = ({ departmentId, currentTotal }: ClientEmployeeChangeProps) => {
  const [previousTotal, setPreviousTotal] = useState<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(`${departmentId}-previousTotal`);
    if (stored) {
      setPreviousTotal(parseInt(stored));
    }

    // Save new currentTotal as the latest
    localStorage.setItem(`${departmentId}-previousTotal`, currentTotal.toString());
  }, [departmentId, currentTotal]);

  if (previousTotal === null || previousTotal === 0) return null;

  const change = currentTotal - previousTotal;
  const percentChange = Math.round((change / previousTotal) * 100);

  const Icon = change >= 0 ? ArrowUp : ArrowDown;
  const color = change >= 0 ? "text-green-600" : "text-red-600";

  return (
    <div className={`flex items-center space-x-1 ${color}`}>
      <Icon className="w-4 h-4 animate-bounce" />
      <span className="text-sm">{Math.abs(percentChange)}%</span>
    </div>
  );
};

export default ClientEmployeeChange;
