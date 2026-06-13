"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Dashboard", icon: "◉" },
  { href: "/markets", label: "Markets", icon: "↗" },
  { href: "/trades", label: "Trade Log", icon: "≡" },
  { href: "/backtest", label: "Backtest", icon: "⌛" },
  { href: "/risk", label: "Risk Monitor", icon: "⚡" },
];

export function Sidebar() {
  const path = usePathname();

  return (
    <aside
      style={{
        width: "220px",
        flexShrink: 0,
        backgroundColor: "#111827",
        borderRight: "1px solid #1f2d45",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Logo */}
      <div
        style={{
          height: "64px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "0 16px",
          borderBottom: "1px solid #1f2d45",
        }}
      >
        <div
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "8px",
            backgroundColor: "#3b82f6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "14px",
          }}
        >
          ⚡
        </div>
        <span style={{ fontWeight: 600, fontSize: "15px" }}>Arbiter</span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: "10px",
            fontFamily: "monospace",
            backgroundColor: "rgba(59,130,246,0.2)",
            color: "#60a5fa",
            padding: "2px 6px",
            borderRadius: "4px",
          }}
        >
          PAPER
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px" }}>
        {NAV.map(({ href, label, icon }) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "13px",
                textDecoration: "none",
                marginBottom: "2px",
                backgroundColor: active ? "rgba(59,130,246,0.1)" : "transparent",
                color: active ? "#60a5fa" : "#94a3b8",
                fontWeight: active ? 500 : 400,
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: "12px" }}>{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid #1f2d45",
          fontSize: "11px",
          color: "#6b7280",
        }}
      >
        <div>66 tests passing</div>
        <a
          href="https://github.com/nayrbryanGaming/arbiter"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#3b82f6", textDecoration: "none" }}
        >
          github ↗
        </a>
      </div>
    </aside>
  );
}
