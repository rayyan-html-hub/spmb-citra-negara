"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const documentColors = ["#16A34A", "#86EFAC", "#FACC15"];

export function RegistrationTrendChart({
  data,
}: {
  data: { day: string; count: number }[];
}) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart
          data={data}
          margin={{ top: 16, right: 12, bottom: 0, left: 0 }}
        >
          <CartesianGrid
            stroke="#E2E8F0"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            axisLine={false}
            dataKey="day"
            tick={{ fill: "#64748B", fontSize: 12 }}
            tickLine={false}
          />
          <YAxis hide />
          <Tooltip
            contentStyle={{
              border: "1px solid #E2E8F0",
              borderRadius: 12,
              fontSize: 12,
            }}
            formatter={(value) => [value ?? 0, "Pendaftar"]}
          />
          <Bar
            dataKey="count"
            fill="#16A34A"
            label={{ position: "top", fill: "#0F172A", fontSize: 12 }}
            maxBarSize={48}
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DocumentStatusChart({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  return (
    <div className="h-[184px] w-[184px] shrink-0">
      <ResponsiveContainer height="100%" width="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={56}
            outerRadius={78}
            paddingAngle={1}
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell fill={documentColors[index]} key={entry.name} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              border: "1px solid #E2E8F0",
              borderRadius: 12,
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
