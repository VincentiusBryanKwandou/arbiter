import { Suspense } from "react";
import { fetchOpportunities } from "@/lib/api";

export const revalidate = 30;

async function MarketsContent() {
  const opps = await fetchOpportunities();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 600 }}>Market Opportunities</h2>
        <span style={{ fontSize: "13px", color: "#6b7280" }}>
          {opps.length} opportunities detected
        </span>
      </div>

      {opps.length === 0 ? (
        <div
          style={{
            backgroundColor: "#1a2234",
            border: "1px solid #1f2d45",
            borderRadius: "12px",
            padding: "48px",
            textAlign: "center",
            color: "#6b7280",
            fontSize: "13px",
          }}
        >
          <p>No opportunities detected yet.</p>
          <p style={{ fontFamily: "monospace", color: "#3b82f6", fontSize: "12px", marginTop: "8px" }}>
            python -m paper.loop --once
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {opps.map((opp) => (
            <div
              key={opp.market_id}
              style={{
                backgroundColor: "#1a2234",
                border: "1px solid #1f2d45",
                borderRadius: "10px",
                padding: "14px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ flex: 1, minWidth: 0, marginRight: "16px" }}>
                <div style={{ fontSize: "13px", fontWeight: 500, marginBottom: "4px" }}>
                  {opp.question}
                </div>
                <div style={{ fontSize: "11px", color: "#6b7280" }}>
                  {opp.strategy} · {opp.venue} · detected {new Date(opp.detected_at).toLocaleTimeString()}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div
                  style={{
                    fontSize: "16px",
                    fontFamily: "monospace",
                    fontWeight: 600,
                    color: opp.edge_pct > 0.08 ? "#10b981" : "#3b82f6",
                  }}
                >
                  +{(opp.edge_pct * 100).toFixed(1)}%
                </div>
                <div style={{ fontSize: "11px", color: "#6b7280" }}>
                  ${opp.depth_usd.toFixed(0)} depth
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MarketsPage() {
  return (
    <Suspense fallback={<p style={{ color: "#6b7280", fontSize: "13px" }}>Loading markets…</p>}>
      <MarketsContent />
    </Suspense>
  );
}
