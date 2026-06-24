import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, sanitizeString, sanitizeNumber, safeError, timingSafeEqual, hashIp, slog } from "@/lib/security";
import { writeAuditLog } from "@/lib/db";

export const dynamic = "force-dynamic";

const EXPECTED_REPO = "nayrbryanGaming/arbiter";

// Verify a GitHub commit SHA belongs to our repo and is recent (<30 min).
// Uses GitHub's public API as an identity provider — no secrets needed in the workflow file.
// Cache verification results in-process to stay within GitHub API rate limits.
const _ghCache = new Map<string, { ok: boolean; ts: number }>();

async function verifyGitHubIdentity(repo: string, sha: string): Promise<boolean> {
  if (repo !== EXPECTED_REPO) return false;
  if (!/^[0-9a-f]{40}$/.test(sha)) return false;

  const cached = _ghCache.get(sha);
  if (cached && Date.now() - cached.ts < 300_000) return cached.ok;

  try {
    const res = await fetch(`https://api.github.com/repos/${EXPECTED_REPO}/commits/${sha}`, {
      headers: { Accept: "application/vnd.github.v3+json", "User-Agent": "arbiter-scanner/1.0" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) { _ghCache.set(sha, { ok: false, ts: Date.now() }); return false; }
    const data = await res.json() as { commit?: { author?: { date?: string } } };
    const commitDate = new Date(data.commit?.author?.date ?? 0).getTime();
    // Accept commits from the last 30 minutes only
    const isRecent = Date.now() - commitDate < 30 * 60_000;
    _ghCache.set(sha, { ok: isRecent, ts: Date.now() });
    return isRecent;
  } catch {
    return false;
  }
}

// POST /api/scan-result — dual-auth:
//   Primary:  Authorization: Bearer SCAN_API_TOKEN
//   Fallback: x-github-repository + x-github-sha (GitHub Actions auto env vars, no workflow change needed)
export async function POST(req: NextRequest) {
  // ── Rate limiting: max 20 calls/min per IP ────────────────────────────────
  const rl = applyRateLimit(req, 20, 60_000, "scan-result");
  if (rl) return rl;

  // ── Authentication (dual-path) ────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const scanApiToken = process.env.SCAN_API_TOKEN ?? "";

  let authenticated = false;
  let authMethod = "none";

  const rid = req.headers.get("x-request-id") ?? `req_${Date.now().toString(36)}`;
  const ip  = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipH = hashIp(ip);

  if (scanApiToken && bearerToken && timingSafeEqual(bearerToken, scanApiToken)) {
    authenticated = true;
    authMethod = "bearer_token";
  } else {
    const ghRepo = req.headers.get("x-github-repository") ?? "";
    const ghSha  = req.headers.get("x-github-sha") ?? "";
    if (ghRepo && ghSha) {
      authenticated = await verifyGitHubIdentity(ghRepo, ghSha);
      if (authenticated) authMethod = "github_sha";
    }
  }

  if (!authenticated) {
    slog("warn", "/api/scan-result", "auth rejected", { request_id: rid, ip_hash: ipH });
    void writeAuditLog({ request_id: rid, endpoint: "/api/scan-result", method: "POST", ip_hash: ipH, status_code: 401, auth_method: "rejected" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { stats, new_trades = [], opportunities = [], equity_date } = body;

  // ── Input validation ──────────────────────────────────────────────────────
  if (stats) {
    const bankroll = Number(stats.bankroll_usd ?? 0);
    if (bankroll < 0 || bankroll > 10_000_000) {
      return NextResponse.json({ ok: false, error: "bankroll_usd out of range" }, { status: 422 });
    }
  }
  if (!Array.isArray(new_trades) || !Array.isArray(opportunities)) {
    return NextResponse.json({ ok: false, error: "new_trades and opportunities must be arrays" }, { status: 422 });
  }
  if (new_trades.length > 100 || opportunities.length > 50) {
    return NextResponse.json({ ok: false, error: "Batch size too large" }, { status: 422 });
  }

  try {
    const { getDb } = await import("@/lib/db");
    const sql = getDb();

    // Upsert bot_stats for nayrbryanGaming (user_id=1) — the scanner always writes to owner account
    if (stats) {
      await (sql`
        INSERT INTO bot_stats (
          user_id, mode, bankroll_usd, realized_pnl_today, realized_pnl_total,
          win_rate, avg_edge_pct, kill_switch_active, daily_loss_pct,
          open_positions, max_open_positions, trades_today, opportunities_found_today,
          last_scan_at, uptime_hours, started_at, updated_at, consecutive_api_failures
        ) VALUES (
          1,
          ${sanitizeString(stats.mode ?? "paper", 10)},
          ${sanitizeNumber(stats.bankroll_usd, 0, 10_000_000)},
          ${sanitizeNumber(stats.realized_pnl_today, -1_000_000, 1_000_000)},
          ${sanitizeNumber(stats.realized_pnl_total, -1_000_000, 1_000_000)},
          ${sanitizeNumber(stats.win_rate, 0, 1)},
          ${sanitizeNumber(stats.avg_edge_pct, 0, 1)},
          ${Boolean(stats.kill_switch_active ?? false)},
          ${sanitizeNumber(stats.daily_loss_pct, 0, 1)},
          ${sanitizeNumber(stats.open_positions, 0, 1000)},
          ${sanitizeNumber(stats.max_open_positions, 0, 1000)},
          ${sanitizeNumber(stats.trades_today, 0, 100000)},
          ${sanitizeNumber(stats.opportunities_found_today, 0, 100000)},
          ${sanitizeString(stats.last_scan_at ?? new Date().toISOString(), 50)},
          ${sanitizeNumber(stats.uptime_hours, 0, 1_000_000)},
          ${sanitizeString(stats.started_at ?? new Date().toISOString(), 50)},
          NOW(),
          ${sanitizeNumber(stats.consecutive_api_failures, 0, 10000)}
        )
        ON CONFLICT (user_id) DO UPDATE SET
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
    for (const t of new_trades.slice(0, 100)) {
      await (sql`
        INSERT INTO trades (id, timestamp, market_id, description, strategy, venue,
                            sets, notional_usd, locked_profit, fill_pct, note, mode, edge_pct)
        VALUES (
          ${sanitizeString(t.id, 80)},
          ${sanitizeString(t.timestamp, 50)},
          ${sanitizeString(t.market_id ?? "", 255)},
          ${sanitizeString(t.description ?? "", 500)},
          ${sanitizeString(t.strategy ?? "", 100)},
          ${sanitizeString(t.venue ?? "", 100)},
          ${sanitizeNumber(t.sets, 0, 1_000_000)},
          ${sanitizeNumber(t.notional_usd, 0, 10_000_000)},
          ${sanitizeNumber(t.locked_profit, -100_000, 100_000)},
          ${sanitizeNumber(t.fill_pct, 0, 1)},
          ${sanitizeString(t.note ?? "", 500)},
          ${sanitizeString(t.mode ?? "paper", 10)},
          ${sanitizeNumber(t.edge_pct, 0, 1)}
        )
        ON CONFLICT (id) DO NOTHING
      ` as Promise<unknown>);
    }

    // Upsert equity for today
    if (stats && equity_date && /^\d{4}-\d{2}-\d{2}$/.test(equity_date)) {
      await (sql`
        INSERT INTO equity_history (date, equity, pnl)
        VALUES (${equity_date}::date, ${sanitizeNumber(stats.bankroll_usd, 0, 10_000_000)}, ${sanitizeNumber(stats.realized_pnl_total, -1_000_000, 1_000_000)})
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
            ${sanitizeString(o.market_id ?? "", 255)},
            ${sanitizeString(o.question ?? "", 1000)},
            ${sanitizeNumber(o.edge_pct, 0, 1)},
            ${sanitizeNumber((o as Record<string,unknown>).implied_prob_yes, 0, 1)},
            ${sanitizeNumber((o as Record<string,unknown>).implied_prob_no, 0, 1)},
            ${sanitizeNumber(o.depth_usd, 0, 10_000_000)},
            ${sanitizeString(o.strategy ?? "", 100)},
            ${sanitizeString(o.venue ?? "", 100)},
            NOW(),
            true
          )
          ON CONFLICT (market_id, detected_at) DO NOTHING
        ` as Promise<unknown>);
      }
    }

    slog("info", "/api/scan-result", "scan data written", {
      request_id: rid, auth_method: authMethod, trades: new_trades.length, opportunities: opportunities.length,
    });
    void writeAuditLog({ request_id: rid, endpoint: "/api/scan-result", method: "POST", ip_hash: ipH, status_code: 200, auth_method: authMethod });

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
    void writeAuditLog({ request_id: rid, endpoint: "/api/scan-result", method: "POST", ip_hash: ipH, status_code: 500, auth_method: authMethod });
    return safeError("scan-result", err);
  }
}
