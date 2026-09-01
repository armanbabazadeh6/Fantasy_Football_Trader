"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function CompareChart({
  data,
  aName,
  bName,
}: {
  data: Record<string, number | string | null>[];
  aName: string;
  bName: string;
}) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "#1e293b" }} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", fontSize: 12 }}
            labelStyle={{ color: "#94a3b8" }}
          />
          <Line type="monotone" dataKey={aName} stroke="#a3e635" strokeWidth={2} dot={{ r: 2, fill: "#a3e635" }} connectNulls />
          <Line type="monotone" dataKey={bName} stroke="#fb7185" strokeWidth={2} dot={{ r: 2, fill: "#fb7185" }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
