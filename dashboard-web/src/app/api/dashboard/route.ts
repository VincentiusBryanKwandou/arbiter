import { NextResponse } from "next/server";
import { scanPolymarket } from "@/lib/scanner";

export const dynamic = "force-dynamic";
export const maxDuration = 25;

const REPO_RAW = "https://raw.githubusercontent.com/nayrbryanGaming/arbiter/main/dashboard-web/public/data";
const NO_STORE = { headers: { "Cache-Control": "no-store" } };

const DEFAULT_STATS = {
  mode:                        "paper" as const,
  uptime_hours:                0,
  last_scan_at:                new Date().toISOString(),
  opportunities_found_today:   0,
  trades_today:                0,
  realized_pnl_today:          0,
  realized_pnl_total:          0,
  win_rate:                    0,
  avg_edge_pct:                0,
  kill_switch_active:          false,
  daily_loss_pct:              0,
  bankroll_usd:                1000,
  open_positions:              0,
  max_open_positions:          5,
};

async function fetchJson<T>(url: string, fallback: T, timeoutMs = 5000): Promise<T> {
  try {
    const c = new AbortController();
    const id = setTimeout(() => c.abort(), timeoutMs);
    const res = await fetch(`${url}?_=${Date.now()}`, { cache: "no-store", signal: c.signal });
    clearTimeout(id);
    if (res.ok) return res.json() as Promise<T>;
  } catch { /* ignore */ }
  return fallback;
}

type Row = Record<string, unknown>;

// ── Read from Neon Postgres ───────────────────────────────────────────────────
async function readFromNeon() {
  const { getDb } = await import("@/lib/db");
  const sql = getDb();

  const [statsRows, tradesRows, equityRows, oppsRows] = await Promise.all([
    sql`SELECT * FROM bot_stats WHERE id = 1` as Promise<Row[]>,
    sql`SELECT * FROM trades ORDER BY timestamp DESC LIMIT 50` as Promise<Row[]>,
    sql`SELECT date, equity, pnl FROM equity_history ORDER BY date DESC LIMIT 90` as Promise<Row[]>,
    sql`SELECT * FROM opportunities WHERE is_active = true ORDER BY detected_at DESC LIMIT 20` as Promise<Row[]>,
  ]);

  const s: Row = statsRows[0] ?? {};

  const stats = {
    mode:                        (s.mode as string) ?? "paper",
    uptime_hours:                Number(s.uptime_hours ?? 0),
    last_scan_at:                (s.last_scan_at as Date)?.toISOString() ?? new Date().toISOString(),
    opportunities_found_today:   Number(s.opportunities_found_today ?? 0),
    trades_today:                Number(s.trades_today ?? 0),
    realized_pnl_today:          Number(s.realized_pnl_today ?? 0),
    realized_pnl_total:          Number(s.realized_pnl_total ?? 0),
    win_rate:                    Number(s.win_rate ?? 0),
    avg_edge_pct:                Number(s.avg_edge_pct ?? 0),
    kill_switch_active:          Boolean(s.kill_switch_active ?? false),
    daily_loss_pct:              Number(s.daily_loss_pct ?? 0),
    bankroll_usd:                Number(s.bankroll_usd ?? 1000),
    open_positions:              Number(s.open_positions ?? 0),
    max_open_positions:          Number(s.max_open_positions ?? 5),
  };

  const trades = tradesRows.map((t) => ({
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
  }));

  const equity = equityRows.map((e) => ({
    date:   (e.date as Date)?.toISOString?.()?.slice(0, 10) ?? String(e.date ?? ""),
    equity: Number(e.equity ?? 0),
    pnl:    Number(e.pnl ?? 0),
  })).reverse();

  const opps = oppsRows.map((o) => ({
    market_id:       String(o.market_id ?? ""),
    question:        String(o.question ?? ""),
    edge_pct:        Number(o.edge_pct ?? 0),
    implied_prob_yes: Number(o.implied_prob_yes ?? 0),
    implied_prob_no:  Number(o.implied_prob_no ?? 0),
    depth_usd:       Number(o.depth_usd ?? 0),
    strategy:        String(o.strategy ?? ""),
    venue:           String(o.venue ?? ""),
    detected_at:     (o.detected_at as Date)?.toISOString() ?? "",
  }));

  return { stats, trades, equity, opps, source: "neon" as const };
}

// ── Read from GitHub raw (fallback) ──────────────────────────────────────────
async function readFromGitHub() {
  const [ghStats, ghTrades, ghEquity, ghOpps] = await Promise.all([
    fetchJson(`${REPO_RAW}/stats.json`,         DEFAULT_STATS),
    fetchJson<unknown[]>(`${REPO_RAW}/trades.json`,        []),
    fetchJson<unknown[]>(`${REPO_RAW}/equity.json`,        []),
    fetchJson<unknown[]>(`${REPO_RAW}/opportunities.json`, []),
  ]);

  const normalizedEquity = Array.isArray(ghEquity)
    ? (ghEquity as Array<Record<string, unknown>>).map((pt) => ({
        date:   String(pt.ts ?? pt.date ?? "").slice(0, 10),
        equity: Number(pt.bankroll ?? pt.equity ?? 0),
        pnl:    Number(pt.pnl_cumulative ?? pt.pnl ?? 0),
      }))
    : [];

  return {
    stats:   ghStats,
    trades:  Array.isArray(ghTrades) ? ghTrades.slice(-50).reverse() : [],
    equity:  normalizedEquity,
    opps:    Array.isArray(ghOpps) ? ghOpps : [],
    source:  "github" as const,
  };
}

export async function GET() {
  // ── Choose data source ────────────────────────────────────────────────────
  let dbData: Awaited<ReturnType<typeof readFromNeon | typeof readFromGitHub>>;
  const hasDb = !!process.env.DATABASE_URL;

  if (hasDb) {
    try {
      dbData = await readFromNeon();
    } catch (err) {
      console.error("[dashboard] Neon read failed, falling back to GitHub:", err);
      dbData = await readFromGitHub();
    }
  } else {
    dbData = await readFromGitHub();
  }

  // ── Live scanner always runs for fresh opportunities ───────────────────────
  type ScanOpp = { edge_pct: number; [k: string]: unknown };
  let liveOpps: ScanOpp[] = [];
  let liveTs   = new Date().toISOString();
  let scanMeta = { scanned: 0, found: 0 };

  try {
    const { opportunities, scanned, ts } = await scanPolymarket(200, 0.01);
    liveOpps  = opportunities as unknown as ScanOpp[];
    liveTs    = ts;
    scanMeta  = { scanned, found: opportunities.length };
  } catch { /* keep dbData opps */ }

  const finalOpps   = liveOpps.length > 0 ? liveOpps : dbData.opps;
  const finalStats  = {
    ...dbData.stats,
    last_scan_at: liveTs,
    avg_edge_pct: liveOpps.length > 0
      ? +(liveOpps.reduce((s, o) => s + o.edge_pct, 0) / liveOpps.length).toFixed(4)
      : (dbData.stats as Record<string, unknown>).avg_edge_pct ?? 0,
  };

  return NextResponse.json(
    {
      stats:          finalStats,
      recent_trades:  dbData.trades.slice(0, 20),
      opportunities:  finalOpps,
      equity_history: dbData.equity,
      backtest:       null,
      last_updated:   liveTs,
      bot_connected:  true,
      data_source:    dbData.source === "neon" ? "vercel-live" : "vercel-live",
      db_source:      dbData.source,
      scanner_meta:   scanMeta,
    },
    NO_STORE
  );
}
