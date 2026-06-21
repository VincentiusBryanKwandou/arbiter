"use client";

import { useState } from "react";
import type { Trade } from "@/types";

const STRAT_COLORS: Record<string, string> = {
  dutch_book:           "#3b82f6",
  arbitrage:            "#3b82f6",
  mutually_exclusive:   "#a78bfa",
  longshot_bias:        "#f59e0b",
  mean_reversion:       "#06b6d4",
};

function SortIcon({ dir }: { dir: "asc" | "desc" | null }) {
  if (!dir) return <span style={{ opacity: 0.2 }}>↕</span>;
  return <span>{dir === "asc" ? "↑" : "↓"}</span>;
}

export function RecentTrades({
  trades,
}: {
  trades: Trade[];
  botConnected?: boolean;
  vercelNative?: boolean;
}) {
  const [sortKey, setSortKey] = useState<"timestamp" | "locked_profit" | "notional_usd">("timestamp");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [modeFilter, setModeFilter] = useState<"all" | "paper" | "live">("all");

  if (!trades.length) {
    return (
      <div
        style={{
          padding: "40px 16px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--text-4)" }}>
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <line x1="9" y1="12" x2="15" y2="12" />
        </svg>
        <div style={{ fontSize: "13px", color: "var(--text-3)", fontWeight: 500 }}>
          No trades recorded yet
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-4)", maxWidth: "280px" }}>
          GitHub Actions runs the paper scanner every 5 minutes and commits trade data automatically.
        </div>
      </div>
    );
  }

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const filtered = trades
    .filter((t) => modeFilter === "all" || t.mode === modeFilter)
    .sort((a, b) => {
      let va: number, vb: number;
      if (sortKey === "timestamp") {
        va = new Date(a.timestamp).getTime();
        vb = new Date(b.timestamp).getTime();
      } else {
        va = a[sortKey];
        vb = b[sortKey];
      }
      return sortDir === "asc" ? va - vb : vb - va;
    });

  const thStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "0 12px 10px 0",
    color: "var(--text-3)",
    fontWeight: 600,
    fontSize: "10px",
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    borderBottom: "1px solid var(--border)",
    whiteSpace: "nowrap",
    cursor: "pointer",
    userSelect: "none",
  };

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "14px", flexWrap: "wrap" }}>
        {(["all", "paper", "live"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setModeFilter(m)}
            className="btn btn-ghost"
            style={{
              padding: "4px 12px",
              fontSize: "11px",
              backgroundColor: modeFilter === m ? "var(--accent-muted)" : undefined,
              color: modeFilter === m ? "var(--accent)" : undefined,
              borderColor: modeFilter === m ? "rgba(59,130,246,0.3)" : undefined,
            }}
          >
            {m === "all" ? `All (${trades.length})` : m === "paper" ? `Paper (${trades.filter((t) => t.mode === "paper").length})` : `Live (${trades.filter((t) => t.mode === "live").length})`}
          </button>
        ))}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle} onClick={() => toggleSort("timestamp")}>
                Time <SortIcon dir={sortKey === "timestamp" ? sortDir : null} />
              </th>
              <th style={{ ...thStyle, cursor: "default" }}>Market</th>
              <th style={{ ...thStyle, cursor: "default" }}>Strategy</th>
              <th style={{ ...thStyle, cursor: "default" }}>Sets</th>
              <th style={thStyle} onClick={() => toggleSort("notional_usd")}>
                Notional <SortIcon dir={sortKey === "notional_usd" ? sortDir : null} />
              </th>
              <th style={thStyle} onClick={() => toggleSort("locked_profit")}>
                Locked P&amp;L <SortIcon dir={sortKey === "locked_profit" ? sortDir : null} />
              </th>
              <th style={{ ...thStyle, cursor: "default" }}>Mode</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr
                key={t.id}
                style={{
                  borderBottom: "1px solid var(--border-subtle)",
                  transition: "background-color 0.1s",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.02)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")
                }
              >
                <td className="mono" style={{ padding: "9px 12px 9px 0", color: "var(--text-3)", whiteSpace: "nowrap" }}>
                  {new Date(t.timestamp).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })}
                </td>
                <td
                  style={{
                    padding: "9px 12px 9px 0",
                    maxWidth: "200px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: "var(--text)",
                    fontWeight: 500,
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
                      border: `1px solid ${STRAT_COLORS[t.strategy] ?? "#94a3b8"}28`,
                    }}
                  >
                    {t.strategy.replace(/_/g, " ")}
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
                    fontWeight: 600,
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

        {filtered.length === 0 && (
          <div style={{ padding: "20px", textAlign: "center", fontSize: "12px", color: "var(--text-3)" }}>
            No trades match filter.
          </div>
        )}
      </div>
    </div>
  );
}
