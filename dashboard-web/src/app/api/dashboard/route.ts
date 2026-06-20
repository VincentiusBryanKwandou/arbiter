import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { scanPolymarket } from "@/lib/scanner";

export const dynamic = "force-dynamic";

// If Railway bot is set, proxy to it. Otherwise run scanner inline on Vercel.
const BOT_URL = process.env.BOT_API_URL;

const DEFAULT_STATS = {
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

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

export async function GET() {
  // ── 1. Prefer Railway bot (if configured) ────────────────────────────────
  if (BOT_URL) {
    try {
      const res = await fetch(`${BOT_URL}/dashboard`, {
        cache: "no-store",
        signal: (() => {
          const c = new AbortController();
          setTimeout(() => c.abort(), 10_000);
          return c.signal;
        })(),
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(
          { ...data, bot_connected: true, data_source: "live" },
          NO_STORE
        );
      }
    } catch { /* fall through to Vercel-native scanner */ }
  }

  // ── 2. Vercel-native scanner: run Dutch-book scan inline ─────────────────
  try {
    const { opportunities, scanned, ts } = await scanPolymarket(200, 0.01);

    const avgEdge =
      opportunities.length > 0
        ? opportunities.reduce((s, o) => s + o.edge_pct, 0) / opportunities.length
        : 0;

    // Read persisted state from static files (updated by cron job if available)
    const PUBLIC = join(process.cwd(), "public", "data");
    const savedStats = readJson(join(PUBLIC, "stats.json"), DEFAULT_STATS);
    const trades = readJson<unknown[]>(join(PUBLIC, "trades.json"), []);
    const equity = readJson<unknown[]>(join(PUBLIC, "equity.json"), []);

    const stats = {
      ...savedStats,
      // Override stale fields with live-computed values
      last_scan_at: ts,
      opportunities_found_today: scanned,
      avg_edge_pct: +avgEdge.toFixed(4),
    };

    return NextResponse.json(
      {
        stats,
        recent_trades: Array.isArray(trades) ? trades.slice(-20).reverse() : [],
        opportunities,
        equity_history: equity,
        backtest: null,
        last_updated: ts,
        bot_connected: true,
        data_source: "vercel-live",
        scanner_meta: { scanned, found: opportunities.length },
      },
      NO_STORE
    );
  } catch (scanErr) {
    // ── 3. Final fallback: static snapshot ───────────────────────────────────
    const PUBLIC = join(process.cwd(), "public", "data");
    const stats = readJson(join(PUBLIC, "stats.json"), DEFAULT_STATS);
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
        scanner_error: String(scanErr),
      },
      NO_STORE
    );
  }
}
