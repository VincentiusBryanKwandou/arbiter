/**
 * GET /api/flash-arb
 * Returns current flash loan arbitrage scan state.
 * Data sourced from Neon DB (bot_flash_arb table) or storage JSON fallback.
 *
 * POST /api/flash-arb
 * Bot writes scan results here after each cycle.
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

// ── Schema init (called lazily) ───────────────────────────────────────────────
async function ensureTable() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS flash_arb_scans (
      id               SERIAL PRIMARY KEY,
      scanned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      pairs_scanned    INT         NOT NULL DEFAULT 0,
      opps_found       INT         NOT NULL DEFAULT 0,
      best_edge_pct    NUMERIC(10,4) NOT NULL DEFAULT 0,
      total_profit_usd NUMERIC(12,4) NOT NULL DEFAULT 0,
      executions       INT         NOT NULL DEFAULT 0,
      dry_run          BOOLEAN     NOT NULL DEFAULT TRUE,
      tx_hashes        TEXT[]      NOT NULL DEFAULT '{}',
      opportunities    JSONB       NOT NULL DEFAULT '[]',
      errors           INT         NOT NULL DEFAULT 0
    )
  `;
}

// ── GET — read latest scan results ───────────────────────────────────────────
export async function GET(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  const token  = secret
    ? await getToken({ req, secret }).catch(() => null)
    : null;

  // Public read — show aggregate stats without requiring auth
  // (individual tx_hashes are sensitive, so omit for unauthenticated requests)
  const isAuth = !!token;

  try {
    const sql = getDb();
    await ensureTable();

    const rows = await sql`
      SELECT
        scanned_at, pairs_scanned, opps_found,
        best_edge_pct, total_profit_usd, executions, dry_run, errors,
        opportunities,
        ${isAuth ? sql`tx_hashes` : sql`'{}'::text[] AS tx_hashes`}
      FROM flash_arb_scans
      ORDER BY scanned_at DESC
      LIMIT 1
    ` as Array<Record<string, unknown>>;

    const latest = rows[0] ?? null;

    const stats = await sql`
      SELECT
        COUNT(*)::int                                  AS total_scans,
        SUM(executions)::int                           AS total_executions,
        SUM(total_profit_usd)::numeric                 AS lifetime_profit_usd,
        MAX(best_edge_pct)::numeric                    AS max_edge_pct,
        SUM(opps_found)::int                           AS total_opps_found
      FROM flash_arb_scans
      WHERE scanned_at > NOW() - INTERVAL '24 hours'
    ` as Array<Record<string, unknown>>;

    return NextResponse.json(
      {
        latest,
        stats_24h: stats[0] ?? {},
        mode:       "flash_loan",
        chain:      "base",
        protocol:   "aave_v3",
        dexes:      ["uniswap_v3", "aerodrome"],
      },
      NO_STORE
    );
  } catch (err) {
    console.error("[flash-arb GET]", err);
    return NextResponse.json(
      { latest: null, stats_24h: {}, error: "DB unavailable" },
      { ...NO_STORE, status: 200 }
    );
  }
}

// ── POST — bot writes scan results ───────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Require internal bot token (shared secret, not user session)
  const botSecret = process.env.BOT_INTERNAL_SECRET;
  const auth      = req.headers.get("x-bot-secret");
  if (!botSecret || auth !== botSecret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const pairs_scanned    = Number(body.pairs_scanned    ?? 0);
  const opportunities    = Array.isArray(body.opportunities) ? body.opportunities : [];
  const executions_arr   = Array.isArray(body.executions)    ? body.executions    : [];
  const best_edge_pct    = Number(body.best_edge_pct    ?? 0);
  const total_profit_usd = Number(body.total_profit_usd ?? 0);
  const errors           = Number(body.errors           ?? 0);
  const dry_run          = executions_arr.some((e: Record<string,unknown>) => e.dry_run === true);
  const tx_hashes        = executions_arr.map((e: Record<string,unknown>) => String(e.tx_hash ?? "")).filter(Boolean);

  try {
    const sql = getDb();
    await ensureTable();

    await sql`
      INSERT INTO flash_arb_scans
        (pairs_scanned, opps_found, best_edge_pct, total_profit_usd,
         executions, dry_run, tx_hashes, opportunities, errors)
      VALUES
        (${pairs_scanned},
         ${opportunities.length},
         ${best_edge_pct},
         ${total_profit_usd},
         ${executions_arr.length},
         ${dry_run},
         ${tx_hashes},
         ${JSON.stringify(opportunities)},
         ${errors})
    `;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[flash-arb POST]", err);
    return NextResponse.json({ ok: false, error: "DB error" }, { status: 500 });
  }
}
