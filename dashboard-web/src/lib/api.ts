import type {
  DashboardData,
  Trade,
  BacktestResult,
  MarketOpportunity,
  Position,
  ScanOpportunity,
} from "@/types";

function getBase(): string {
  // Client-side: relative URLs work fine
  if (typeof window !== "undefined") return "";
  // Server-side on Vercel: use the deployment URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  // Server-side locally: need absolute URL
  return "http://localhost:3000";
}
const BASE = getBase();

export async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch(`${BASE}/api/dashboard`, {
    cache: "no-store",
  });
  if (!res.ok) {
    return {
      stats: defaultStats(),
      recent_trades: [],
      opportunities: [],
      equity_history: [],
      backtest: null,
      last_updated: new Date().toISOString(),
      bot_connected: false,
      data_source: "static" as const,
    };
  }
  return res.json();
}

export async function fetchTrades(limit = 50): Promise<Trade[]> {
  const res = await fetch(`${BASE}/api/trades?limit=${limit}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchBacktest(): Promise<BacktestResult | null> {
  const res = await fetch(`${BASE}/api/backtest`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchOpportunities(): Promise<MarketOpportunity[]> {
  const res = await fetch(`${BASE}/api/opportunities`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

// ── Bot control API (proxied through /api/bot → FastAPI on port 8001) ────────

const BOT = "/api/bot";

export async function getBotStatus(): Promise<{
  bankroll_usd: number;
  open_positions: number;
  total_trades: number;
  total_pnl: number;
  error?: string;
}> {
  try {
    const res = await fetch(`${BOT}/status`, { cache: "no-store" });
    return res.json();
  } catch {
    return { bankroll_usd: 0, open_positions: 0, total_trades: 0, total_pnl: 0, error: "offline" };
  }
}

export async function setBankroll(
  bankroll_usd: number,
  note = ""
): Promise<{ ok: boolean; old: number; new: number; error?: string }> {
  const res = await fetch(`${BOT}/funds`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bankroll_usd, note }),
  });
  return res.json();
}

export async function scanMarkets(
  limit = 50,
  min_edge = 0.03
): Promise<{ opportunities: ScanOpportunity[]; count: number; error?: string }> {
  const res = await fetch(`${BOT}/markets/scan?limit=${limit}&min_edge=${min_edge}`, {
    cache: "no-store",
    signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 60_000); return c.signal; })(),
  });
  return res.json();
}

export async function openPosition(req: {
  market_id: string;
  question: string;
  sets: number;
  edge_pct: number;
  cost_per_set: number;
  strategy: string;
  venue: string;
  note?: string;
}): Promise<{ ok: boolean; position: Position; error?: string }> {
  const res = await fetch(`${BOT}/positions/open`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return res.json();
}

export async function listPositions(): Promise<{ positions: Position[] }> {
  try {
    const res = await fetch(`${BOT}/positions`, { cache: "no-store" });
    return res.json();
  } catch {
    return { positions: [] };
  }
}

export async function closePosition(id: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${BOT}/positions/${id}`, { method: "DELETE" });
  return res.json();
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function defaultStats() {
  return {
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
}
