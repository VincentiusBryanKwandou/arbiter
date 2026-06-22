import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Arbiter — Autonomous Arbitrage Intelligence",
  description:
    "Detect Dutch-book arbitrage on Polymarket in real time. Fractional Kelly sizing, automatic kill switch, 24/7 cloud execution — zero manual intervention.",
};

function IconBolt() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function IconArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function IconGitHub() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

const FEATURES = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    ),
    title: "Dutch Book Detection",
    desc: "Scans 200+ Polymarket outcomes per cycle. Flags markets where sum-of-prices < 1.00 — locked arbitrage, zero-risk profit when filled.",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" />
      </svg>
    ),
    title: "Fractional Kelly Sizing",
    desc: "Quarter-Kelly position sizing per trade. No single position exceeds 2% of bankroll. Hard per-trade cap enforced at execution, always.",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: "10% Kill Switch",
    desc: "If daily loss exceeds 10% of initial capital, the bot halts automatically — no human required. Resets the next trading day.",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    title: "24/7 Cloud Execution",
    desc: "GitHub Actions runs the scanner every 5 minutes. Vercel Edge serves the dashboard on every request. No server to manage, ever.",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-5" />
      </svg>
    ),
    title: "Walk-Forward Backtest",
    desc: "Monte Carlo ruin probability across 5,000 bootstrap paths. Sharpe ratio, max drawdown, and live-gate assessment before capital deployment.",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    title: "Paper-First Default",
    desc: "All trades paper-executed by default. Real fills only after setting POLYMARKET_PRIVATE_KEY. Deploy with confidence, not hope.",
  },
];

const STATS = [
  { label: "Markets Scanned / Cycle", value: "200+" },
  { label: "Scan Interval", value: "5 min" },
  { label: "Min Edge Threshold", value: "3%" },
  { label: "Kelly Multiplier", value: "×0.25" },
];

export default function LandingPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#080b12",
        color: "#f1f5f9",
        fontFamily: "var(--font-inter, Inter, system-ui, sans-serif)",
        overflowX: "hidden",
      }}
    >
      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 40px",
          height: "60px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          position: "sticky",
          top: 0,
          zIndex: 50,
          backgroundColor: "rgba(8,11,18,0.9)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              boxShadow: "0 0 20px rgba(37,99,235,0.4)",
            }}
          >
            <IconBolt />
          </div>
          <span style={{ fontWeight: 800, fontSize: "16px", letterSpacing: "-0.03em" }}>Arbiter</span>
          <span
            style={{
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "0.12em",
              backgroundColor: "rgba(59,130,246,0.12)",
              color: "#60a5fa",
              padding: "2px 7px",
              borderRadius: "4px",
              border: "1px solid rgba(59,130,246,0.2)",
            }}
          >
            PAPER
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <a
            href="https://github.com/nayrbryanGaming/arbiter"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 500,
              color: "rgba(241,245,249,0.7)",
              textDecoration: "none",
              border: "1px solid rgba(255,255,255,0.08)",
              transition: "border-color 0.15s, color 0.15s",
            }}
          >
            <IconGitHub />
            GitHub
          </a>
          <Link
            href="/dashboard"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 16px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 600,
              color: "#fff",
              textDecoration: "none",
              background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
              boxShadow: "0 0 16px rgba(59,130,246,0.35)",
              transition: "opacity 0.15s",
            }}
          >
            Dashboard <IconArrow />
          </Link>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <section
        style={{
          position: "relative",
          padding: "100px 40px 80px",
          textAlign: "center",
          overflow: "hidden",
        }}
      >
        {/* Background glow */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "0",
            left: "50%",
            transform: "translateX(-50%)",
            width: "600px",
            height: "400px",
            background: "radial-gradient(ellipse, rgba(37,99,235,0.18) 0%, transparent 65%)",
            pointerEvents: "none",
          }}
        />
        {/* Grid pattern */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative" }}>
          {/* Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 14px",
              borderRadius: "99px",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.04em",
              backgroundColor: "rgba(16,185,129,0.08)",
              color: "#10b981",
              border: "1px solid rgba(16,185,129,0.2)",
              marginBottom: "28px",
            }}
          >
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "#10b981",
                boxShadow: "0 0 6px #10b981",
                animation: "pulse 2s ease-in-out infinite",
              }}
            />
            Scanner active · Scanning every 5 minutes
          </div>

          {/* Headline */}
          <h1
            style={{
              fontSize: "clamp(38px, 6vw, 72px)",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              lineHeight: 1.05,
              color: "#f8fafc",
              marginBottom: "24px",
              maxWidth: "800px",
              margin: "0 auto 24px",
            }}
          >
            Autonomous{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #60a5fa 0%, #34d399 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Arbitrage
            </span>
            <br />
            Intelligence
          </h1>

          {/* Subheadline */}
          <p
            style={{
              fontSize: "clamp(14px, 2vw, 18px)",
              color: "rgba(241,245,249,0.55)",
              lineHeight: 1.7,
              maxWidth: "520px",
              margin: "0 auto 44px",
            }}
          >
            Detect Dutch-book inefficiencies on Polymarket in real time.
            Quarter-Kelly sizing, 10% kill switch, zero human intervention.
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/dashboard"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "13px 28px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 700,
                color: "#fff",
                textDecoration: "none",
                background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                boxShadow: "0 0 30px rgba(59,130,246,0.4), 0 4px 20px rgba(0,0,0,0.3)",
                letterSpacing: "-0.01em",
              }}
            >
              Open Dashboard <IconArrow />
            </Link>
            <a
              href="https://github.com/nayrbryanGaming/arbiter"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "13px 28px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                color: "rgba(241,245,249,0.8)",
                textDecoration: "none",
                backgroundColor: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                letterSpacing: "-0.01em",
              }}
            >
              <IconGitHub /> View Source
            </a>
          </div>
        </div>
      </section>

      {/* ── Stats bar ──────────────────────────────────────────────────────────── */}
      <section
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          backgroundColor: "rgba(255,255,255,0.02)",
        }}
      >
        <div
          style={{
            maxWidth: "900px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: `repeat(${STATS.length}, 1fr)`,
            padding: "0",
          }}
        >
          {STATS.map(({ label, value }, i) => (
            <div
              key={label}
              style={{
                padding: "28px 24px",
                textAlign: "center",
                borderRight: i < STATS.length - 1 ? "1px solid rgba(255,255,255,0.06)" : undefined,
              }}
            >
              <div
                style={{
                  fontSize: "clamp(22px, 3vw, 32px)",
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  color: "#f1f5f9",
                  fontFamily: "var(--font-inter, monospace)",
                  marginBottom: "6px",
                }}
              >
                {value}
              </div>
              <div style={{ fontSize: "11px", color: "rgba(241,245,249,0.4)", fontWeight: 500, letterSpacing: "0.04em" }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────────── */}
      <section style={{ padding: "80px 40px", maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "56px" }}>
          <div
            style={{
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.15em",
              color: "#3b82f6",
              textTransform: "uppercase",
              marginBottom: "12px",
            }}
          >
            System Design
          </div>
          <h2
            style={{
              fontSize: "clamp(24px, 4vw, 40px)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "#f8fafc",
              lineHeight: 1.15,
            }}
          >
            Built for edge, not excitement
          </h2>
          <p
            style={{
              fontSize: "15px",
              color: "rgba(241,245,249,0.45)",
              marginTop: "14px",
              maxWidth: "480px",
              margin: "14px auto 0",
              lineHeight: 1.7,
            }}
          >
            Every component designed around one constraint: never lose more than you can afford, automatically.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "16px",
          }}
        >
          {FEATURES.map(({ icon, title, desc }) => (
            <div
              key={title}
              style={{
                padding: "24px",
                borderRadius: "12px",
                backgroundColor: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.06)",
                transition: "border-color 0.2s, background-color 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(59,130,246,0.3)";
                (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(59,130,246,0.05)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)";
                (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.025)";
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(59,130,246,0.1)",
                  color: "#60a5fa",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "16px",
                  border: "1px solid rgba(59,130,246,0.15)",
                }}
              >
                {icon}
              </div>
              <h3
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#f1f5f9",
                  marginBottom: "8px",
                  letterSpacing: "-0.01em",
                }}
              >
                {title}
              </h3>
              <p
                style={{
                  fontSize: "13px",
                  color: "rgba(241,245,249,0.5)",
                  lineHeight: 1.65,
                  margin: 0,
                }}
              >
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────────── */}
      <section
        style={{
          padding: "80px 40px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          backgroundColor: "rgba(255,255,255,0.015)",
        }}
      >
        <div style={{ maxWidth: "700px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <div
              style={{
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.15em",
                color: "#10b981",
                textTransform: "uppercase",
                marginBottom: "12px",
              }}
            >
              Execution Loop
            </div>
            <h2
              style={{
                fontSize: "clamp(22px, 3.5vw, 36px)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: "#f8fafc",
              }}
            >
              Fully autonomous, top to bottom
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {[
              {
                step: "01",
                title: "GitHub Actions triggers every 5 min",
                desc: "No server required. A scheduled workflow calls the Polymarket Gamma API and ingests live market data.",
              },
              {
                step: "02",
                title: "Dutch book scan across 200+ markets",
                desc: "For each multi-outcome market, sum all outcome prices. If sum < 0.98, the gap represents locked arbitrage after a 2% fee buffer.",
              },
              {
                step: "03",
                title: "Quarter-Kelly position sizing",
                desc: "For each edge found: bet size = bankroll × (edge / odds) × 0.25. Hard cap at 2% of bankroll per trade.",
              },
              {
                step: "04",
                title: "Paper trade logged to GitHub",
                desc: "Trade data committed with [skip vercel] tag — Vercel dashboard pulls from raw.githubusercontent.com on every request.",
              },
              {
                step: "05",
                title: "Dashboard served edge-fresh",
                desc: "Vercel Edge Function runs a live scan on each dashboard load, merging GitHub state with real-time data. No stale cache.",
              },
            ].map(({ step, title, desc }, i, arr) => (
              <div
                key={step}
                style={{
                  display: "flex",
                  gap: "20px",
                  padding: "24px 0",
                  borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : undefined,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-inter, monospace)",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#3b82f6",
                    opacity: 0.7,
                    flexShrink: 0,
                    paddingTop: "3px",
                    minWidth: "28px",
                  }}
                >
                  {step}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#f1f5f9",
                      marginBottom: "6px",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {title}
                  </div>
                  <div style={{ fontSize: "13px", color: "rgba(241,245,249,0.45)", lineHeight: 1.65 }}>
                    {desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section style={{ padding: "100px 40px", textAlign: "center" }}>
        <div
          style={{
            maxWidth: "560px",
            margin: "0 auto",
            padding: "56px 40px",
            borderRadius: "16px",
            backgroundColor: "rgba(59,130,246,0.06)",
            border: "1px solid rgba(59,130,246,0.15)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: "-40%",
              left: "50%",
              transform: "translateX(-50%)",
              width: "400px",
              height: "300px",
              background: "radial-gradient(ellipse, rgba(37,99,235,0.2) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />
          <div style={{ position: "relative" }}>
            <h2
              style={{
                fontSize: "clamp(22px, 3vw, 32px)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: "#f8fafc",
                marginBottom: "14px",
              }}
            >
              Ready to see live data?
            </h2>
            <p
              style={{
                fontSize: "14px",
                color: "rgba(241,245,249,0.5)",
                lineHeight: 1.7,
                marginBottom: "32px",
              }}
            >
              The dashboard shows real-time Polymarket scans, equity curve, trade log, and risk gauges — all updated every 30 seconds.
            </p>
            <Link
              href="/dashboard"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "14px 32px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 700,
                color: "#fff",
                textDecoration: "none",
                background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                boxShadow: "0 0 30px rgba(59,130,246,0.5)",
                letterSpacing: "-0.01em",
              }}
            >
              Open Dashboard <IconArrow />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "28px 40px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "6px",
              background: "linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "rgba(241,245,249,0.6)", letterSpacing: "-0.02em" }}>
            Arbiter
          </span>
          <span style={{ fontSize: "11px", color: "rgba(241,245,249,0.25)" }}>
            Paper trading · No financial advice
          </span>
        </div>
        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          <a
            href="https://github.com/nayrbryanGaming/arbiter"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: "12px", color: "rgba(241,245,249,0.35)", textDecoration: "none" }}
          >
            GitHub
          </a>
          <Link href="/dashboard" style={{ fontSize: "12px", color: "rgba(241,245,249,0.35)", textDecoration: "none" }}>
            Dashboard
          </Link>
          <Link href="/risk" style={{ fontSize: "12px", color: "rgba(241,245,249,0.35)", textDecoration: "none" }}>
            Risk Monitor
          </Link>
        </div>
      </footer>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
