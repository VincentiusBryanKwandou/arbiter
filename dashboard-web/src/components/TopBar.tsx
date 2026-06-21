"use client";

import { useEffect, useState } from "react";

function IconActivity() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

export function TopBar() {
  const [status, setStatus] = useState<"ok" | "error" | "loading">("loading");
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString("en-US", { hour12: false, timeZone: "UTC" }) + " UTC");
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
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

  const isOk = status === "ok";

  return (
    <header
      style={{
        height: "52px",
        borderBottom: "1px solid var(--border-subtle)",
        backgroundColor: "var(--surface)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        flexShrink: 0,
        gap: "16px",
      }}
    >
      {/* Left: page context */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <IconActivity />
        <div style={{ fontSize: "12px", color: "var(--text-3)" }}>
          Political Market Intelligence &mdash; Dutch book · ¼-Kelly · Paper default
        </div>
      </div>

      {/* Right: clock + health */}
      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        {clock && (
          <span
            className="mono"
            style={{ fontSize: "11px", color: "var(--text-3)", letterSpacing: "0.03em" }}
          >
            {clock}
          </span>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "3px 10px",
            borderRadius: "99px",
            border: `1px solid ${isOk ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
            backgroundColor: isOk ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)",
          }}
        >
          <div
            className={`status-dot${isOk ? " status-dot-live" : ""}`}
            style={{
              backgroundColor: isOk ? "var(--success)" : status === "error" ? "var(--danger)" : "var(--text-4)",
              boxShadow: isOk ? "0 0 5px var(--success)" : undefined,
            }}
          />
          <span
            style={{
              fontSize: "11px",
              fontWeight: 500,
              color: isOk ? "var(--success)" : status === "error" ? "var(--danger)" : "var(--text-3)",
            }}
          >
            {isOk ? "System Live" : status === "error" ? "API Error" : "Checking"}
          </span>
        </div>
      </div>
    </header>
  );
}
