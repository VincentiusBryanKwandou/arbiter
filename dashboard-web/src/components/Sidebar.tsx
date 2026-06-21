"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function IconDashboard() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function IconMarkets() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function IconTrades() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  );
}

function IconBacktest() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-5" />
    </svg>
  );
}

function IconRisk() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function LogoMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor" />
    </svg>
  );
}

const NAV = [
  { href: "/",         label: "Dashboard",    Icon: IconDashboard },
  { href: "/markets",  label: "Markets",      Icon: IconMarkets },
  { href: "/trades",   label: "Trade Log",    Icon: IconTrades },
  { href: "/backtest", label: "Backtest",     Icon: IconBacktest },
  { href: "/risk",     label: "Risk Monitor", Icon: IconRisk },
];

export function Sidebar() {
  const path = usePathname();

  return (
    <aside
      style={{
        width: "var(--sidebar-w)",
        flexShrink: 0,
        backgroundColor: "var(--surface)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Logo */}
      <div
        style={{
          height: "52px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "0 16px",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "8px",
            background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            flexShrink: 0,
            boxShadow: "0 2px 8px rgba(59,130,246,0.3)",
          }}
        >
          <LogoMark />
        </div>
        <span
          style={{
            fontWeight: 700,
            fontSize: "14px",
            letterSpacing: "-0.02em",
            color: "var(--text)",
          }}
        >
          Arbiter
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: "9px",
            fontWeight: 600,
            letterSpacing: "0.08em",
            backgroundColor: "var(--accent-muted)",
            color: "var(--accent)",
            padding: "2px 6px",
            borderRadius: "99px",
            border: "1px solid rgba(59,130,246,0.15)",
          }}
        >
          PAPER
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: "1px" }}>
        <div className="label" style={{ padding: "0 10px 8px", fontSize: "9px" }}>
          Navigation
        </div>
        {NAV.map(({ href, label, Icon }) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              className={`nav-link${active ? " active" : ""}`}
            >
              <Icon />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            className="status-dot status-dot-live"
            style={{
              backgroundColor: "var(--success)",
              boxShadow: "0 0 4px var(--success)",
            }}
          />
          <span style={{ fontSize: "11px", color: "var(--text-3)" }}>
            Scanner active 24/7
          </span>
        </div>
        <a
          href="https://github.com/nayrbryanGaming/arbiter"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "var(--text-4)",
            textDecoration: "none",
            fontSize: "10px",
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "var(--accent)")}
          onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "var(--text-4)")}
        >
          github/nayrbryanGaming/arbiter
        </a>
      </div>
    </aside>
  );
}
