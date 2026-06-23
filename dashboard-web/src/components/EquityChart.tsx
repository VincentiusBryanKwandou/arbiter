"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import type { EquityPoint } from "@/types";

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value ?? 0;
  return (
    <div
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        padding: "8px 12px",
        fontSize: "12px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      }}
    >
      {label && (
        <div style={{ color: "var(--text-3)", marginBottom: "4px", fontSize: "10px" }}>
          {label}
        </div>
      )}
      <div className="mono" style={{ color: "var(--accent)", fontWeight: 600, fontSize: "13px" }}>
        ${val.toFixed(2)}
      </div>
    </div>
  );
}

function formatLabel(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return "";
  }
}

export function EquityChart({ data }: { data: EquityPoint[] }) {
  if (!data?.length) {
    return (
      <div
        style={{
          height: "220px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          color: "var(--text-3)",
          fontSize: "12px",
          textAlign: "center",
        }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}>
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
        <span style={{ color: "var(--text-3)" }}>Equity curve builds as paper trades execute.</span>
        <code className="mono" style={{ fontSize: "10px", color: "var(--text-4)", backgroundColor: "var(--border-subtle)", padding: "3px 8px", borderRadius: "4px" }}>
          GitHub Actions runs scanner every 5 min
        </code>
      </div>
    );
  }

  const baseline = data[0].equity;
  const last = data[data.length - 1].equity;
  const isProfit = last >= baseline;
  const colorHex = isProfit ? "#10b981" : "#ef4444";

  const formatted = data.map((d) => ({
    ...d,
    label: formatLabel(d.date),
  }));

  const minVal = Math.min(...data.map((d) => d.equity));
  const maxVal = Math.max(...data.map((d) => d.equity));
  const padding = (maxVal - minVal) * 0.1 || 10;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={formatted} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="eq-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colorHex} stopOpacity={0.2} />
            <stop offset="100%" stopColor={colorHex} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 4" stroke="rgba(30,47,77,0.8)" vertical={false} />
        <ReferenceLine y={baseline} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
        <XAxis
          dataKey="label"
          tick={{ fill: "#556a8a", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: "#556a8a", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${v.toFixed(0)}`}
          width={58}
          domain={[minVal - padding, maxVal + padding]}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }} />
        <Area
          type="monotone"
          dataKey="equity"
          stroke={colorHex}
          strokeWidth={2}
          fill="url(#eq-gradient)"
          dot={false}
          activeDot={{ r: 4, fill: colorHex, stroke: "var(--surface)", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
