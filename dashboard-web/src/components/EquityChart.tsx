"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { EquityPoint } from "@/types";

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        backgroundColor: "#1a2234",
        border: "1px solid #1f2d45",
        borderRadius: "8px",
        padding: "10px 14px",
        fontSize: "12px",
      }}
    >
      <div style={{ color: "#6b7280", marginBottom: "4px" }}>{label}</div>
      <div style={{ color: "#3b82f6", fontFamily: "monospace" }}>
        Equity: ${payload[0]?.value?.toFixed(2)}
      </div>
    </div>
  );
};

export function EquityChart({ data }: { data: EquityPoint[] }) {
  if (!data.length) {
    return (
      <div
        style={{
          height: "180px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#6b7280",
          fontSize: "13px",
        }}
      >
        No equity data yet. Run: python -m paper.loop --once
      </div>
    );
  }

  const isProfit =
    data[data.length - 1].equity >= data[0].equity;
  const formatted = data.map((d, i) => ({
    ...d,
    label: `#${i + 1}`,
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={formatted} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={isProfit ? "#10b981" : "#ef4444"} stopOpacity={0.3} />
            <stop offset="95%" stopColor={isProfit ? "#10b981" : "#ef4444"} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2d45" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fill: "#6b7280", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${v.toFixed(0)}`}
          width={55}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="equity"
          stroke={isProfit ? "#10b981" : "#ef4444"}
          strokeWidth={1.5}
          fill="url(#eq)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
