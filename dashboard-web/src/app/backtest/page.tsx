import { Suspense } from "react";
import { fetchBacktest } from "@/lib/api";
import { MetricCard } from "@/components/MetricCard";

export const dynamic = "force-dynamic";

async function BacktestContent() {
  const bt = await fetchBacktest();

  if (!bt) {
    return (
      <div
        className="card"
        style={{
          padding: "56px",
          textAlign: "center",
          color: "var(--text-3)",
          fontSize: "13px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <span>No backtest data available.</span>
        <code className="mono" style={{ color: "var(--accent)", fontSize: "12px" }}>
          python -m backtest.run --mock --export-json
        </code>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text)", marginBottom: "3px" }}>
          Backtest Results
        </h2>
        {bt.generated_at && (
          <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
            Generated {new Date(bt.generated_at).toLocaleString()}
          </p>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
        <MetricCard
          label="Total Return"
          value={`${bt.total_return_pct >= 0 ? "+" : ""}${bt.total_return_pct.toFixed(2)}%`}
          highlight={bt.total_return_pct >= 0 ? "success" : "danger"}
        />
        <MetricCard
          label="Sharpe Ratio"
          value={bt.sharpe_ratio.toFixed(3)}
          highlight={bt.sharpe_ratio >= 1 ? "success" : bt.sharpe_ratio >= 0.5 ? "warning" : "danger"}
        />
        <MetricCard
          label="Max Drawdown"
          value={`${bt.max_drawdown_pct.toFixed(2)}%`}
          highlight={bt.max_drawdown_pct < 10 ? "success" : bt.max_drawdown_pct < 25 ? "warning" : "danger"}
        />
        <MetricCard
          label="Win Rate"
          value={`${(bt.win_rate * 100).toFixed(1)}%`}
          subValue={`${bt.n_trades} trades`}
          highlight={bt.win_rate >= 0.55 ? "success" : "warning"}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
        <MetricCard
          label="MC Ruin Probability"
          value={`${(bt.monte_carlo_ruin_prob * 100).toFixed(1)}%`}
          subValue="Bootstrap 5000 paths"
          highlight={bt.monte_carlo_ruin_prob < 0.05 ? "success" : bt.monte_carlo_ruin_prob < 0.15 ? "warning" : "danger"}
        />
        <MetricCard
          label="Avg PnL / Trade"
          value={`$${bt.avg_pnl_per_trade.toFixed(4)}`}
          highlight={bt.avg_pnl_per_trade >= 0 ? "success" : "danger"}
        />
        <MetricCard
          label="Best / Worst"
          value={`$${bt.best_trade.toFixed(4)}`}
          subValue={`Worst: $${bt.worst_trade.toFixed(4)}`}
          highlight="neutral"
        />
      </div>
    </div>
  );
}

export default function BacktestPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "48px", textAlign: "center", color: "var(--text-3)", fontSize: "12px" }}>
          Loading backtest…
        </div>
      }
    >
      <BacktestContent />
    </Suspense>
  );
}
