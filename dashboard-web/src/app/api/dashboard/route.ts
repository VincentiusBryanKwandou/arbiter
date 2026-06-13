import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

function readJson<T>(filePath: string, fallback: T): T {
  try {
    if (existsSync(filePath)) {
      return JSON.parse(readFileSync(filePath, "utf-8")) as T;
    }
  } catch {
    // ignore read errors
  }
  return fallback;
}

const defaultStats = {
  mode: "paper",
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

export async function GET() {
  const PUBLIC = join(process.cwd(), "public", "data");

  const stats = readJson(join(PUBLIC, "stats.json"), defaultStats);
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
    },
    {
      headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" },
    }
  );
}
