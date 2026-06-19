import { Suspense } from "react";
import nextDynamic from "next/dynamic";
import { fetchDashboard } from "@/lib/api";
import { MetricCard } from "@/components/MetricCard";
import { EquityChart } from "@/components/EquityChart";
import { RecentTrades } from "@/components/RecentTrades";
import { OpportunitiesFeed } from "@/components/OpportunitiesFeed";
import { AutoRefresh } from "@/components/AutoRefresh";

const ActionPanel = nextDynamic(
  () => import("@/components/ActionPanel").then((m) => ({ default: m.ActionPanel })),
  { ssr: false, loading: () => null }
);

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
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* Kill switch banner */}
      {stats.kill_switch_active && (
        <div className="alert alert-danger" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "2px" }}>Kill Switch Active</div>
            <div style={{ fontSize: "12px", opacity: 0.8 }}>
              Daily loss limit exceeded. Bot has stopped trading automatically.
            </div>
          </div>
        </div>
      )}

      {/* Action Panel */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <ActionPanel initialBankroll={stats.bankroll_usd} />
      </div>

      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text)", marginBottom: "2px" }}>
            Overview
          </h2>
          <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
            Mode:{" "}
            <span
              className="mono"
              style={{ color: stats.mode === "live" ? "var(--danger)" : "var(--accent)", fontWeight: 600 }}
            >
              {stats.mode.toUpperCase()}
            </span>
            {" "}&middot; Last scan:{" "}
            <span className="mono">{new Date(stats.last_scan_at).toLocaleTimeString("en-US", { hour12: false })}</span>
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            className="status-dot"
            style={{
              backgroundColor: stats.kill_switch_active ? "var(--danger)" : "var(--success)",
              boxShadow: stats.kill_switch_active ? undefined : "0 0 6px var(--success)",
            }}
          />
          <span style={{ fontSize: "11px", color: "var(--text-3)" }}>
            {stats.kill_switch_active ? "Kill switch" : "Running"}
          </span>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div className="card">
          <div className="label" style={{ marginBottom: "12px" }}>Equity Curve</div>
          <EquityChart data={equity_history} />
        </div>
        <div className="card">
          <div className="label" style={{ marginBottom: "12px" }}>Live Opportunities</div>
          <OpportunitiesFeed opportunities={opportunities} />
        </div>
      </div>

      {/* Recent trades */}
      <div className="card">
        <div className="label" style={{ marginBottom: "12px" }}>Recent Trades</div>
        <RecentTrades trades={recent_trades} />
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <AutoRefresh intervalMs={30_000} />
      <Suspense
        fallback={
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "260px" }}>
            <p style={{ color: "var(--text-3)", fontSize: "12px" }}>Loading dashboard…</p>
          </div>
        }
      >
        <DashboardContent />
      </Suspense>
    </>
  );
}
