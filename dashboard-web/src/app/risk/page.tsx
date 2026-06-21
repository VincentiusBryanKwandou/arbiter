import { Suspense } from "react";
import { fetchDashboard } from "@/lib/api";
import { MetricCard } from "@/components/MetricCard";

export const dynamic = "force-dynamic";

const LIMITS = {
  kelly_fraction:       0.25,
  max_per_trade_pct:    0.02,
  max_per_market_pct:   0.05,
  max_open_positions:   5,
  daily_loss_limit_pct: 0.10,
};

const LIMIT_LABELS: Record<string, string> = {
  kelly_fraction:       "Kelly Fraction",
  max_per_trade_pct:    "Max per Trade",
  max_per_market_pct:   "Max per Market",
  max_open_positions:   "Max Open Positions",
  daily_loss_limit_pct: "Daily Loss Limit",
};

function RiskGauge({
  label,
  current,
  limit,
  format = "pct",
}: {
  label: string;
  current: number;
  limit: number;
  format?: "pct" | "count";
}) {
  const ratio = Math.min(current / limit, 1);
  const pct = ratio * 100;
  const color =
    pct > 85 ? "var(--danger)" :
    pct > 60 ? "var(--warning)" :
    "var(--success)";

  const fmt = (v: number) =>
    format === "pct" ? `${(v * 100).toFixed(1)}%` : v.toString();

  return (
    <div
      style={{
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "18px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="label" style={{ marginBottom: "6px" }}>{label}</div>
          <div
            className="mono"
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color,
              letterSpacing: "-0.03em",
            }}
          >
            {fmt(current)}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "10px", color: "var(--text-3)", marginBottom: "4px" }}>LIMIT</div>
          <div className="mono" style={{ fontSize: "13px", color: "var(--text-2)" }}>
            {fmt(limit)}
          </div>
        </div>
      </div>

      <div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{
              width: `${pct}%`,
              backgroundColor: color,
              boxShadow: pct > 60 ? `0 0 6px ${color}40` : undefined,
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "5px" }}>
          <span style={{ fontSize: "10px", color: "var(--text-3)" }}>0</span>
          <span style={{ fontSize: "10px", color: "var(--text-3)" }}>
            {pct.toFixed(0)}% of limit used
          </span>
        </div>
      </div>
    </div>
  );
}

async function RiskContent() {
  const { stats } = await fetchDashboard();

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div>
        <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--text)", marginBottom: "4px", letterSpacing: "-0.02em" }}>
          Risk Monitor
        </h2>
        <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
          Real-time limits &middot; Quarter-Kelly &middot; Hard circuit breakers
        </p>
      </div>

      {/* Kill switch alert */}
      {stats.kill_switch_active && (
        <div className="alert alert-danger">
          <strong>Kill switch triggered.</strong> Daily loss limit exceeded. Bot is halted. Manual reset required.
        </div>
      )}

      {/* Status metric row */}
      <div
        className="grid-4"
        style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}
      >
        <MetricCard
          label="Kill Switch"
          value={stats.kill_switch_active ? "TRIGGERED" : "OK"}
          subValue={stats.kill_switch_active ? "Manual reset needed" : "All systems normal"}
          highlight={stats.kill_switch_active ? "danger" : "success"}
        />
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
          subValue={stats.open_positions >= LIMITS.max_open_positions ? "At capacity" : "Slots available"}
          highlight={stats.open_positions >= LIMITS.max_open_positions ? "danger" : stats.open_positions > 3 ? "warning" : "neutral"}
        />
        <MetricCard
          label="Kelly Fraction"
          value="25%"
          subValue="Conservative (÷4 full Kelly)"
          highlight="neutral"
        />
      </div>

      {/* Gauge section */}
      <div>
        <div className="label" style={{ marginBottom: "12px" }}>Live Risk Gauges</div>
        <div
          className="grid-2"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}
        >
          <RiskGauge
            label="Daily Loss Usage"
            current={stats.daily_loss_pct}
            limit={LIMITS.daily_loss_limit_pct}
            format="pct"
          />
          <RiskGauge
            label="Position Capacity"
            current={stats.open_positions}
            limit={LIMITS.max_open_positions}
            format="count"
          />
        </div>
      </div>

      {/* Hard limits table */}
      <div className="card">
        <div className="label" style={{ marginBottom: "16px" }}>
          Hard Limits — config/settings.yaml
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {Object.entries(LIMITS).map(([k, v], i, arr) => (
            <div
              key={k}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 0",
                borderBottom: i < arr.length - 1 ? "1px solid var(--border-subtle)" : undefined,
              }}
            >
              <div>
                <div style={{ fontSize: "13px", color: "var(--text)", fontWeight: 500 }}>
                  {LIMIT_LABELS[k]}
                </div>
                <div className="mono" style={{ fontSize: "10px", color: "var(--text-3)", marginTop: "2px" }}>
                  {k}
                </div>
              </div>
              <div className="mono" style={{ fontSize: "14px", color: "var(--accent)", fontWeight: 700 }}>
                {typeof v === "number" && v < 1 && k !== "max_open_positions"
                  ? `${(v * 100).toFixed(0)}%`
                  : String(v)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rule explainer */}
      <div className="card">
        <div className="label" style={{ marginBottom: "12px" }}>Risk Rule Reference</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[
            ["Quarter-Kelly Sizing", "Position size = 0.25 × (edge / odds). Conservative multiplier to account for model estimation error and protect against catastrophic ruin."],
            ["Per-Trade Cap (2%)", "No single trade can exceed 2% of current bankroll, regardless of Kelly output. Hard cap, cannot be overridden."],
            ["Daily Kill Switch (10%)", "If cumulative daily loss exceeds 10% of initial bankroll, bot halts automatically. Requires manual confirmation to resume."],
            ["Liquidity Gate", "Trades are only executed in markets with sufficient bid/ask depth. Thin markets excluded to avoid slippage killing the edge."],
            ["Resolution Buffer", "Positions are not opened in markets close to resolution time, to avoid oracle ambiguity risk."],
          ].map(([title, desc]) => (
            <div key={title as string} style={{ padding: "12px", backgroundColor: "var(--bg)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text)", marginBottom: "4px" }}>
                {title}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-3)", lineHeight: 1.6 }}>
                {desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function RiskPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="skeleton" style={{ height: "40px", width: "200px" }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
            {[0, 1, 2, 3].map((i) => <div key={i} className="card skeleton" style={{ height: "90px" }} />)}
          </div>
          <div className="card skeleton" style={{ height: "200px" }} />
        </div>
      }
    >
      <RiskContent />
    </Suspense>
  );
}
