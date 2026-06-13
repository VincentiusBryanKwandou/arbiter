import { Suspense } from "react";
import { fetchDashboard } from "@/lib/api";
import { MetricCard } from "@/components/MetricCard";

export const revalidate = 30;

const LIMITS = {
  kelly_fraction: 0.25,
  max_per_trade_pct: 0.02,
  max_per_market_pct: 0.05,
  max_open_positions: 5,
  daily_loss_limit_pct: 0.10,
};

async function RiskContent() {
  const { stats } = await fetchDashboard();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 600 }}>Risk Monitor</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px" }}>
        <MetricCard
          label="Daily Loss"
          value={`${(stats.daily_loss_pct * 100).toFixed(2)}%`}
          subValue={`Limit: ${(LIMITS.daily_loss_limit_pct * 100).toFixed(0)}%`}
          highlight={stats.daily_loss_pct > 0.08 ? "danger" : stats.daily_loss_pct > 0.05 ? "warning" : "success"}
        />
        <MetricCard
          label="Open Positions"
          value={`${stats.open_positions} / ${LIMITS.max_open_positions}`}
          highlight={stats.open_positions >= LIMITS.max_open_positions ? "danger" : "neutral"}
        />
        <MetricCard
          label="Kill Switch"
          value={stats.kill_switch_active ? "ACTIVE" : "OK"}
          highlight={stats.kill_switch_active ? "danger" : "success"}
        />
        <MetricCard
          label="Kelly Fraction"
          value="25%"
          subValue="Quarter-Kelly (4× conservative)"
          highlight="neutral"
        />
      </div>

      <div
        style={{
          backgroundColor: "#1a2234",
          border: "1px solid #1f2d45",
          borderRadius: "12px",
          padding: "16px",
        }}
      >
        <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "16px", fontWeight: 500 }}>
          Hard Limits (from config/settings.yaml)
        </div>
        {Object.entries(LIMITS).map(([k, v]) => (
          <div
            key={k}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 0",
              borderBottom: "1px solid rgba(31,45,69,0.5)",
            }}
          >
            <span style={{ fontSize: "13px", color: "#94a3b8", fontFamily: "monospace" }}>{k}</span>
            <span style={{ fontSize: "13px", fontFamily: "monospace", color: "#3b82f6" }}>
              {typeof v === "number" ? v : String(v)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RiskPage() {
  return (
    <Suspense fallback={<p style={{ color: "#6b7280", fontSize: "13px" }}>Loading risk data…</p>}>
      <RiskContent />
    </Suspense>
  );
}
