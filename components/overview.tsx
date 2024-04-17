"use client";

import { Bar, BarChart, LabelList, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";


interface OverviewProps {
  data: any[];
};

const Overview = ({
  data,
}: OverviewProps) => {
  return (
    <ResponsiveContainer width="100%" height={350} >
      <BarChart data={data}>
        <XAxis
          dataKey="name"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          dataKey="total"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}`}
        />
       
         <Tooltip />
        <Bar dataKey="total" fill="#3498db" radius={[4, 4, 0, 0]} />
        <LabelList dataKey="total" position="top"/>
      </BarChart>

    </ResponsiveContainer>
  );
}

export default Overview;