import { Suspense } from "react";
import { fetchDashboard } from "@/lib/api";
import { MetricCard } from "@/components/MetricCard";

export const dynamic = "force-dynamic";

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
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text)", marginBottom: "3px" }}>
          Risk Monitor
        </h2>
        <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
          Real-time risk limits · Quarter-Kelly · Max 2% per trade
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
        <MetricCard
          label="Daily Loss"
          value={`${(stats.daily_loss_pct * 100).toFixed(2)}%`}
          subValue={`Limit: ${(LIMITS.daily_loss_limit_pct * 100).toFixed(0)}%`}
          highlight={
            stats.daily_loss_pct > 0.08 ? "danger" :
            stats.daily_loss_pct > 0.05 ? "warning" :
            "success"
          }
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
          subValue="4x conservative"
          highlight="neutral"
        />
      </div>

      <div className="card">
        <div className="label" style={{ marginBottom: "16px" }}>
          Hard Limits — config/settings.yaml
        </div>
        {Object.entries(LIMITS).map(([k, v], i, arr) => (
          <div
            key={k}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "11px 0",
              borderBottom: i < arr.length - 1 ? "1px solid var(--border-subtle)" : undefined,
            }}
          >
            <span className="mono" style={{ fontSize: "12px", color: "var(--text-2)" }}>{k}</span>
            <span className="mono" style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 600 }}>
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
    <Suspense
      fallback={
        <div style={{ padding: "48px", textAlign: "center", color: "var(--text-3)", fontSize: "12px" }}>
          Loading risk data…
        </div>
      }
    >
      <RiskContent />
    </Suspense>
  );
}
