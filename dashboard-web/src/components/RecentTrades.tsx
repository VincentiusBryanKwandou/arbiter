import type { Trade } from "@/types";

const STRAT_COLORS: Record<string, string> = {
  arbitrage: "#3b82f6",
  longshot_bias: "#f59e0b",
  mean_reversion: "#a78bfa",
};

const COLS = ["Time", "Market", "Strategy", "Sets", "Notional", "PnL", "Mode"];

export function RecentTrades({
  trades,
  botConnected = true,
  vercelNative = false,
}: {
  trades: Trade[];
  botConnected?: boolean;
  vercelNative?: boolean;
}) {
  if (!trades.length) {
    return (
      <div style={{ padding: "36px 0", textAlign: "center" }}>
        <div style={{ fontSize: "12px", color: "var(--text-3)", marginBottom: "6px" }}>
          No trades recorded yet.
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-4)" }}>
          {vercelNative
            ? "Paper trading execution requires persistent storage — opportunities are detected live."
            : botConnected
            ? "Paper loop is running — trades will appear here."
            : "Scanner runs inline on Vercel — no separate bot needed."}
        </div>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {COLS.map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: "0 12px 10px 0",
                  color: "var(--text-3)",
                  fontWeight: 500,
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  borderBottom: "1px solid var(--border)",
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <tr key={t.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <td className="mono" style={{ padding: "9px 12px 9px 0", color: "var(--text-3)", whiteSpace: "nowrap" }}>
                {new Date(t.timestamp).toLocaleTimeString("en-US", { hour12: false })}
              </td>
              <td
                style={{
                  padding: "9px 12px 9px 0",
                  maxWidth: "180px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "var(--text)",
                }}
              >
                {t.description}
              </td>
              <td style={{ padding: "9px 12px 9px 0" }}>
                <span
                  style={{
                    padding: "2px 7px",
                    borderRadius: "99px",
                    fontSize: "10px",
                    fontWeight: 500,
                    color: STRAT_COLORS[t.strategy] ?? "var(--text-2)",
                    backgroundColor: `${STRAT_COLORS[t.strategy] ?? "#94a3b8"}18`,
                  }}
                >
                  {t.strategy}
                </span>
              </td>
              <td className="mono" style={{ padding: "9px 12px 9px 0", color: "var(--text-2)" }}>
                {t.sets.toFixed(2)}
              </td>
              <td className="mono" style={{ padding: "9px 12px 9px 0", color: "var(--text-2)" }}>
                ${t.notional_usd.toFixed(2)}
              </td>
              <td
                className="mono"
                style={{
                  padding: "9px 12px 9px 0",
                  fontWeight: 500,
                  color: t.locked_profit >= 0 ? "var(--success)" : "var(--danger)",
                }}
              >
                {t.locked_profit >= 0 ? "+" : ""}${t.locked_profit.toFixed(4)}
              </td>
              <td style={{ padding: "9px 0" }}>
                <span className={t.mode === "live" ? "badge badge-live" : "badge badge-paper"}>
                  {t.mode}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
