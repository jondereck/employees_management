'use client';

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import type { HeadcountTrendPoint } from '@/actions/get-headcount-trend';

type HeadcountTrendProps = {
  data: HeadcountTrendPoint[];
  series: string[];
};

const COLORS = [
  '#4f46e5', // Indigo
  '#22c55e', // Green
  '#ec4899', // Pink
  '#f97316', // Orange
  '#06b6d4', // Cyan
  '#a855f7', // Purple
  '#facc15', // Amber
  '#ef4444', // Red
];

const HeadcountTrend = ({ data, series }: HeadcountTrendProps) => {
  if (!data.length || !series.length) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No headcount activity found for the selected department.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <AreaChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" stroke="#888888" />
        <YAxis stroke="#888888" allowDecimals={false} />
        <Tooltip
          contentStyle={{ backgroundColor: 'white', borderRadius: '8px' }}
          cursor={{ stroke: '#6366f1', strokeWidth: 2 }}
        />
        <Legend />
        {series.map((key, index) => (
          <Area
            key={key}
            type="monotone"
            dataKey={key}
            stackId="total"
            stroke={COLORS[index % COLORS.length]}
            fill={COLORS[index % COLORS.length]}
            fillOpacity={0.35}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default HeadcountTrend;

