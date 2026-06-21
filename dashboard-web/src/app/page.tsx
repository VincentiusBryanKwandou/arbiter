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
function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  return `${Math.round(diff / 3600)}h ago`;
}

async function DashboardContent() {
  const data = await fetchDashboard();
  const { stats, equity_history, recent_trades, opportunities } = data;
  const dataSource = data.data_source;
  const isVercelNative = dataSource === "vercel-live";
  const isLive = dataSource === "live";
  const botConnected = isVercelNative || isLive || (data.bot_connected ?? false);

  const statusLabel = stats.kill_switch_active
    ? "Kill Switch Active"
    : isVercelNative
    ? "Live · Vercel Edge"
    : isLive
    ? "Live · Railway"
    : "Offline";

  const statusColor = stats.kill_switch_active
    ? "var(--danger)"
    : botConnected
    ? "var(--success)"
    : "var(--warning)";

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* Kill switch banner */}
      {stats.kill_switch_active && (
        <div className="alert alert-danger" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "2px" }}>Kill Switch Active</div>
            <div style={{ fontSize: "11px", opacity: 0.85 }}>
              Daily loss limit exceeded. Bot has halted automatically. Manual reset required.
            </div>
          </div>
        </div>
      )}

      {/* Action Panel */}
      <ActionPanel initialBankroll={stats.bankroll_usd} />

      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--text)", marginBottom: "2px", letterSpacing: "-0.02em" }}>
            Overview
          </h2>
          <p style={{ fontSize: "11px", color: "var(--text-3)" }}>
            Mode:{" "}
            <span
              className="mono"
              style={{ color: stats.mode === "live" ? "var(--danger)" : "var(--accent)", fontWeight: 600 }}
            >
              {stats.mode.toUpperCase()}
            </span>
            <span style={{ margin: "0 6px", color: "var(--text-4)" }}>&middot;</span>
            Last scan:{" "}
            <span className="mono" style={{ color: "var(--text-2)" }}>
              {timeAgo(stats.last_scan_at)}
            </span>
          </p>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "5px 12px",
            borderRadius: "99px",
            border: `1px solid ${botConnected ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.2)"}`,
            backgroundColor: botConnected ? "rgba(16,185,129,0.05)" : "rgba(245,158,11,0.05)",
          }}
        >
          <div
            className={`status-dot${botConnected && !stats.kill_switch_active ? " status-dot-live" : ""}`}
            style={{
              backgroundColor: statusColor,
              boxShadow: botConnected && !stats.kill_switch_active ? `0 0 5px ${statusColor}` : undefined,
            }}
          />
          <span style={{ fontSize: "11px", fontWeight: 500, color: statusColor }}>{statusLabel}</span>
        </div>
      </div>

      {/* Metric cards — responsive 4→2→2 */}
      <div
        className="grid-4"
        style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}
      >
        <MetricCard
          label="Total PnL"
          value={fmtPnl(stats.realized_pnl_total)}
          subValue={`Today: ${fmtPnl(stats.realized_pnl_today)}`}
          highlight={stats.realized_pnl_total > 0 ? "success" : stats.realized_pnl_total < 0 ? "danger" : "neutral"}
        />
        <MetricCard
          label="Win Rate"
          value={fmtPct(stats.win_rate)}
          subValue={`${stats.trades_today} trades today`}
          highlight={stats.win_rate >= 0.55 ? "success" : stats.trades_today > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label="Bankroll"
          value={`$${stats.bankroll_usd.toFixed(2)}`}
          subValue={`${stats.open_positions} / ${stats.max_open_positions} positions open`}
          highlight={stats.daily_loss_pct > 0.08 ? "danger" : "neutral"}
        />
        <MetricCard
          label="Edge Signals"
          value={stats.opportunities_found_today}
          subValue={`Avg ${fmtPct(stats.avg_edge_pct)} edge`}
          highlight={stats.opportunities_found_today > 0 ? "success" : "neutral"}
        />
      </div>

      {/* Charts row */}
      <div
        className="grid-2"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}
      >
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <div className="label">Equity Curve</div>
            {equity_history.length > 0 && (
              <span className="mono" style={{ fontSize: "11px", color: equity_history[equity_history.length - 1]?.equity >= equity_history[0]?.equity ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                ${equity_history[equity_history.length - 1]?.equity.toFixed(2)}
              </span>
            )}
          </div>
          <EquityChart data={equity_history} />
        </div>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <div className="label">Live Opportunities</div>
            {opportunities.length > 0 && (
              <span
                className="badge badge-success"
                style={{ fontSize: "10px" }}
              >
                {opportunities.length} found
              </span>
            )}
          </div>
          <OpportunitiesFeed
            opportunities={opportunities}
            botConnected={botConnected}
            vercelNative={isVercelNative}
          />
        </div>
      </div>

      {/* Recent trades */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div className="label">Recent Trades</div>
          {recent_trades.length > 0 && (
            <a href="/trades" style={{ fontSize: "11px", color: "var(--accent)", textDecoration: "none" }}>
              View all {recent_trades.length}+
            </a>
          )}
        </div>
        <RecentTrades
          trades={recent_trades}
          botConnected={botConnected}
          vercelNative={isVercelNative}
        />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card" style={{ height: "96px" }}>
            <div className="skeleton" style={{ height: "10px", width: "60px", marginBottom: "12px" }} />
            <div className="skeleton" style={{ height: "28px", width: "80px" }} />
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div className="card skeleton" style={{ height: "280px" }} />
        <div className="card skeleton" style={{ height: "280px" }} />
      </div>
      <div className="card skeleton" style={{ height: "200px" }} />
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <AutoRefresh intervalMs={30_000} />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </>
  );
}
