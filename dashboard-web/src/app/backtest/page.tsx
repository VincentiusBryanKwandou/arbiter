import { Suspense } from "react";
import { fetchBacktest } from "@/lib/api";
import { MetricCard } from "@/components/MetricCard";

export const dynamic = "force-dynamic";

async function BacktestContent() {
  const bt = await fetchBacktest();

  if (!bt) {
    return (
      <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div>
          <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--text)", marginBottom: "4px", letterSpacing: "-0.02em" }}>
            Backtest Results
          </h2>
          <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
            Simulate strategy performance on historical data before risking capital.
          </p>
        </div>

        <div
          className="card"
          style={{
            padding: "48px 32px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "20px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              backgroundColor: "var(--accent-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent)",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-5" />
            </svg>
          </div>

          <div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text)", marginBottom: "8px" }}>
              No backtest data available
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-3)", lineHeight: 1.7, maxWidth: "420px" }}>
              Run the backtest engine to simulate your Dutch book strategy on historical Polymarket data.
              Results will include Sharpe ratio, max drawdown, and Monte Carlo ruin probability.
            </div>
          </div>

          <div
            style={{
              backgroundColor: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "14px 20px",
              textAlign: "left",
              width: "100%",
              maxWidth: "480px",
            }}
          >
            <div className="label" style={{ marginBottom: "10px" }}>Run backtest</div>
            <code className="mono" style={{ fontSize: "12px", color: "var(--accent)", display: "block", marginBottom: "6px" }}>
              python -m backtest.run --mock --export-json
            </code>
            <div style={{ fontSize: "11px", color: "var(--text-3)" }}>
              Generates <code className="mono" style={{ color: "var(--text-2)" }}>public/data/backtest.json</code> and
              commits to GitHub — dashboard updates on next refresh.
            </div>
          </div>
        </div>

        {/* Phase guide */}
        <div className="card">
          <div className="label" style={{ marginBottom: "16px" }}>Backtest Methodology</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {[
              { step: "01", title: "Data collection", desc: "Fetch historical Polymarket prices, orderbook snapshots, and resolution data into Parquet files." },
              { step: "02", title: "Event-driven simulation", desc: "Replay tick-by-tick. Honour liquidity and fee constraints. No look-ahead bias." },
              { step: "03", title: "Walk-forward validation", desc: "Calibrate on period A, test on period B. Prevents overfitting to in-sample noise." },
              { step: "04", title: "Realistic cost model", desc: "Include gas, slippage, spread, and fill probability. Many edges vanish after costs." },
              { step: "05", title: "Monte Carlo (5 000 paths)", desc: "Bootstrap trade order to generate drawdown distribution and ruin probability." },
            ].map(({ step, title, desc }, i, arr) => (
              <div
                key={step}
                style={{
                  display: "flex",
                  gap: "16px",
                  padding: "14px 0",
                  borderBottom: i < arr.length - 1 ? "1px solid var(--border-subtle)" : undefined,
                }}
              >
                <div
                  className="mono"
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "var(--accent)",
                    opacity: 0.6,
                    flexShrink: 0,
                    width: "24px",
                    paddingTop: "2px",
                  }}
                >
                  {step}
                </div>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text)", marginBottom: "3px" }}>
                    {title}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-3)", lineHeight: 1.6 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--text)", marginBottom: "4px", letterSpacing: "-0.02em" }}>
            Backtest Results
          </h2>
          {bt.generated_at && (
            <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
              Generated {new Date(bt.generated_at).toLocaleString()}
            </p>
          )}
        </div>
        <span
          className={`badge ${bt.total_return_pct >= 0 ? "badge-success" : "badge-live"}`}
          style={{ fontSize: "12px", padding: "4px 12px" }}
        >
          {bt.total_return_pct >= 0 ? "+" : ""}{bt.total_return_pct.toFixed(2)}% total return
        </span>
      </div>

      <div className="grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
        <MetricCard
          label="Total Return"
          value={`${bt.total_return_pct >= 0 ? "+" : ""}${bt.total_return_pct.toFixed(2)}%`}
          highlight={bt.total_return_pct >= 0 ? "success" : "danger"}
        />
        <MetricCard
          label="Sharpe Ratio"
          value={bt.sharpe_ratio.toFixed(3)}
          subValue={bt.sharpe_ratio >= 1 ? "Strong" : bt.sharpe_ratio >= 0.5 ? "Moderate" : "Weak"}
          highlight={bt.sharpe_ratio >= 1 ? "success" : bt.sharpe_ratio >= 0.5 ? "warning" : "danger"}
        />
        <MetricCard
          label="Max Drawdown"
          value={`${bt.max_drawdown_pct.toFixed(2)}%`}
          subValue={bt.max_drawdown_pct < 10 ? "Acceptable" : bt.max_drawdown_pct < 25 ? "Elevated" : "Dangerous"}
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
          subValue="5 000 bootstrap paths"
          highlight={bt.monte_carlo_ruin_prob < 0.05 ? "success" : bt.monte_carlo_ruin_prob < 0.15 ? "warning" : "danger"}
        />
        <MetricCard
          label="Avg PnL / Trade"
          value={`$${bt.avg_pnl_per_trade.toFixed(4)}`}
          highlight={bt.avg_pnl_per_trade >= 0 ? "success" : "danger"}
        />
        <MetricCard
          label="Best / Worst Trade"
          value={`+$${bt.best_trade.toFixed(4)}`}
          subValue={`Worst: $${bt.worst_trade.toFixed(4)}`}
          highlight="neutral"
        />
      </div>

      {/* Gate assessment */}
      <div className="card">
        <div className="label" style={{ marginBottom: "12px" }}>Live Trading Gate Assessment</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[
            { label: "Edge positive after costs", pass: bt.total_return_pct > 0 },
            { label: "Ruin probability < 5%", pass: bt.monte_carlo_ruin_prob < 0.05 },
            { label: "Sharpe ratio >= 0.5", pass: bt.sharpe_ratio >= 0.5 },
            { label: "Max drawdown < 25%", pass: bt.max_drawdown_pct < 25 },
          ].map(({ label, pass }) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 12px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: pass ? "var(--success-muted)" : "var(--danger-muted)",
                border: `1px solid ${pass ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)"}`,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={pass ? "var(--success)" : "var(--danger)"} strokeWidth="2.5" strokeLinecap="round">
                {pass
                  ? <><polyline points="20 6 9 17 4 12" /></>
                  : <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>}
              </svg>
              <span style={{ fontSize: "12px", color: pass ? "var(--success)" : "var(--danger)", fontWeight: 500 }}>
                {label}
              </span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "14px", lineHeight: 1.6 }}>
          {[true, false, true, false].every((_, i) => [bt.total_return_pct > 0, bt.monte_carlo_ruin_prob < 0.05, bt.sharpe_ratio >= 0.5, bt.max_drawdown_pct < 25][i])
            ? "All gates passed. Strategy is ready for paper trading validation before live deployment."
            : "One or more gates failed. Do not deploy to live trading. Review strategy parameters."}
        </div>
      </div>
    </div>
  );
}

export default function BacktestPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="skeleton" style={{ height: "40px", width: "200px" }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
            {[0, 1, 2, 3].map((i) => <div key={i} className="card skeleton" style={{ height: "90px" }} />)}
          </div>
          <div className="card skeleton" style={{ height: "300px" }} />
        </div>
      }
    >
      <BacktestContent />
    </Suspense>
  );
}
