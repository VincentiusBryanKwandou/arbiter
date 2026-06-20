import type { MarketOpportunity } from "@/types";

function IconArrow() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  );
}

export function OpportunitiesFeed({
  opportunities,
  botConnected = true,
}: {
  opportunities: MarketOpportunity[];
  botConnected?: boolean;
}) {
  if (!opportunities.length) {
    return (
      <div style={{ padding: "28px 0", textAlign: "center" }}>
        <div style={{ fontSize: "12px", color: "var(--text-3)", marginBottom: "6px" }}>
          {botConnected
            ? "No active opportunities — scanner is running."
            : "No opportunities in snapshot."}
        </div>
        {!botConnected && (
          <div style={{ fontSize: "11px", color: "var(--text-4)" }}>
            Deploy bot to Railway for live scanning.
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "180px", overflowY: "auto" }}>
      {opportunities.map((opp) => {
        const strong = opp.edge_pct > 0.08;
        return (
          <div
            key={opp.market_id}
            style={{
              display: "flex",
              gap: "10px",
              padding: "10px 12px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--bg)",
              border: `1px solid ${strong ? "rgba(16,185,129,0.2)" : "var(--border-subtle)"}`,
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "5px",
                backgroundColor: strong ? "var(--success-muted)" : "var(--accent-muted)",
                color: strong ? "var(--success)" : "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: "1px",
              }}
            >
              <IconArrow />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--text)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginBottom: "3px",
                }}
              >
                {opp.question}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <span className="mono" style={{ fontSize: "11px", color: "var(--success)", fontWeight: 600 }}>
                  +{(opp.edge_pct * 100).toFixed(1)}%
                </span>
                <span style={{ fontSize: "11px", color: "var(--text-3)" }}>
                  {opp.venue} · ${opp.depth_usd.toFixed(0)} depth
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
