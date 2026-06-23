import type { MarketOpportunity } from "@/types";

function IconTrend() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: "32px 16px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
      }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--text-4)" }}>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <div style={{ fontSize: "12px", color: "var(--text-3)" }}>{label}</div>
    </div>
  );
}

export function OpportunitiesFeed({
  opportunities,
  botConnected = true,
  vercelNative = false,
}: {
  opportunities: MarketOpportunity[];
  botConnected?: boolean;
  vercelNative?: boolean;
}) {
  if (!opportunities?.length) {
    return (
      <EmptyState
        label={
          vercelNative
            ? "No arb edge this scan — markets look efficient."
            : botConnected
            ? "Scanner running — no edge above threshold."
            : "No opportunities in snapshot."
        }
      />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "5px",
        maxHeight: "240px",
        overflowY: "auto",
        paddingRight: "2px",
      }}
    >
      {opportunities.map((opp, idx) => {
        const strong = opp.edge_pct > 0.06;
        const edgeColor = strong ? "var(--success)" : "var(--accent)";
        return (
          <div
            key={opp.market_id}
            style={{
              display: "flex",
              gap: "10px",
              padding: "10px 12px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: strong
                ? "rgba(16,185,129,0.04)"
                : "var(--bg)",
              border: `1px solid ${strong ? "rgba(16,185,129,0.15)" : "var(--border-subtle)"}`,
              alignItems: "center",
              animation: `fade-in 0.2s ease ${idx * 30}ms both`,
            }}
          >
            {/* Rank */}
            <div
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                backgroundColor: strong ? "var(--success-muted)" : "var(--accent-muted)",
                color: edgeColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontSize: "9px",
                fontWeight: 700,
              }}
            >
              {idx + 1}
            </div>

            {/* Question */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--text)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginBottom: "3px",
                  fontWeight: 500,
                }}
              >
                {opp.question}
              </div>
              <div style={{ fontSize: "10px", color: "var(--text-3)" }}>
                {opp.venue} &middot; ${opp.depth_usd.toFixed(0)} liquidity
              </div>
            </div>

            {/* Edge */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                flexShrink: 0,
                gap: "2px",
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: edgeColor,
                  display: "flex",
                  alignItems: "center",
                  gap: "3px",
                }}
              >
                <IconTrend />
                +{(opp.edge_pct * 100).toFixed(1)}%
              </div>
              <div style={{ fontSize: "9px", color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                edge
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
