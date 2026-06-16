"use client";

import { useCallback, useEffect, useState } from "react";
import type { Position, ScanOpportunity } from "@/types";
import {
  setBankroll,
  scanMarkets,
  openPosition,
  listPositions,
  closePosition,
} from "@/lib/api";

// ── Styles ──────────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  backgroundColor: "#1a2234",
  border: "1px solid #1f2d45",
  borderRadius: "12px",
  padding: "16px",
};

const btn = (variant: "primary" | "danger" | "ghost" | "success"): React.CSSProperties => ({
  padding: "8px 16px",
  borderRadius: "8px",
  border: "none",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: 600,
  backgroundColor:
    variant === "primary" ? "#3b82f6"
    : variant === "danger" ? "#ef4444"
    : variant === "success" ? "#10b981"
    : "rgba(255,255,255,0.07)",
  color: "#fff",
  transition: "opacity 0.15s",
});

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0,0,0,0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modal: React.CSSProperties = {
  backgroundColor: "#0f172a",
  border: "1px solid #1f2d45",
  borderRadius: "16px",
  padding: "28px",
  width: "520px",
  maxWidth: "95vw",
  maxHeight: "85vh",
  overflowY: "auto",
};

// ── Add Funds Modal ─────────────────────────────────────────────────────────
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
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const submit = async () => {
    const amount = parseFloat(value);
    if (isNaN(amount) || amount <= 0) {
      setMsg({ text: "Masukkan nominal yang valid (> 0)", ok: false });
      return;
    }
    setLoading(true);
    const res = await setBankroll(amount, "set via dashboard");
    setLoading(false);
    if (res.ok) {
      setMsg({ text: `Bankroll diperbarui: $${res.old.toFixed(2)} → $${res.new.toFixed(2)}`, ok: true });
      setTimeout(() => { onSuccess(res.new); onClose(); }, 1200);
    } else {
      setMsg({ text: (res as { detail?: string }).detail ?? "Gagal memperbarui bankroll", ok: false });
    }
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
          <span style={{ fontSize: "16px", fontWeight: 700 }}>Tambah / Ubah Dana</span>
          <button onClick={onClose} style={{ ...btn("ghost"), padding: "4px 10px" }}>×</button>
        </div>

        <div style={{ marginBottom: "8px", fontSize: "12px", color: "#94a3b8" }}>
          Bankroll saat ini: <strong style={{ color: "#3b82f6" }}>${current.toFixed(2)}</strong>
        </div>

        <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>
          Nominal baru (USD)
        </label>
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          style={{
            width: "100%",
            padding: "10px 12px",
            backgroundColor: "#1a2234",
            border: "1px solid #1f2d45",
            borderRadius: "8px",
            color: "#fff",
            fontSize: "15px",
            outline: "none",
            boxSizing: "border-box",
          }}
          autoFocus
        />

        {msg && (
          <div
            style={{
              marginTop: "10px",
              padding: "10px",
              borderRadius: "8px",
              fontSize: "13px",
              backgroundColor: msg.ok ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
              color: msg.ok ? "#10b981" : "#ef4444",
            }}
          >
            {msg.text}
          </div>
        )}

        <div style={{ display: "flex", gap: "8px", marginTop: "16px", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btn("ghost")}>Batal</button>
          <button onClick={submit} disabled={loading} style={{ ...btn("primary"), opacity: loading ? 0.6 : 1 }}>
            {loading ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Open Position Modal ──────────────────────────────────────────────────────
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
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
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
      setMsg({ text: "Masukkan jumlah sets yang valid", ok: false });
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
      setMsg({ text: `✓ Posisi dibuka! Profit terkunci: $${res.position.locked_profit.toFixed(4)}`, ok: true });
      setStep("done");
      setTimeout(() => { onSuccess(); onClose(); }, 1800);
    } else {
      setMsg({ text: (res as { detail?: string }).detail ?? "Gagal membuka posisi", ok: false });
    }
  };

  const pct = (n: number) => `+${(n * 100).toFixed(2)}%`;

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
          <span style={{ fontSize: "16px", fontWeight: 700 }}>Buka Posisi Paper</span>
          <button onClick={onClose} style={{ ...btn("ghost"), padding: "4px 10px" }}>×</button>
        </div>

        {/* Step: idle */}
        {(step === "idle" || step === "scanning") && (
          <div>
            <p style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "16px" }}>
              Scan Polymarket live untuk menemukan peluang arbitrage.
            </p>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px" }}>
              <label style={{ fontSize: "12px", color: "#94a3b8", whiteSpace: "nowrap" }}>Min Edge</label>
              <input
                type="number"
                value={minEdge}
                step="0.01"
                min="0"
                max="0.5"
                onChange={(e) => setMinEdge(e.target.value)}
                style={{
                  width: "80px", padding: "6px 8px",
                  backgroundColor: "#1a2234", border: "1px solid #1f2d45",
                  borderRadius: "6px", color: "#fff", fontSize: "13px", outline: "none",
                }}
              />
              <span style={{ fontSize: "12px", color: "#6b7280" }}>
                ({(parseFloat(minEdge) * 100 || 3).toFixed(0)}%)
              </span>
            </div>
            {scanErr && (
              <div style={{ padding: "10px", borderRadius: "8px", fontSize: "12px",
                backgroundColor: "rgba(239,68,68,0.1)", color: "#ef4444", marginBottom: "12px" }}>
                {scanErr.includes("8001") || scanErr.includes("offline") || scanErr.includes("connect")
                  ? "Bot API tidak aktif. Jalankan: uvicorn api.server:app --port 8001"
                  : scanErr}
              </div>
            )}
            <button
              onClick={doScan}
              disabled={step === "scanning"}
              style={{ ...btn("primary"), width: "100%", opacity: step === "scanning" ? 0.6 : 1 }}
            >
              {step === "scanning" ? "Sedang scan pasar (~10–30 detik)…" : "Scan Pasar Sekarang"}
            </button>
          </div>
        )}

        {/* Step: select */}
        {step === "select" && (
          <div>
            <div style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "12px" }}>
              Ditemukan <strong style={{ color: "#10b981" }}>{results.length}</strong> peluang.
              {results.length === 0 && " Pasar efisien saat ini — tidak ada arb yang lolos filter."}
            </div>
            {results.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "340px", overflowY: "auto" }}>
                {results.map((opp) => (
                  <div
                    key={opp.market_id}
                    onClick={() => { setSelected(opp); setStep("confirm"); }}
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      border: "1px solid #1f2d45",
                      backgroundColor: "#0f172a",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      transition: "border-color 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1f2d45")}
                  >
                    <div style={{ flex: 1, minWidth: 0, marginRight: "12px" }}>
                      <div style={{ fontSize: "12px", fontWeight: 500, marginBottom: "2px",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {opp.question}
                      </div>
                      <div style={{ fontSize: "11px", color: "#6b7280" }}>
                        {opp.strategy} · ${opp.required_capital.toFixed(2)} modal
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#10b981", fontFamily: "monospace" }}>
                        {pct(opp.edge_pct)}
                      </div>
                      <div style={{ fontSize: "11px", color: "#6b7280" }}>edge</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setStep("idle")} style={{ ...btn("ghost"), marginTop: "12px", width: "100%" }}>
              Scan Ulang
            </button>
          </div>
        )}

        {/* Step: confirm */}
        {step === "confirm" && selected && (
          <div>
            <div style={{ ...card, marginBottom: "16px" }}>
              <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>Pasar dipilih</div>
              <div style={{ fontSize: "13px", fontWeight: 500, marginBottom: "8px" }}>{selected.question}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                {[
                  ["Edge", pct(selected.edge_pct)],
                  ["Cost/set", `$${selected.cost_per_set.toFixed(4)}`],
                  ["Max sets", selected.executable_sets.toFixed(2)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: "10px", color: "#6b7280" }}>{k}</div>
                    <div style={{ fontSize: "13px", fontFamily: "monospace", color: "#3b82f6" }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>
              Jumlah sets (max: {selected.executable_sets.toFixed(2)})
            </label>
            <input
              type="number"
              value={sets}
              step="0.1"
              min="0.01"
              max={selected.executable_sets}
              onChange={(e) => setSets(e.target.value)}
              autoFocus
              style={{
                width: "100%", padding: "10px 12px",
                backgroundColor: "#1a2234", border: "1px solid #1f2d45",
                borderRadius: "8px", color: "#fff", fontSize: "15px",
                outline: "none", boxSizing: "border-box",
              }}
            />
            <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "6px" }}>
              Estimasi profit terkunci:{" "}
              <strong style={{ color: "#10b981" }}>
                ${((parseFloat(sets) || 0) * (1 - selected.cost_per_set)).toFixed(4)}
              </strong>
              {" · "}Modal:{" "}
              <strong style={{ color: "#94a3b8" }}>
                ${((parseFloat(sets) || 0) * selected.cost_per_set).toFixed(2)}
              </strong>
            </div>

            {msg && (
              <div style={{
                marginTop: "10px", padding: "10px", borderRadius: "8px", fontSize: "13px",
                backgroundColor: msg.ok ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                color: msg.ok ? "#10b981" : "#ef4444",
              }}>
                {msg.text}
              </div>
            )}

            <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
              <button onClick={() => setStep("select")} style={{ ...btn("ghost"), flex: 1 }}>Kembali</button>
              <button
                onClick={doOpen}
                disabled={loading}
                style={{ ...btn("success"), flex: 2, opacity: loading ? 0.6 : 1 }}
              >
                {loading ? "Membuka posisi…" : "Konfirmasi & Buka Posisi"}
              </button>
            </div>
          </div>
        )}

        {step === "done" && msg && (
          <div style={{ textAlign: "center", padding: "20px 0", color: "#10b981", fontSize: "15px" }}>
            {msg.text}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Positions Table ───────────────────────────────────────────────────────────
function PositionsTable({
  positions,
  onClose,
}: {
  positions: Position[];
  onClose: (id: string) => void;
}) {
  const open = positions.filter((p) => p.status === "open");
  if (open.length === 0) return null;

  return (
    <div style={card}>
      <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "12px", fontWeight: 500 }}>
        Posisi Terbuka ({open.length})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {open.map((p) => (
          <div
            key={p.id}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 12px", borderRadius: "8px",
              backgroundColor: "#0f172a", border: "1px solid #1f2d45",
            }}
          >
            <div style={{ flex: 1, minWidth: 0, marginRight: "12px" }}>
              <div style={{ fontSize: "12px", fontWeight: 500, marginBottom: "2px",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.question}
              </div>
              <div style={{ fontSize: "11px", color: "#6b7280" }}>
                {p.sets.toFixed(2)} sets · ${p.notional_usd.toFixed(2)} modal · {p.venue}
              </div>
            </div>
            <div style={{ textAlign: "right", marginRight: "12px", flexShrink: 0 }}>
              <div style={{ fontSize: "13px", fontFamily: "monospace",
                color: p.locked_profit >= 0 ? "#10b981" : "#ef4444" }}>
                {p.locked_profit >= 0 ? "+" : ""}${p.locked_profit.toFixed(4)}
              </div>
              <div style={{ fontSize: "10px", color: "#6b7280" }}>
                {(p.edge_pct * 100).toFixed(1)}% edge
              </div>
            </div>
            <button
              onClick={() => onClose(p.id)}
              style={{ ...btn("danger"), padding: "5px 10px", fontSize: "11px" }}
            >
              Tutup
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Bot Status Bar ────────────────────────────────────────────────────────────
function BotStatusBadge({ online }: { online: boolean | null }) {
  if (online === null) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "6px",
      padding: "4px 10px", borderRadius: "20px", fontSize: "11px",
      backgroundColor: online ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
      border: `1px solid ${online ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
      color: online ? "#10b981" : "#ef4444",
    }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%",
        backgroundColor: online ? "#10b981" : "#ef4444", display: "inline-block" }} />
      {online ? "Bot API aktif" : "Bot API offline"}
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

  // Check bot status on mount
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/bot/health", { signal: AbortSignal.timeout(3000) });
        setBotOnline(res.ok);
        if (res.ok) {
          await refreshPositions();
        }
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
      {/* Action bar */}
      <div style={{
        display: "flex", gap: "8px", alignItems: "center",
        flexWrap: "wrap",
      }}>
        <button onClick={() => setShowFunds(true)} style={btn("primary")}>
          + Tambah / Ubah Dana
        </button>
        <button
          onClick={() => setShowPosition(true)}
          disabled={!botOnline}
          title={botOnline ? undefined : "Bot API offline — jalankan uvicorn api.server:app --port 8001"}
          style={{ ...btn("success"), opacity: botOnline ? 1 : 0.4 }}
        >
          Buka Posisi
        </button>
        <div style={{ marginLeft: "auto" }}>
          <BotStatusBadge online={botOnline} />
        </div>
      </div>

      {!botOnline && botOnline !== null && (
        <div style={{
          padding: "10px 14px", borderRadius: "8px", fontSize: "12px",
          backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          color: "#94a3b8",
        }}>
          <strong style={{ color: "#ef4444" }}>Bot API tidak aktif.</strong>{" "}
          Jalankan di terminal project root:{" "}
          <code style={{ backgroundColor: "#0f172a", padding: "2px 6px", borderRadius: "4px",
            color: "#3b82f6", fontFamily: "monospace" }}>
            uvicorn api.server:app --host 0.0.0.0 --port 8001
          </code>
          {" "}untuk mengaktifkan buka posisi & scan pasar.
        </div>
      )}

      {/* Positions table */}
      <PositionsTable positions={positions} onClose={handleClose} />

      {/* Modals */}
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
