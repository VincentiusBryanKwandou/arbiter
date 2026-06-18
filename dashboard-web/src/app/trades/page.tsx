import { Suspense } from "react";
import { fetchTrades } from "@/lib/api";
import { RecentTrades } from "@/components/RecentTrades";

export const dynamic = "force-dynamic";

async function TradesContent() {
  const trades = await fetchTrades(100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text)", marginBottom: "3px" }}>
            Trade Log
          </h2>
          <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
            All paper trades recorded by the bot
          </p>
        </div>
        <span
          className="mono"
          style={{ fontSize: "12px", color: "var(--text-3)" }}
        >
          {trades.length} records
        </span>
      </div>
      <div className="card">
        <RecentTrades trades={trades} />
      </div>
    </div>
  );
}

export default function TradesPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "48px", textAlign: "center", color: "var(--text-3)", fontSize: "12px" }}>
          Loading trades…
        </div>
      }
    >
      <TradesContent />
    </Suspense>
  );
}
