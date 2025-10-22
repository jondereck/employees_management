'use client';

import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

type OverviewPoint = {
  name: string; // e.g. "Jan 2024"
  total: number;
};

type OverviewProps = {
  data: OverviewPoint[];
};

const Overview = ({ data }: OverviewProps) => {
  const years = useMemo(
    () =>
      Array.from(
        new Set(
          data
            .map((point) => point.name.split(' ')[1])
            .filter((year): year is string => Boolean(year))
        )
      ).sort(),
    [data]
  );

  const [selectedYear, setSelectedYear] = useState<string>(years[years.length - 1] ?? '');

  const filteredData = useMemo(() => {
    if (!selectedYear) return data;
    return data.filter((point) => point.name.endsWith(selectedYear));
  }, [data, selectedYear]);

  return (
    <div className="space-y-4">
      {years.length > 1 && (
        <div className="flex justify-end">
          <select
            value={selectedYear}
            onChange={(event) => setSelectedYear(event.target.value)}
            className="rounded border px-3 py-2 text-sm"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      )}

      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={filteredData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" stroke="#888888" />
          <YAxis stroke="#888888" allowDecimals={false} />
          <Tooltip
            contentStyle={{ backgroundColor: 'white', borderRadius: '8px' }}
            cursor={{ stroke: '#6366f1', strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="total"
            stroke="#4f46e5"
            strokeWidth={3}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default Overview;
