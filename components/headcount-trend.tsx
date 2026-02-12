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
    <defs>
      {series.map((key, index) => {
        const color = COLORS[index % COLORS.length];
        return (
          <linearGradient key={`gradient-${key}`} id={`color${key}`} x1="0" y1="0" x2="0" y2="1">
            {/* Top of the area: bright and glowing */}
            <stop offset="0%" stopColor={color} stopOpacity={0.6} />
            {/* Middle: transitioning to translucency */}
            <stop offset="40%" stopColor={color} stopOpacity={0.2} />
            {/* Bottom: nearly transparent to show the "glass" underneath */}
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        );
      })}
    </defs>

    {/* Horizontal grid lines only, very faint */}
    <CartesianGrid vertical={false} stroke="currentColor" opacity={0.05} strokeDasharray="4 4" />
    
    <XAxis 
      dataKey="name" 
      axisLine={false} 
      tickLine={false} 
      tick={{ fill: 'currentColor', opacity: 0.4, fontSize: 11, fontWeight: 600 }} 
      dy={10}
    />
    
    <YAxis 
      axisLine={false} 
      tickLine={false} 
      tick={{ fill: 'currentColor', opacity: 0.4, fontSize: 11 }} 
      allowDecimals={false} 
    />

    <Tooltip
      contentStyle={{ 
        backgroundColor: 'rgba(15, 23, 42, 0.3)', // Darker translucent for contrast
        backdropFilter: 'blur(20px) saturate(200%)',
        WebkitBackdropFilter: 'blur(20px) saturate(200%)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '18px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
      }}
      itemStyle={{ fontSize: '12px', padding: '2px 0' }}
      cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 3 }}
    />
    
    <Legend 
      verticalAlign="top" 
      align="right" 
      iconType="circle"
      iconSize={8}
      wrapperStyle={{ paddingBottom: '20px', fontSize: '12px', opacity: 0.7 }}
    />

    {series.map((key, index) => (
      <Area
        key={key}
        type="monotone"
        dataKey={key}
        stackId="total"
        stroke={COLORS[index % COLORS.length]}
        strokeWidth={3}
        fillOpacity={1}
        fill={`url(#color${key})`}
        strokeLinecap="round"
        // Making the area feel "Liquid" by removing hard dots
        dot={false}
        activeDot={{ 
          r: 6, 
          stroke: '#fff', 
          strokeWidth: 2,
          fill: COLORS[index % COLORS.length],
          style: { filter: `drop-shadow(0 0 10px ${COLORS[index % COLORS.length]})` }
        }}
        // Smooth entrance animation
        animationBegin={index * 150}
        animationDuration={1500}
        animationEasing="ease-in-out"
      />
    ))}
  </AreaChart>
</ResponsiveContainer>
  );
};

export default HeadcountTrend;

