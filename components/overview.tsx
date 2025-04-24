'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface OverviewProps {
  data: {
    name: string;   // Month name
    total: number;  // Employee count
  }[];
}

const Overview = ({ data }: OverviewProps) => {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart
        data={data}
        margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" stroke="#888888" />
        <YAxis stroke="#888888" allowDecimals={false} />
        <Tooltip
          contentStyle={{ backgroundColor: 'white', borderRadius: '8px' }}
          cursor={{ stroke: '#6366f1', strokeWidth: 2 }}
        />
        <Line
          type="monotone"
          dataKey="total" // ✅ Matches your `getGraph` return type
          stroke="#4f46e5" // Tailwind Indigo-600
          strokeWidth={3}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default Overview;
