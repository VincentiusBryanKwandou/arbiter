import type { Trade } from "@/types";

const STRAT_COLORS: Record<string, string> = {
  arbitrage: "#60a5fa",
  longshot_bias: "#f59e0b",
  mean_reversion: "#a78bfa",
};

export function RecentTrades({ trades }: { trades: Trade[] }) {
  if (!trades.length) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "32px 0",
          color: "#6b7280",
          fontSize: "13px",
        }}
      >
        No trades recorded yet. Paper loop is scanning for opportunities.
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Time", "Market", "Strategy", "Sets", "Notional", "PnL", "Mode"].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  paddingBottom: "8px",
                  paddingRight: "16px",
                  color: "#6b7280",
                  fontWeight: 500,
                  borderBottom: "1px solid #1f2d45",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <tr
              key={t.id}
              style={{ borderBottom: "1px solid rgba(31,45,69,0.5)" }}
            >
              <td style={{ padding: "8px 16px 8px 0", color: "#6b7280", fontFamily: "monospace" }}>
                {new Date(t.timestamp).toLocaleTimeString()}
              </td>
              <td
                style={{
                  padding: "8px 16px 8px 0",
                  maxWidth: "160px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {t.description}
              </td>
              <td style={{ padding: "8px 16px 8px 0" }}>
                <span
                  style={{
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontSize: "10px",
                    fontFamily: "monospace",
                    color: STRAT_COLORS[t.strategy] ?? "#94a3b8",
                    backgroundColor: `${STRAT_COLORS[t.strategy] ?? "#94a3b8"}20`,
                  }}
                >
                  {t.strategy}
                </span>
              </td>
              <td style={{ padding: "8px 16px 8px 0", fontFamily: "monospace" }}>
                {t.sets.toFixed(2)}
              </td>
              <td style={{ padding: "8px 16px 8px 0", fontFamily: "monospace" }}>
                ${t.notional_usd.toFixed(2)}
              </td>
              <td
                style={{
                  padding: "8px 16px 8px 0",
                  fontFamily: "monospace",
                  fontWeight: 500,
                  color: t.locked_profit >= 0 ? "#10b981" : "#ef4444",
                }}
              >
                {t.locked_profit >= 0 ? "+" : ""}${t.locked_profit.toFixed(4)}
              </td>
              <td style={{ padding: "8px 0" }}>
                <span
                  style={{
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontSize: "10px",
                    fontFamily: "monospace",
                    color: t.mode === "live" ? "#ef4444" : "#60a5fa",
                    backgroundColor: t.mode === "live" ? "rgba(239,68,68,0.1)" : "rgba(59,130,246,0.1)",
                  }}
                >
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
