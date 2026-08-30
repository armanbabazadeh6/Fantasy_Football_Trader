"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WeekPoints } from "@/types";

export function WeeklyChart({ weeks, ppg }: { weeks: WeekPoints[]; ppg: number }) {
  const data = weeks.map((week) => ({ name: `W${week.week}`, pts: week.pts }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={{ stroke: "#1e293b" }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "8px",
              fontSize: 12,
            }}
            labelStyle={{ color: "#94a3b8" }}
            cursor={{ fill: "rgba(148,163,184,0.08)" }}
          />
          <ReferenceLine y={ppg} stroke="#a3e635" strokeDasharray="4 4" strokeOpacity={0.6} />
          <Bar dataKey="pts" fill="#a3e635" radius={[3, 3, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
