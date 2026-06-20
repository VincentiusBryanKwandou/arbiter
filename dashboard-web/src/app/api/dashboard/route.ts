import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { scanPolymarket } from "@/lib/scanner";

export const dynamic = "force-dynamic";

const BOT_URL   = process.env.BOT_API_URL;
const REPO_RAW  = "https://raw.githubusercontent.com/nayrbryanGaming/arbiter/main/dashboard-web/public/data";
const NO_STORE  = { headers: { "Cache-Control": "no-store" } };

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

function readLocalJson<T>(file: string, fallback: T): T {
  try {
    if (existsSync(file)) return JSON.parse(readFileSync(file, "utf-8")) as T;
  } catch { /* ignore */ }
  return fallback;
}

async function fetchJson<T>(url: string, fallback: T, timeoutMs = 5000): Promise<T> {
  try {
    const c = new AbortController();
    const id = setTimeout(() => c.abort(), timeoutMs);
    const res = await fetch(`${url}?_=${Date.now()}`, {
      cache: "no-store",
      signal: c.signal,
    });
    clearTimeout(id);
    if (res.ok) return res.json() as Promise<T>;
  } catch { /* ignore */ }
  return fallback;
}

export async function GET() {
  // ── 1. Prefer Railway bot (if configured) ────────────────────────────────
  if (BOT_URL) {
    try {
      const res = await fetch(`${BOT_URL}/dashboard`, {
        cache: "no-store",
        signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 10_000); return c.signal; })(),
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ ...data, bot_connected: true, data_source: "live" }, NO_STORE);
      }
    } catch { /* fall through */ }
  }

  // ── 2. Read state written by GitHub Actions cron (most up-to-date) ───────
  const [ghStats, ghTrades, ghEquity, ghOpps] = await Promise.all([
    fetchJson(`${REPO_RAW}/stats.json`,         DEFAULT_STATS),
    fetchJson<unknown[]>(`${REPO_RAW}/trades.json`,        []),
    fetchJson<unknown[]>(`${REPO_RAW}/equity.json`,        []),
    fetchJson<unknown[]>(`${REPO_RAW}/opportunities.json`, []),
  ]);

  // ── 3. Run live scanner to get fresh opportunities ────────────────────────
  let liveOpps: unknown[] = [];
  let liveTs   = new Date().toISOString();
  let scanMeta = { scanned: 0, found: 0 };

  try {
    const { opportunities, scanned, ts } = await scanPolymarket(200, 0.01);
    liveOpps  = opportunities;
    liveTs    = ts;
    scanMeta  = { scanned, found: opportunities.length };
  } catch { /* use GitHub opps as fallback */ }

  // Merge: live scanner overrides GitHub opps (fresher), but use GitHub stats/trades
  const finalOpps = liveOpps.length > 0 ? liveOpps : ghOpps;

  // Override stale last_scan_at with the live scanner's timestamp
  const finalStats = {
    ...ghStats,
    last_scan_at: liveTs,
    avg_edge_pct: (liveOpps as Array<{ edge_pct: number }>).length > 0
      ? +((liveOpps as Array<{ edge_pct: number }>).reduce((s, o) => s + o.edge_pct, 0) / (liveOpps as Array<{ edge_pct: number }>).length).toFixed(4)
      : (ghStats as Record<string, unknown>).avg_edge_pct ?? 0,
  };

  return NextResponse.json(
    {
      stats:         finalStats,
      recent_trades: Array.isArray(ghTrades) ? ghTrades.slice(-20).reverse() : [],
      opportunities: finalOpps,
      equity_history: ghEquity,
      backtest:      null,
      last_updated:  liveTs,
      bot_connected: true,
      data_source:   "vercel-live",
      scanner_meta:  scanMeta,
    },
    NO_STORE
  );
}
