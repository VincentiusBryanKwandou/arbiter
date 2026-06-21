"use client";

import { useEffect, useState, useCallback } from "react";
import type { Trade } from "@/types";
import { RecentTrades } from "@/components/RecentTrades";

function IconDownload() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconRefresh({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ animation: spinning ? "spin 1s linear infinite" : undefined }}
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-5" />
    </svg>
  );
}

function StatPill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "3px",
        padding: "12px 16px",
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        minWidth: "100px",
      }}
    >
      <div className="label">{label}</div>
      <div
        className="mono"
        style={{ fontSize: "16px", fontWeight: 700, color: color ?? "var(--text)", letterSpacing: "-0.02em" }}
      >
        {value}
      </div>
    </div>
  );
}

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<string | null>(null);

  const fetchTrades = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/trades?limit=500", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setTrades(Array.isArray(data) ? data : []);
        setLastFetch(new Date().toLocaleTimeString("en-US", { hour12: false }));
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const exportCsv = () => {
    if (!trades.length) return;
    const header = "id,timestamp,description,strategy,venue,sets,notional_usd,locked_profit,edge_pct,mode";
    const rows = trades.map((t) =>
      [
        t.id,
        t.timestamp,
        `"${t.description.replace(/"/g, '""')}"`,
        t.strategy,
        t.venue,
        t.sets,
        t.notional_usd,
        t.locked_profit,
        t.edge_pct ?? "",
        t.mode,
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `arbiter-trades-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Aggregated stats
  const totalPnl = trades.reduce((s, t) => s + t.locked_profit, 0);
  const winners = trades.filter((t) => t.locked_profit > 0);
  const winRate = trades.length > 0 ? winners.length / trades.length : 0;
  const avgEdge = trades.length > 0
    ? trades.reduce((s, t) => s + (t.edge_pct ?? 0), 0) / trades.length
    : 0;

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--text)", marginBottom: "4px", letterSpacing: "-0.02em" }}>
            Trade Log
          </h2>
          <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
            All paper trades executed by the scanner.
            {lastFetch && <span style={{ marginLeft: "6px" }}>Updated {lastFetch}</span>}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {trades.length > 0 && (
            <button onClick={exportCsv} className="btn btn-ghost" style={{ fontSize: "12px" }}>
              <IconDownload /> Export CSV
            </button>
          )}
          <button onClick={fetchTrades} disabled={loading} className="btn btn-ghost" style={{ fontSize: "12px" }}>
            <IconRefresh spinning={loading} />
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Stats strip */}
      {trades.length > 0 && (
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <StatPill label="Total Trades" value={String(trades.length)} />
          <StatPill
            label="Total P&L"
            value={`${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(4)}`}
            color={totalPnl >= 0 ? "var(--success)" : "var(--danger)"}
          />
          <StatPill
            label="Win Rate"
            value={`${(winRate * 100).toFixed(1)}%`}
            color={winRate >= 0.55 ? "var(--success)" : winRate > 0 ? "var(--warning)" : "var(--text-2)"}
          />
          <StatPill
            label="Avg Edge"
            value={`+${(avgEdge * 100).toFixed(2)}%`}
            color="var(--accent)"
          />
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "20px" }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: "36px", borderRadius: "4px" }} />
          ))}
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div className="card" style={{ padding: "20px" }}>
          <RecentTrades trades={trades} />
        </div>
      )}
    </div>
  );
}
