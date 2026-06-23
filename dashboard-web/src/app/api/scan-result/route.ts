import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST /api/scan-result
// Called by paper-scan.mjs after every GitHub Actions scan.
// Writes stats, trades, equity, and opportunities to Neon Postgres.
// Auth: simple shared secret via x-scan-token header (optional — public paper data).
export async function POST(req: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }

  let body: {
    stats?: Record<string, unknown>;
    new_trades?: Array<Record<string, unknown>>;
    opportunities?: Array<Record<string, unknown>>;
    equity_date?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const { stats, new_trades = [], opportunities = [], equity_date } = body;

  try {
    const { getDb } = await import("@/lib/db");
    const sql = getDb();

    // Upsert bot_stats
    if (stats) {
      await (sql`
        INSERT INTO bot_stats (
          id, mode, bankroll_usd, realized_pnl_today, realized_pnl_total,
          win_rate, avg_edge_pct, kill_switch_active, daily_loss_pct,
          open_positions, max_open_positions, trades_today, opportunities_found_today,
          last_scan_at, uptime_hours, started_at, updated_at, consecutive_api_failures
        ) VALUES (
          1,
          ${String(stats.mode ?? "paper")},
          ${Number(stats.bankroll_usd ?? 1000)},
          ${Number(stats.realized_pnl_today ?? 0)},
          ${Number(stats.realized_pnl_total ?? 0)},
          ${Number(stats.win_rate ?? 0)},
          ${Number(stats.avg_edge_pct ?? 0)},
          ${Boolean(stats.kill_switch_active ?? false)},
          ${Number(stats.daily_loss_pct ?? 0)},
          ${Number(stats.open_positions ?? 0)},
          ${Number(stats.max_open_positions ?? 5)},
          ${Number(stats.trades_today ?? 0)},
          ${Number(stats.opportunities_found_today ?? 0)},
          ${String(stats.last_scan_at ?? new Date().toISOString())},
          ${Number(stats.uptime_hours ?? 0)},
          ${String(stats.started_at ?? new Date().toISOString())},
          NOW(),
          ${Number(stats.consecutive_api_failures ?? 0)}
        )
        ON CONFLICT (id) DO UPDATE SET
          mode = EXCLUDED.mode,
          bankroll_usd = EXCLUDED.bankroll_usd,
          realized_pnl_today = EXCLUDED.realized_pnl_today,
          realized_pnl_total = EXCLUDED.realized_pnl_total,
          win_rate = EXCLUDED.win_rate,
          avg_edge_pct = EXCLUDED.avg_edge_pct,
          kill_switch_active = EXCLUDED.kill_switch_active,
          daily_loss_pct = EXCLUDED.daily_loss_pct,
          open_positions = EXCLUDED.open_positions,
          max_open_positions = EXCLUDED.max_open_positions,
          trades_today = EXCLUDED.trades_today,
          opportunities_found_today = EXCLUDED.opportunities_found_today,
          last_scan_at = EXCLUDED.last_scan_at,
          uptime_hours = EXCLUDED.uptime_hours,
          started_at = EXCLUDED.started_at,
          updated_at = NOW(),
          consecutive_api_failures = EXCLUDED.consecutive_api_failures
      ` as Promise<unknown>);
    }

    // Insert new trades
    for (const t of new_trades) {
      await (sql`
        INSERT INTO trades (id, timestamp, market_id, description, strategy, venue,
                            sets, notional_usd, locked_profit, fill_pct, note, mode, edge_pct)
        VALUES (
          ${String(t.id)},
          ${String(t.timestamp)},
          ${String(t.market_id ?? "")},
          ${String(t.description ?? "")},
          ${String(t.strategy ?? "")},
          ${String(t.venue ?? "")},
          ${Number(t.sets ?? 0)},
          ${Number(t.notional_usd ?? 0)},
          ${Number(t.locked_profit ?? 0)},
          ${Number(t.fill_pct ?? 1)},
          ${String(t.note ?? "")},
          ${String(t.mode ?? "paper")},
          ${Number(t.edge_pct ?? 0)}
        )
        ON CONFLICT (id) DO NOTHING
      ` as Promise<unknown>);
    }

    // Upsert equity for today
    if (stats && equity_date) {
      await (sql`
        INSERT INTO equity_history (date, equity, pnl)
        VALUES (${equity_date}::date, ${Number(stats.bankroll_usd ?? 1000)}, ${Number(stats.realized_pnl_total ?? 0)})
        ON CONFLICT (date) DO UPDATE SET
          equity = EXCLUDED.equity,
          pnl    = EXCLUDED.pnl
      ` as Promise<unknown>);
    }

    // Deactivate stale opps, insert fresh ones
    if (opportunities.length > 0) {
      await (sql`UPDATE opportunities SET is_active = false WHERE detected_at < NOW() - INTERVAL '1 hour'` as Promise<unknown>);
      for (const o of opportunities.slice(0, 20)) {
        await (sql`
          INSERT INTO opportunities (market_id, question, edge_pct, implied_prob_yes, implied_prob_no,
                                     depth_usd, strategy, venue, detected_at, is_active)
          VALUES (
            ${String(o.market_id ?? "")},
            ${String(o.question ?? "")},
            ${Number(o.edge_pct ?? 0)},
            ${Number((o as Record<string,unknown>).implied_prob_yes ?? 0)},
            ${Number((o as Record<string,unknown>).implied_prob_no ?? 0)},
            ${Number(o.depth_usd ?? 0)},
            ${String(o.strategy ?? "")},
            ${String(o.venue ?? "")},
            NOW(),
            true
          )
          ON CONFLICT (market_id, detected_at) DO NOTHING
        ` as Promise<unknown>);
      }
    }

    return NextResponse.json({
      ok: true,
      written: {
        stats: !!stats,
        trades: new_trades.length,
        opportunities: opportunities.length,
        equity: !!equity_date,
      },
    });
  } catch (err) {
    console.error("[scan-result] DB error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
