"use client";

import { useEffect, useState } from "react";
import Overview from "@/components/overview";

interface GraphData {
  name: string;
  total: number;
}

export default function OverviewWithFilter({ departmentId }: { departmentId: string }) {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [data, setData] = useState<GraphData[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch("/api/graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departmentId, year }),
      });
      const result = await res.json();
      setData(result);
    };
  
    fetchData();
  }, [year, departmentId]);
  

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="border rounded px-3 py-2 text-sm"
        >
          {[2022, 2023, 2024, 2025].map((yr) => (
            <option key={yr} value={yr}>
              {yr}
            </option>
          ))}
        </select>
      </div>

      <Overview data={data} />
    </div>
  );
}
