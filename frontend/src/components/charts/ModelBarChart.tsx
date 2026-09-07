"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

const BAR_COLORS = ["#00f0ff", "#ffb800", "#a855f7", "#64748b"];

export default function ModelBarChart({
  data,
  dataKey,
  label,
}: {
  data: { model: string; value: number }[];
  dataKey?: string;
  label: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#22252e" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="model" tick={{ fill: "#94a3b8", fontSize: 11 }} />
        <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} label={{ value: label, angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 11 }} />
        <Tooltip
          contentStyle={{
            background: "rgba(16, 17, 21, 0.95)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 8,
            fontSize: 12,
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(0, 240, 255, 0.05)",
          }}
          labelStyle={{ color: "#f8fafc", fontFamily: "var(--font-jetbrains-mono)" }}
        />
        <Bar dataKey={dataKey ?? "value"} radius={[6, 6, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
