import type { MarketOpportunity } from "@/types";

export function OpportunitiesFeed({ opportunities }: { opportunities: MarketOpportunity[] }) {
  if (!opportunities.length) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "32px 0",
          color: "#6b7280",
          fontSize: "13px",
        }}
      >
        No active opportunities. Scanner is running...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "180px", overflowY: "auto" }}>
      {opportunities.map((opp) => (
        <div
          key={opp.market_id}
          style={{
            display: "flex",
            gap: "12px",
            padding: "10px",
            borderRadius: "8px",
            backgroundColor: "#111827",
            border: "1px solid #1f2d45",
          }}
        >
          <div
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "6px",
              backgroundColor: opp.edge_pct > 0.08 ? "rgba(16,185,129,0.2)" : "rgba(59,130,246,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontSize: "12px",
            }}
          >
            ↗
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: "12px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {opp.question}
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "3px" }}>
              <span style={{ fontSize: "10px", fontFamily: "monospace", color: "#10b981", fontWeight: 500 }}>
                +{(opp.edge_pct * 100).toFixed(1)}% edge
              </span>
              <span style={{ fontSize: "10px", color: "#6b7280" }}>
                {opp.venue} · ${opp.depth_usd.toFixed(0)} depth
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
