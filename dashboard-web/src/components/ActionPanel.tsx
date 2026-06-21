"use client";

import { useCallback, useEffect, useState } from "react";
import type { Position, ScanOpportunity } from "@/types";
import { setBankroll, scanMarkets, openPosition, listPositions, closePosition } from "@/lib/api";

// ── Icons ────────────────────────────────────────────────────────────────────
function IconPlus() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const S = {
  infoRow: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "2px",
  },
  infoLabel: {
    fontSize: "10px",
    color: "var(--text-3)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  infoValue: {
    fontSize: "13px",
    fontFamily: "monospace",
    color: "var(--accent)",
    fontWeight: 600,
  },
};

// ── Add Funds Modal ───────────────────────────────────────────────────────────
function AddFundsModal({
  current,
  onClose,
  onSuccess,
}: {
  current: number;
  onClose: () => void;
  onSuccess: (v: number) => void;
}) {
  const [value, setValue] = useState(String(current));
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ text: string; ok: boolean } | null>(null);

  const submit = async () => {
    const amount = parseFloat(value);
    if (isNaN(amount) || amount <= 0) {
      setAlert({ text: "Enter a valid amount greater than 0.", ok: false });
      return;
    }
    setLoading(true);
    const res = await setBankroll(amount, "set via dashboard");
    setLoading(false);
    if (res.ok) {
      setAlert({ text: `Bankroll updated: $${res.old.toFixed(2)} → $${res.new.toFixed(2)}`, ok: true });
      setTimeout(() => { onSuccess(res.new); onClose(); }, 1200);
    } else {
      setAlert({ text: (res as { detail?: string }).detail ?? "Failed to update bankroll.", ok: false });
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <span className="modal-title">Set Bankroll</span>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: "4px 10px" }}>
            &times;
          </button>
        </div>

        <div style={{ fontSize: "12px", color: "var(--text-3)", marginBottom: "14px" }}>
          Current bankroll:{" "}
          <span className="mono" style={{ color: "var(--accent)", fontWeight: 600 }}>
            ${current.toFixed(2)}
          </span>
        </div>

        <label className="label" style={{ display: "block", marginBottom: "6px" }}>
          New amount (USD)
        </label>
        <input
          className="input"
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          autoFocus
        />

        {alert && (
          <div className={`alert ${alert.ok ? "alert-success" : "alert-danger"}`} style={{ marginTop: "12px" }}>
            {alert.text}
          </div>
        )}

        <div style={{ display: "flex", gap: "8px", marginTop: "18px", justifyContent: "flex-end" }}>
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button onClick={submit} disabled={loading} className="btn btn-primary">
            {loading ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Open Position Modal ───────────────────────────────────────────────────────
type Step = "idle" | "scanning" | "select" | "confirm" | "done";

function OpenPositionModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<Step>("idle");
  const [results, setResults] = useState<ScanOpportunity[]>([]);
  const [selected, setSelected] = useState<ScanOpportunity | null>(null);
  const [sets, setSets] = useState("1");
  const [minEdge, setMinEdge] = useState("0.03");
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ text: string; ok: boolean } | null>(null);
  const [scanErr, setScanErr] = useState<string | null>(null);

  const doScan = async () => {
    setStep("scanning");
    setScanErr(null);
    const edge = parseFloat(minEdge) || 0.03;
    const res = await scanMarkets(60, edge);
    if (res.error && res.count === 0) {
      setScanErr(res.error);
      setStep("idle");
    } else {
      setResults(res.opportunities);
      setStep("select");
    }
  };

  const doOpen = async () => {
    if (!selected) return;
    const setsNum = parseFloat(sets);
    if (isNaN(setsNum) || setsNum <= 0) {
      setAlert({ text: "Enter a valid number of sets.", ok: false });
      return;
    }
    setLoading(true);
    const res = await openPosition({
      market_id: selected.market_id,
      question: selected.question,
      sets: setsNum,
      edge_pct: selected.edge_pct,
      cost_per_set: selected.cost_per_set,
      strategy: selected.strategy,
      venue: selected.venue,
    });
    setLoading(false);
    if (res.ok) {
      setAlert({
        text: `Position opened. Locked profit: $${res.position.locked_profit.toFixed(4)}`,
        ok: true,
      });
      setStep("done");
      setTimeout(() => { onSuccess(); onClose(); }, 1800);
    } else {
      setAlert({
        text: (res as { detail?: string }).detail ?? "Failed to open position.",
        ok: false,
      });
    }
  };

  const pct = (n: number) => `+${(n * 100).toFixed(2)}%`;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <span className="modal-title">Open Paper Position</span>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: "4px 10px" }}>
            &times;
          </button>
        </div>

        {/* Step: idle / scanning */}
        {(step === "idle" || step === "scanning") && (
          <div>
            <p style={{ fontSize: "12px", color: "var(--text-2)", marginBottom: "16px", lineHeight: 1.6 }}>
              Scan Polymarket live for arbitrage opportunities using the Dutch book detector.
            </p>
            <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "14px" }}>
              <label className="label" style={{ whiteSpace: "nowrap" }}>Min edge</label>
              <input
                className="input"
                type="number"
                value={minEdge}
                step="0.01"
                min="0"
                max="0.5"
                onChange={(e) => setMinEdge(e.target.value)}
                style={{ width: "80px" }}
              />
              <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                {(parseFloat(minEdge) * 100 || 3).toFixed(0)}%
              </span>
            </div>

            {scanErr && (
              <div className="alert alert-danger" style={{ marginBottom: "14px" }}>
                {scanErr.includes("8001") || scanErr.includes("offline") || scanErr.includes("connect")
                  ? "Bot API is offline. Run: uvicorn api.server:app --port 8001"
                  : scanErr}
              </div>
            )}

            <button
              onClick={doScan}
              disabled={step === "scanning"}
              className="btn btn-primary"
              style={{ width: "100%" }}
            >
              {step === "scanning" ? "Scanning markets (10–30 s)…" : "Scan Markets Now"}
            </button>
          </div>
        )}

        {/* Step: select */}
        {step === "select" && (
          <div>
            <div style={{ fontSize: "12px", color: "var(--text-2)", marginBottom: "12px" }}>
              Found{" "}
              <span className="mono" style={{ color: "var(--success)", fontWeight: 600 }}>
                {results.length}
              </span>{" "}
              {results.length === 1 ? "opportunity" : "opportunities"}.
              {results.length === 0 && " Markets are currently efficient — no arb passed the filter."}
            </div>

            {results.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "5px", maxHeight: "340px", overflowY: "auto" }}>
                {results.map((opp) => (
                  <button
                    key={opp.market_id}
                    onClick={() => { setSelected(opp); setStep("confirm"); }}
                    style={{
                      background: "none",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      padding: "12px",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      textAlign: "left",
                      transition: "border-color 0.12s, background-color 0.12s",
                      color: "var(--text)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
                      (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent-muted)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                      (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: 500,
                          marginBottom: "3px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {opp.question}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-3)" }}>
                        {opp.strategy} · ${opp.required_capital.toFixed(2)} capital
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div className="mono" style={{ fontSize: "14px", fontWeight: 700, color: "var(--success)" }}>
                        {pct(opp.edge_pct)}
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--text-3)" }}>edge</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <button onClick={() => setStep("idle")} className="btn btn-ghost" style={{ marginTop: "12px", width: "100%" }}>
              Scan again
            </button>
          </div>
        )}

        {/* Step: confirm */}
        {step === "confirm" && selected && (
          <div>
            <div
              className="card"
              style={{ marginBottom: "16px", backgroundColor: "var(--bg)" }}
            >
              <div className="label" style={{ marginBottom: "6px" }}>Selected market</div>
              <div style={{ fontSize: "13px", fontWeight: 500, marginBottom: "12px", lineHeight: 1.4 }}>
                {selected.question}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                {[
                  ["Edge", pct(selected.edge_pct)],
                  ["Cost / set", `$${selected.cost_per_set.toFixed(4)}`],
                  ["Max sets", selected.executable_sets.toFixed(2)],
                ].map(([k, v]) => (
                  <div key={k} style={S.infoRow}>
                    <span style={S.infoLabel}>{k}</span>
                    <span style={S.infoValue}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <label className="label" style={{ display: "block", marginBottom: "6px" }}>
              Number of sets (max {selected.executable_sets.toFixed(2)})
            </label>
            <input
              className="input"
              type="number"
              value={sets}
              step="0.1"
              min="0.01"
              max={selected.executable_sets}
              onChange={(e) => setSets(e.target.value)}
              autoFocus
            />
            <div style={{ display: "flex", gap: "16px", marginTop: "8px", fontSize: "12px" }}>
              <span style={{ color: "var(--text-3)" }}>
                Locked profit:{" "}
                <span className="mono" style={{ color: "var(--success)", fontWeight: 600 }}>
                  ${((parseFloat(sets) || 0) * (1 - selected.cost_per_set)).toFixed(4)}
                </span>
              </span>
              <span style={{ color: "var(--text-3)" }}>
                Capital:{" "}
                <span className="mono" style={{ color: "var(--text-2)" }}>
                  ${((parseFloat(sets) || 0) * selected.cost_per_set).toFixed(2)}
                </span>
              </span>
            </div>

            {alert && (
              <div className={`alert ${alert.ok ? "alert-success" : "alert-danger"}`} style={{ marginTop: "12px" }}>
                {alert.text}
              </div>
            )}

            <div style={{ display: "flex", gap: "8px", marginTop: "18px" }}>
              <button onClick={() => setStep("select")} className="btn btn-ghost" style={{ flex: 1 }}>
                <IconChevronLeft /> Back
              </button>
              <button onClick={doOpen} disabled={loading} className="btn btn-success" style={{ flex: 2 }}>
                {loading ? "Opening position…" : "Confirm & Open"}
              </button>
            </div>
          </div>
        )}

        {step === "done" && alert && (
          <div className="alert alert-success" style={{ textAlign: "center", padding: "24px", fontSize: "13px" }}>
            {alert.text}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Positions Table ────────────────────────────────────────────────────────────
function PositionsTable({ positions, onClose }: { positions: Position[]; onClose: (id: string) => void }) {
  const open = positions.filter((p) => p.status === "open");
  if (!open.length) return null;

  return (
    <div className="card" style={{ backgroundColor: "var(--card)" }}>
      <div className="label" style={{ marginBottom: "12px" }}>
        Open Positions ({open.length})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        {open.map((p) => (
          <div
            key={p.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 12px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--bg)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ flex: 1, minWidth: 0, marginRight: "12px" }}>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  marginBottom: "2px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {p.question}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-3)" }}>
                {p.sets.toFixed(2)} sets · ${p.notional_usd.toFixed(2)} notional · {p.venue}
              </div>
            </div>
            <div style={{ textAlign: "right", marginRight: "12px", flexShrink: 0 }}>
              <div
                className="mono"
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: p.locked_profit >= 0 ? "var(--success)" : "var(--danger)",
                }}
              >
                {p.locked_profit >= 0 ? "+" : ""}${p.locked_profit.toFixed(4)}
              </div>
              <div style={{ fontSize: "10px", color: "var(--text-3)" }}>
                {(p.edge_pct * 100).toFixed(1)}% edge
              </div>
            </div>
            <button
              onClick={() => onClose(p.id)}
              className="btn btn-danger"
              style={{ padding: "5px 10px", fontSize: "11px" }}
            >
              Close
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Bot Status Badge ──────────────────────────────────────────────────────────
function BotStatusBadge({ online }: { online: boolean | null }) {
  if (online === null) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 10px",
        borderRadius: "99px",
        fontSize: "11px",
        fontWeight: 500,
        backgroundColor: online ? "var(--success-muted)" : "var(--danger-muted)",
        border: `1px solid ${online ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
        color: online ? "var(--success)" : "var(--danger)",
      }}
    >
      <div
        className="status-dot"
        style={{ backgroundColor: online ? "var(--success)" : "var(--danger)" }}
      />
      {online ? "Bot connected" : "Bot offline"}
    </div>
  );
}

// ── Main ActionPanel ──────────────────────────────────────────────────────────
export function ActionPanel({ initialBankroll }: { initialBankroll: number }) {
  const [bankroll, setBankrollState] = useState(initialBankroll);
  const [showFunds, setShowFunds] = useState(false);
  const [showPosition, setShowPosition] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [botOnline, setBotOnline] = useState<boolean | null>(null);

  const refreshPositions = useCallback(async () => {
    const { positions: p } = await listPositions();
    setPositions(p);
  }, []);

  useEffect(() => {
    const check = async () => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 4000);
        const res = await fetch("/api/bot/health", { signal: ctrl.signal }).finally(() => clearTimeout(t));
        setBotOnline(res.ok);
        if (res.ok) await refreshPositions();
      } catch {
        setBotOnline(false);
      }
    };
    check();
    const iv = setInterval(check, 30_000);
    return () => clearInterval(iv);
  }, [refreshPositions]);

  const handleClose = async (id: string) => {
    await closePosition(id);
    await refreshPositions();
  };

  return (
    <>
      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => setShowFunds(true)} className="btn btn-primary">
          <IconPlus /> Set Bankroll
        </button>
        <button
          onClick={() => setShowPosition(true)}
          className="btn btn-success"
        >
          Open Position
        </button>
        {botOnline !== null && (
          <div style={{ marginLeft: "auto" }}>
            <BotStatusBadge online={botOnline} />
          </div>
        )}
      </div>

      {botOnline === false && (
        <div style={{ fontSize: "11px", color: "var(--text-3)", paddingLeft: "2px" }}>
          Live bot API offline — positions are simulated (paper).{" "}
          <span className="mono" style={{ color: "var(--text-2)", fontSize: "10px" }}>
            uvicorn api.server:app --host 0.0.0.0 --port 8001
          </span>
        </div>
      )}

      {positions.length > 0 && <PositionsTable positions={positions} onClose={handleClose} />}

      {showFunds && (
        <AddFundsModal
          current={bankroll}
          onClose={() => setShowFunds(false)}
          onSuccess={(v) => setBankrollState(v)}
        />
      )}
      {showPosition && (
        <OpenPositionModal
          onClose={() => setShowPosition(false)}
          onSuccess={refreshPositions}
        />
      )}
    </>
  );
}
