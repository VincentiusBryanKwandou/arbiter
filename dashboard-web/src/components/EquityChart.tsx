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

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        padding: "8px 12px",
        fontSize: "12px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
      }}
    >
      <div style={{ color: "var(--text-3)", marginBottom: "3px", fontSize: "11px" }}>{label}</div>
      <div className="mono" style={{ color: "var(--accent)", fontWeight: 600 }}>
        ${payload[0]?.value?.toFixed(2)}
      </div>
    </div>
  );
}

export function EquityChart({ data }: { data: EquityPoint[] }) {
  if (!data.length) {
    return (
      <div
        style={{
          height: "180px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          color: "var(--text-3)",
          fontSize: "12px",
        }}
      >
        <span>No equity data yet.</span>
        <span className="mono" style={{ fontSize: "11px", color: "var(--text-4)" }}>
          python -m paper.loop --once
        </span>
      </div>
    );
  }

  const isProfit = data[data.length - 1].equity >= data[0].equity;
  const color = isProfit ? "var(--success)" : "var(--danger)";
  const colorHex = isProfit ? "#10b981" : "#ef4444";

  const formatted = data.map((d, i) => ({ ...d, label: `#${i + 1}` }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={formatted} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colorHex} stopOpacity={0.25} />
            <stop offset="95%" stopColor={colorHex} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2f4d" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "#6b7280", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
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
          stroke={color}
          strokeWidth={1.5}
          fill="url(#eq)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
