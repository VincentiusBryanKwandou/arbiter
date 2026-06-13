export interface BotStats {
  mode: "paper" | "live";
  uptime_hours: number;
  last_scan_at: string;
  opportunities_found_today: number;
  trades_today: number;
  realized_pnl_today: number;
  realized_pnl_total: number;
  win_rate: number;
  avg_edge_pct: number;
  kill_switch_active: boolean;
  daily_loss_pct: number;
  bankroll_usd: number;
  open_positions: number;
  max_open_positions: number;
}

export interface Trade {
  id: string;
  timestamp: string;
  market_id: string;
  description: string;
  strategy: string;
  venue: string;
  sets: number;
  notional_usd: number;
  locked_profit: number;
  fill_pct: number;
  note: string;
  mode: "paper" | "live";
  edge_pct?: number;
}

export interface MarketOpportunity {
  market_id: string;
  question: string;
  edge_pct: number;
  implied_prob_yes: number;
  implied_prob_no: number;
  depth_usd: number;
  strategy: string;
  venue: string;
  detected_at: string;
}

export interface BacktestResult {
  total_return_pct: number;
  sharpe_ratio: number;
  max_drawdown_pct: number;
  win_rate: number;
  n_trades: number;
  n_opportunities: number;
  avg_pnl_per_trade: number;
  best_trade: number;
  worst_trade: number;
  monte_carlo_ruin_prob: number;
  equity_curve: Array<{ t: number; equity: number }>;
  pnl_distribution: Array<{ bin: number; count: number }>;
  generated_at?: string;
}

export interface EquityPoint {
  date: string;
  equity: number;
  pnl: number;
}

export interface DashboardData {
  stats: BotStats;
  recent_trades: Trade[];
  opportunities: MarketOpportunity[];
  backtest: BacktestResult | null;
  equity_history: EquityPoint[];
  last_updated: string;
}
