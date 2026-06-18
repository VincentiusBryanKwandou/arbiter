"use client";

import { useEffect, useState } from "react";

export function TopBar() {
  const [status, setStatus] = useState<"ok" | "error" | "loading">("loading");
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-US", { hour12: false }));
    tick();
    const clockId = setInterval(tick, 1000);
    return () => clearInterval(clockId);
  }, []);

  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch("/api/health", { cache: "no-store" });
        setStatus(r.ok ? "ok" : "error");
      } catch {
        setStatus("error");
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);

  const dotColor =
    status === "ok" ? "var(--success)" :
    status === "error" ? "var(--danger)" :
    "var(--text-4)";

  const statusLabel =
    status === "ok" ? "System OK" :
    status === "error" ? "API Error" :
    "Checking";

  return (
    <header
      style={{
        height: "56px",
        borderBottom: "1px solid var(--border-subtle)",
        backgroundColor: "var(--surface)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        flexShrink: 0,
      }}
    >
      <div>
        <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text)" }}>
          Political Market Intelligence
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "1px" }}>
          Cross-market arbitrage · Fractional Kelly · Paper default
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        {clock && (
          <span className="mono" style={{ fontSize: "12px", color: "var(--text-3)" }}>
            {clock}
          </span>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            className="status-dot"
            style={{
              backgroundColor: dotColor,
              boxShadow: status === "ok" ? `0 0 6px ${dotColor}` : undefined,
            }}
          />
          <span style={{ fontSize: "12px", color: "var(--text-3)" }}>{statusLabel}</span>
        </div>
      </div>
    </header>
  );
}
