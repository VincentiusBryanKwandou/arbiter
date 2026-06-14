import { Suspense } from "react";
import { fetchTrades } from "@/lib/api";
import { RecentTrades } from "@/components/RecentTrades";

export const dynamic = "force-dynamic";

async function TradesContent() {
  const trades = await fetchTrades(100);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 600 }}>Trade Log</h2>
        <span style={{ fontSize: "13px", color: "#6b7280" }}>{trades.length} trades</span>
      </div>
      <div
        style={{
          backgroundColor: "#1a2234",
          border: "1px solid #1f2d45",
          borderRadius: "12px",
          padding: "16px",
        }}
      >
        <RecentTrades trades={trades} />
      </div>
    </div>
  );
}

export default function TradesPage() {
  return (
    <Suspense fallback={<p style={{ color: "#6b7280", fontSize: "13px" }}>Loading trades…</p>}>
      <TradesContent />
    </Suspense>
  );
}
