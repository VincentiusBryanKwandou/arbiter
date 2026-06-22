"use client";

import { useCallback, useEffect, useState } from "react";
import type { LiveMarket } from "@/types";
import { openPosition } from "@/lib/api";

function fmtVol(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
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

function TradeModal({
  market,
  onClose,
  onSuccess,
}: {
  market: LiveMarket;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [sets, setSets] = useState("1");
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ text: string; ok: boolean } | null>(null);

  const costPerSet = market.sum_prices;
  const setsNum = parseFloat(sets) || 0;
  const estimatedProfit = +(setsNum * (1 - costPerSet)).toFixed(4);
  const capital = +(setsNum * costPerSet).toFixed(2);

  const confirm = async () => {
    if (setsNum <= 0) {
      setAlert({ text: "Enter a number of sets greater than 0.", ok: false });
      return;
    }
    setLoading(true);
    const res = await openPosition({
      market_id: market.market_id,
      question: market.question,
      sets: setsNum,
      edge_pct: market.potential_edge,
      cost_per_set: costPerSet,
      strategy: market.strategy,
      venue: market.venue,
    });
    setLoading(false);
    if (res.ok) {
      setAlert({ text: `Position opened. Locked profit: $${res.position.locked_profit.toFixed(4)}`, ok: true });
      setTimeout(() => { onSuccess(); onClose(); }, 1600);
    } else {
      const err =
        (res as { error?: string }).error ??
        (res as { detail?: string }).detail ??
        "Failed to open position.";
      setAlert({ text: err, ok: false });
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <span className="modal-title">Open Pair Trade</span>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: "4px 10px" }}>&times;</button>
        </div>

        <div className="card" style={{ backgroundColor: "var(--bg)", marginBottom: "16px" }}>
          <div style={{ fontSize: "13px", fontWeight: 500, marginBottom: "10px", lineHeight: 1.4 }}>
            {market.question}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${market.outcomes.length}, 1fr)`, gap: "8px", marginBottom: "12px" }}>
            {market.outcomes.map((outcome, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "10px", color: "var(--text-3)", marginBottom: "3px" }}>{outcome}</div>
                <div className="mono" style={{ fontSize: "14px", color: "var(--accent)", fontWeight: 600 }}>
                  {(market.prices[i] * 100).toFixed(1)}c
                </div>
              </div>
            ))}
          </div>
          <div className="divider" style={{ marginBottom: "10px" }} />
          <div style={{ display: "flex", gap: "16px" }}>
            <div>
              <span style={{ fontSize: "10px", color: "var(--text-3)" }}>Sum prices</span>
              <span className="mono" style={{ fontSize: "12px", color: market.has_arb ? "var(--success)" : "var(--text-2)", fontWeight: 600, marginLeft: "6px" }}>
                {(market.sum_prices * 100).toFixed(2)}c
              </span>
            </div>
            <div>
              <span style={{ fontSize: "10px", color: "var(--text-3)" }}>Est. edge</span>
              <span className="mono" style={{ fontSize: "12px", color: market.potential_edge > 0.01 ? "var(--success)" : "var(--text-3)", fontWeight: 600, marginLeft: "6px" }}>
                {market.has_arb ? `+${(market.potential_edge * 100).toFixed(2)}%` : "~0%"}
              </span>
            </div>
            <div>
              <span style={{ fontSize: "10px", color: "var(--text-3)" }}>Volume</span>
              <span className="mono" style={{ fontSize: "12px", color: "var(--text-2)", marginLeft: "6px" }}>
                {fmtVol(market.volume)}
              </span>
            </div>
          </div>
        </div>

        <div className="alert alert-info" style={{ marginBottom: "14px", fontSize: "11px" }}>
          <strong>Strategy:</strong>{" "}
          {market.outcomes.length === 2 ? "Binary Dutch Book" : "Mutually Exclusive Set"}
          {" "}— buy all outcomes simultaneously.
          {market.sum_prices < 0.98 && " Total price < $1 = locked arbitrage potential."}
        </div>

        <label className="label" style={{ display: "block", marginBottom: "6px" }}>Number of sets</label>
        <input
          className="input"
          type="number"
          value={sets}
          step="0.5"
          min="0.1"
          onChange={(e) => setSets(e.target.value)}
          autoFocus
        />
        <div style={{ display: "flex", gap: "16px", marginTop: "8px", fontSize: "12px" }}>
          <span style={{ color: "var(--text-3)" }}>
            Capital: <span className="mono" style={{ color: "var(--text-2)", fontWeight: 600 }}>${capital}</span>
          </span>
          <span style={{ color: "var(--text-3)" }}>
            Est. profit:{" "}
            <span className="mono" style={{ color: estimatedProfit >= 0 ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
              {estimatedProfit >= 0 ? "+" : ""}${estimatedProfit}
            </span>
          </span>
        </div>

        {alert && (
          <div className={`alert ${alert.ok ? "alert-success" : "alert-danger"}`} style={{ marginTop: "12px" }}>
            {alert.text}
          </div>
        )}

        {!alert?.ok && (
          <div style={{ marginTop: "8px", fontSize: "11px", color: "var(--text-3)" }}>
            * Mid-price from Polymarket. Real bid/ask verified by bot at execution.
          </div>
        )}

        <div style={{ display: "flex", gap: "8px", marginTop: "18px" }}>
          <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
          <button onClick={confirm} disabled={loading} className="btn btn-success" style={{ flex: 2 }}>
            {loading ? "Opening position…" : "Confirm & Open"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MarketRow({ market, onTrade }: { market: LiveMarket; onTrade: (m: LiveMarket) => void }) {
  return (
    <div
      style={{
        backgroundColor: "var(--card)",
        border: `1px solid ${market.has_arb ? "rgba(16,185,129,0.3)" : "var(--border)"}`,
        borderRadius: "var(--radius)",
        padding: "14px 16px",
        display: "grid",
        gridTemplateColumns: "1fr auto auto auto",
        alignItems: "center",
        gap: "16px",
        transition: "border-color 0.12s",
      }}
    >
      <div>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 500,
            marginBottom: "4px",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            lineHeight: 1.4,
          }}
        >
          {market.has_arb && (
            <span
              style={{
                fontSize: "9px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                backgroundColor: "var(--success-muted)",
                color: "var(--success)",
                borderRadius: "99px",
                padding: "2px 7px",
                marginRight: "8px",
                verticalAlign: "middle",
              }}
            >
              ARB
            </span>
          )}
          {market.question}
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-3)" }}>
          {market.outcomes.map((o, i) => `${o} ${(market.prices[i] * 100).toFixed(0)}c`).join(" · ")}
          {" · "}{fmtVol(market.volume)} vol
        </div>
      </div>

      <div style={{ textAlign: "center", flexShrink: 0 }}>
        <div className="label" style={{ marginBottom: "3px" }}>Sum</div>
        <div className="mono" style={{ fontSize: "14px", fontWeight: 600, color: market.sum_prices < 0.98 ? "var(--success)" : "var(--text-4)" }}>
          {(market.sum_prices * 100).toFixed(0)}c
        </div>
      </div>

      <div style={{ textAlign: "center", flexShrink: 0 }}>
        <div className="label" style={{ marginBottom: "3px" }}>Edge</div>
        <div className="mono" style={{ fontSize: "14px", fontWeight: 600, color: market.has_arb ? "var(--success)" : "var(--text-4)" }}>
          {market.has_arb ? `+${(market.potential_edge * 100).toFixed(1)}%` : "—"}
        </div>
      </div>

      <button
        onClick={() => onTrade(market)}
        className={market.has_arb ? "btn btn-success" : "btn btn-ghost"}
        style={{ fontSize: "12px" }}
      >
        {market.has_arb ? "Trade Arb" : "Paper Trade"}
      </button>
    </div>
  );
}

export default function MarketsPage() {
  const [markets, setMarkets] = useState<LiveMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [selected, setSelected] = useState<LiveMarket | null>(null);
  const [filter, setFilter] = useState<"all" | "arb">("all");
  const [search, setSearch] = useState("");

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/live-markets?limit=150", { cache: "no-store" });
      const data = await res.json();
      if (data.error && (!data.markets || data.markets.length === 0)) {
        setError(data.error);
      } else {
        setMarkets(data.markets ?? []);
        setLastUpdated(new Date().toLocaleTimeString("en-US", { hour12: false }));
      }
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMarkets();
    const iv = setInterval(fetchMarkets, 60_000);
    return () => clearInterval(iv);
  }, [fetchMarkets]);

  const displayed = markets
    .filter((m) => filter === "arb" ? m.has_arb : true)
    .filter((m) => !search || m.question.toLowerCase().includes(search.toLowerCase()));

  const arbCount = markets.filter((m) => m.has_arb).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text)", marginBottom: "3px" }}>Live Markets</h2>
          <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
            Polymarket Gamma API
            {lastUpdated && <span> &middot; Updated {lastUpdated}</span>}
            {arbCount > 0 && (
              <span className="mono" style={{ color: "var(--success)", marginLeft: "8px", fontWeight: 600 }}>
                {arbCount} arb
              </span>
            )}
          </p>
        </div>
        <button onClick={fetchMarkets} disabled={loading} className="btn btn-ghost" style={{ gap: "6px" }}>
          <IconRefresh spinning={loading} />
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      <div className="alert alert-info" style={{ fontSize: "11px" }}>
        Edge estimated from mid-price. Real arbitrage verified by bot via bid/ask CLOB at execution. Sum &lt; 98c = potential locked profit after fees.
      </div>

      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--border)" }}>
          {(["all", "arb"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "6px 14px",
                border: "none",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 500,
                backgroundColor: filter === f ? "var(--accent)" : "transparent",
                color: filter === f ? "#fff" : "var(--text-3)",
                fontFamily: "inherit",
              }}
            >
              {f === "all" ? `All (${markets.length})` : `Arb only (${arbCount})`}
            </button>
          ))}
        </div>
        <input
          className="input"
          placeholder="Search markets…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: "160px" }}
        />
      </div>

      {!loading && displayed.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: "16px", padding: "0 16px" }}>
          {["Question & Prices", "Sum", "Edge*", ""].map((h, i) => (
            <span key={i} className="label" style={{ textAlign: i > 0 ? "center" : undefined }}>{h}</span>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ padding: "56px", textAlign: "center", color: "var(--text-3)", fontSize: "12px" }}>
          Fetching live data from Polymarket…
        </div>
      )}

      {error && !loading && (
        <div className="alert alert-danger" style={{ textAlign: "center" }}>
          <div style={{ marginBottom: "10px" }}>Failed to fetch: {error}</div>
          <button onClick={fetchMarkets} className="btn btn-danger">Retry</button>
        </div>
      )}

      {!loading && !error && displayed.length === 0 && (
        <div style={{ padding: "56px", textAlign: "center", color: "var(--text-3)", fontSize: "12px" }}>
          {filter === "arb"
            ? "No arbitrage opportunities at this time. Markets are currently efficient."
            : search
            ? `No markets matching "${search}"`
            : "No markets found."}
        </div>
      )}

      {!loading && !error && displayed.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {displayed.map((m) => (
            <MarketRow key={m.market_id} market={m} onTrade={setSelected} />
          ))}
        </div>
      )}

      {selected && (
        <TradeModal market={selected} onClose={() => setSelected(null)} onSuccess={() => setSelected(null)} />
      )}
    </div>
  );
}
