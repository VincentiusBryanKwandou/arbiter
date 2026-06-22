import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const REPO_RAW = "https://raw.githubusercontent.com/nayrbryanGaming/arbiter/main/dashboard-web/public/data";

export async function GET(req: NextRequest) {
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "100"), 500);

  // ── Neon Postgres ─────────────────────────────────────────────────────────
  if (process.env.DATABASE_URL) {
    try {
      const { getDb } = await import("@/lib/db");
      const sql = getDb();
      const rows = (await (sql`
        SELECT id, timestamp, market_id, description, strategy, venue,
               sets, notional_usd, locked_profit, fill_pct, note, mode, edge_pct
        FROM trades
        ORDER BY timestamp DESC
        LIMIT ${limit}
      ` as Promise<Record<string, unknown>[]>));
      return NextResponse.json(
        rows.map((t) => ({
          id:            String(t.id),
          timestamp:     (t.timestamp as Date)?.toISOString() ?? "",
          market_id:     String(t.market_id ?? ""),
          description:   String(t.description ?? ""),
          strategy:      String(t.strategy ?? ""),
          venue:         String(t.venue ?? ""),
          sets:          Number(t.sets ?? 0),
          notional_usd:  Number(t.notional_usd ?? 0),
          locked_profit: Number(t.locked_profit ?? 0),
          fill_pct:      Number(t.fill_pct ?? 1),
          note:          String(t.note ?? ""),
          mode:          String(t.mode ?? "paper"),
          edge_pct:      Number(t.edge_pct ?? 0),
        })),
        { headers: { "Cache-Control": "no-store" } }
      );
    } catch (err) {
      console.error("[trades] Neon read failed:", err);
    }
  }

  // ── Fallback: GitHub raw ──────────────────────────────────────────────────
  try {
    const c = new AbortController();
    setTimeout(() => c.abort(), 5000);
    const res = await fetch(`${REPO_RAW}/trades.json?_=${Date.now()}`, {
      cache: "no-store",
      signal: c.signal,
    });
    if (res.ok) {
      const all = (await res.json()) as unknown[];
      return NextResponse.json(Array.isArray(all) ? all.slice(-limit).reverse() : []);
    }
  } catch { /* ignore */ }

  return NextResponse.json([]);
}
