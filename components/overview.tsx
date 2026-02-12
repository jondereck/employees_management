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
   <div className="space-y-6 p-6 bg-white/5 dark:bg-black/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl">
  {years.length > 1 && (
    <div className="flex justify-end">
      <div className="relative group">
        <select
          value={selectedYear}
          onChange={(event) => setSelectedYear(event.target.value)}
          className="appearance-none bg-white/10 dark:bg-white/[0.05] backdrop-blur-md border border-white/20 text-slate-700 dark:text-slate-200 px-4 py-2 pr-10 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer hover:bg-white/20"
        >
          {years.map((year) => (
            <option key={year} value={year} className="bg-slate-900 text-white">
              {year}
            </option>
          ))}
        </select>
        {/* Custom arrow for the liquid look */}
        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none opacity-50">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>
    </div>
  )}

  <div className="relative">
    {/* Subtle background glow behind the chart */}
    <div className="absolute inset-0 bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none" />
    
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={filteredData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
        <defs>
          {/* This creates the 'Liquid' gradient for the line */}
          <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="50%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
        
        {/* Soften the grid or hide it for a cleaner glass look */}
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.05} />
        
        <XAxis 
          dataKey="name" 
          axisLine={false} 
          tickLine={false} 
          stroke="currentColor" 
          opacity={0.4} 
          dy={10}
          style={{ fontSize: '12px', fontWeight: 500 }}
        />
        
        <YAxis 
          axisLine={false} 
          tickLine={false} 
          stroke="currentColor" 
          opacity={0.4} 
          allowDecimals={false} 
          style={{ fontSize: '12px', fontWeight: 500 }}
        />

        <Tooltip
          contentStyle={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.1)', 
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '16px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
          }}
          itemStyle={{ color: '#000000', fontWeight: 'bold' }}
          cursor={{ stroke: 'rgba(99, 102, 241, 0.2)', strokeWidth: 8 }}
        />

        <Line
          type="monotone"
          dataKey="total"
          stroke="url(#lineGradient)"
          strokeWidth={4}
          dot={{ r: 0 }} /* Hide dots for a smoother 'liquid' feel */
          activeDot={{ 
            r: 6, 
            fill: '#6366f1', 
            stroke: '#fff', 
            strokeWidth: 2,
            style: { filter: 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.8))' } 
          }}
          animationDuration={2000}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
</div>
  );
};

export default Overview;
