import { Suspense } from "react";
import { fetchBacktest } from "@/lib/api";
import { MetricCard } from "@/components/MetricCard";

export const revalidate = 300;

async function BacktestContent() {
  const bt = await fetchBacktest();

  if (!bt) {
    return (
      <div
        style={{
          backgroundColor: "#1a2234",
          border: "1px solid #1f2d45",
          borderRadius: "12px",
          padding: "48px",
          textAlign: "center",
          color: "#6b7280",
          fontSize: "13px",
        }}
      >
        <p>No backtest data found.</p>
        <p style={{ marginTop: "8px", fontFamily: "monospace", color: "#3b82f6", fontSize: "12px" }}>
          python -m backtest.run --mock --export-json
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 600 }}>Backtest Results</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px" }}>
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px" }}>
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

      {bt.generated_at && (
        <div style={{ fontSize: "11px", color: "#6b7280" }}>
          Generated: {new Date(bt.generated_at).toLocaleString()}
        </div>
      )}
    </div>
  );
}

export default function BacktestPage() {
  return (
    <Suspense fallback={<p style={{ color: "#6b7280", fontSize: "13px" }}>Loading backtest…</p>}>
      <BacktestContent />
    </Suspense>
  );
}
