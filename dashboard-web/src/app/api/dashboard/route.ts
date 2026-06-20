import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

const BOT_URL = process.env.BOT_API_URL;

const defaultStats = {
  mode: "paper" as const,
  uptime_hours: 0,
  last_scan_at: new Date().toISOString(),
  opportunities_found_today: 0,
  trades_today: 0,
  realized_pnl_today: 0,
  realized_pnl_total: 0,
  win_rate: 0,
  avg_edge_pct: 0,
  kill_switch_active: false,
  daily_loss_pct: 0,
  bankroll_usd: 1000,
  open_positions: 0,
  max_open_positions: 5,
};

function readJson<T>(filePath: string, fallback: T): T {
  try {
    if (existsSync(filePath)) return JSON.parse(readFileSync(filePath, "utf-8")) as T;
  } catch { /* ignore */ }
  return fallback;
}

export async function GET() {
  // ── Cloud mode: bot running on Railway ───────────────────────────────────
  if (BOT_URL) {
    try {
      const res = await fetch(`${BOT_URL}/dashboard`, {
        cache: "no-store",
        signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 10_000); return c.signal; })(),
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(
          { ...data, bot_connected: true, data_source: "live" },
          { headers: { "Cache-Control": "no-store" } }
        );
      }
    } catch { /* fall through to static */ }
  }

  // ── Fallback: read from static JSON snapshot in public/data ──────────────
  const PUBLIC = join(process.cwd(), "public", "data");
  const staticStats = readJson(join(PUBLIC, "stats.json"), defaultStats);

  // Override last_scan_at so it reflects when static data was last written,
  // not the current time (avoids the "just ran" confusion).
  const stats = { ...staticStats };

  const trades = readJson<unknown[]>(join(PUBLIC, "trades.json"), []);
  const equity = readJson<unknown[]>(join(PUBLIC, "equity.json"), []);
  const opps = readJson<unknown[]>(join(PUBLIC, "opportunities.json"), []);

  return NextResponse.json(
    {
      stats,
      recent_trades: Array.isArray(trades) ? trades.slice(-20).reverse() : [],
      opportunities: opps,
      equity_history: equity,
      backtest: null,
      last_updated: new Date().toISOString(),
      bot_connected: false,
      data_source: "static",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
