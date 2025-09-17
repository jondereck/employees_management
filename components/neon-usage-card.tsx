// components/NeonUsageCard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Totals = { date: string; cuHours: number }[];
type Row = { date: string; projectId: string; cuHours: number; activeHours: number };

export default function NeonUsageCard() {
  const [data, setData] = useState<{ totals: Totals; rows: Row[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date();
    const from = new Date(today.getTime() - 13 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const to = today.toISOString().slice(0, 10);

    fetch(`/api/neon/usage?from=${from}&to=${to}&granularity=daily`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const grandTotal = useMemo(
    () => (data?.totals ?? []).reduce((s, d) => s + d.cuHours, 0),
    [data]
  );

  if (loading) {
    return (
      <div className="p-4 rounded-2xl border bg-white shadow-sm">
        <div className="animate-pulse h-6 w-40 bg-gray-200 rounded mb-4" />
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded w-5/6" />
          <div className="h-4 bg-gray-200 rounded w-4/6" />
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="p-4 rounded-2xl border">No data.</div>;
  }

  return (
    <div className="p-4 rounded-2xl border bg-white shadow-sm">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-lg font-semibold">Neon CU-hours (last 14 days)</h2>
        <div className="text-sm text-gray-500">Total: {grandTotal.toFixed(2)} CU-hrs</div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-gray-600">
            <tr>
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Project</th>
              <th className="py-2 pr-4">CU-hours</th>
              <th className="py-2 pr-4">Active hours</th>
            </tr>
          </thead>
          <tbody>
            {(data.rows ?? [])
              .sort((a, b) => a.date.localeCompare(b.date) || a.projectId.localeCompare(b.projectId))
              .map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="py-2 pr-4 font-medium">{r.date}</td>
                  <td className="py-2 pr-4">{r.projectId}</td>
                  <td className="py-2 pr-4">{r.cuHours.toFixed(2)}</td>
                  <td className="py-2 pr-4">{r.activeHours.toFixed(2)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        CU-hours = compute_time_seconds / 3600 (from Neon consumption metrics). Billing multiplies CU-hours by your
        plan’s price per CU-hour. See Neon docs. 
      </p>
    </div>
  );
}
