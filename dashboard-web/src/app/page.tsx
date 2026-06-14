import { Suspense } from "react";
import { fetchDashboard } from "@/lib/api";
import { MetricCard } from "@/components/MetricCard";
import { EquityChart } from "@/components/EquityChart";
import { RecentTrades } from "@/components/RecentTrades";
import { OpportunitiesFeed } from "@/components/OpportunitiesFeed";

export const dynamic = "force-dynamic";

function fmtPnl(n: number) {
  return (n >= 0 ? "+" : "") + "$" + Math.abs(n).toFixed(2);
}
function fmtPct(n: number) {
  return (n >= 0 ? "+" : "") + (n * 100).toFixed(1) + "%";
}

async function DashboardContent() {
  const data = await fetchDashboard();
  const { stats, equity_history, recent_trades, opportunities } = data;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Kill switch banner */}
      {stats.kill_switch_active && (
        <div
          style={{
            backgroundColor: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "12px",
            padding: "16px",
            display: "flex",
            gap: "12px",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "20px" }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 600, color: "#ef4444", fontSize: "14px" }}>Kill Switch Active</div>
            <div style={{ fontSize: "12px", color: "rgba(239,68,68,0.7)", marginTop: "2px" }}>
              Daily loss limit exceeded. Bot stopped trading automatically.
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 600 }}>Dashboard</h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#94a3b8" }}>
            Mode:{" "}
            <span
              style={{
                fontFamily: "monospace",
                color: stats.mode === "live" ? "#ef4444" : "#3b82f6",
              }}
            >
              {stats.mode.toUpperCase()}
            </span>{" "}
            · Last scan: {new Date(stats.last_scan_at).toLocaleTimeString()}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: stats.kill_switch_active ? "#ef4444" : "#10b981",
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: "12px", color: "#6b7280" }}>
            {stats.kill_switch_active ? "Kill switch active" : "Running"}
          </span>
        </div>
      </div>

      {/* Metrics grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px" }}>
        <MetricCard
          label="Total PnL"
          value={fmtPnl(stats.realized_pnl_total)}
          subValue={`Today: ${fmtPnl(stats.realized_pnl_today)}`}
          highlight={stats.realized_pnl_total >= 0 ? "success" : "danger"}
        />
        <MetricCard
          label="Win Rate"
          value={fmtPct(stats.win_rate)}
          subValue={`${stats.trades_today} trades today`}
          highlight={stats.win_rate >= 0.55 ? "success" : "warning"}
        />
        <MetricCard
          label="Bankroll"
          value={`$${stats.bankroll_usd.toFixed(2)}`}
          subValue={`${stats.open_positions}/${stats.max_open_positions} positions`}
          highlight={stats.daily_loss_pct > 0.08 ? "danger" : "neutral"}
        />
        <MetricCard
          label="Opportunities"
          value={stats.opportunities_found_today}
          subValue={`Avg edge: ${fmtPct(stats.avg_edge_pct)}`}
          highlight={stats.opportunities_found_today > 0 ? "success" : "neutral"}
        />
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div
          style={{
            backgroundColor: "#1a2234",
            border: "1px solid #1f2d45",
            borderRadius: "12px",
            padding: "16px",
          }}
        >
          <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "12px", fontWeight: 500 }}>
            Equity Curve
          </div>
          <EquityChart data={equity_history} />
        </div>
        <div
          style={{
            backgroundColor: "#1a2234",
            border: "1px solid #1f2d45",
            borderRadius: "12px",
            padding: "16px",
          }}
        >
          <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "12px", fontWeight: 500 }}>
            Live Opportunities
          </div>
          <OpportunitiesFeed opportunities={opportunities} />
        </div>
      </div>

      {/* Recent trades */}
      <div
        style={{
          backgroundColor: "#1a2234",
          border: "1px solid #1f2d45",
          borderRadius: "12px",
          padding: "16px",
        }}
      >
        <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "12px", fontWeight: 500 }}>
          Recent Trades
        </div>
        <RecentTrades trades={recent_trades} />
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "256px" }}>
          <p style={{ color: "#6b7280", fontSize: "13px" }}>Loading dashboard…</p>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
