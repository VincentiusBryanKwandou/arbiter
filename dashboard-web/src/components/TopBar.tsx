"use client";

import { useEffect, useState } from "react";

export function TopBar() {
  const [status, setStatus] = useState<"ok" | "error" | "loading">("loading");
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch("/api/health");
        setStatus(r.ok ? "ok" : "error");
        setTime(new Date().toLocaleTimeString());
      } catch {
        setStatus("error");
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header
      style={{
        height: "64px",
        borderBottom: "1px solid #1f2d45",
        backgroundColor: "#111827",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        flexShrink: 0,
      }}
    >
      <div>
        <div style={{ fontWeight: 600, fontSize: "14px" }}>
          Political Market Intelligence
        </div>
        <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>
          Cross-market arbitrage · Fractional Kelly · Paper default
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          fontSize: "12px",
          color: "#6b7280",
        }}
      >
        <span
          style={{
            color:
              status === "ok"
                ? "#10b981"
                : status === "error"
                ? "#ef4444"
                : "#94a3b8",
          }}
        >
          {status === "ok" ? "● System OK" : status === "error" ? "● API Error" : "○ Checking…"}
        </span>
        {time && <span>Updated {time}</span>}
      </div>
    </header>
  );
}
