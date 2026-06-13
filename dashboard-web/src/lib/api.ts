import type {
  DashboardData,
  Trade,
  BacktestResult,
  MarketOpportunity,
} from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch(`${BASE}/api/dashboard`, {
    next: { revalidate: 30 },
  });
  if (!res.ok) {
    return {
      stats: defaultStats(),
      recent_trades: [],
      opportunities: [],
      equity_history: [],
      backtest: null,
      last_updated: new Date().toISOString(),
    };
  }
  return res.json();
}

export async function fetchTrades(limit = 50): Promise<Trade[]> {
  const res = await fetch(`${BASE}/api/trades?limit=${limit}`, {
    next: { revalidate: 60 },
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
    next: { revalidate: 15 },
  });
  if (!res.ok) return [];
  return res.json();
}

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
