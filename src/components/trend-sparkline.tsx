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

export function TrendSparkline({
  data,
}: {
  data: { date: string; score: number }[];
}) {
  if (data.length < 2) return null;
  const points = data.map((point) => ({
    name: point.date.slice(5),
    score: point.score,
  }));
  const up = points[points.length - 1].score >= points[0].score;
  return (
    <div className="h-24 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, left: -28, bottom: 0 }}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis domain={["dataMin - 2", "dataMax + 2"]} tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "8px",
              fontSize: 12,
            }}
            labelStyle={{ color: "#94a3b8" }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke={up ? "#a3e635" : "#fb7185"}
            strokeWidth={2}
            dot={{ r: 2, fill: up ? "#a3e635" : "#fb7185" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
