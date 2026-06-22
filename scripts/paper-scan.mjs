#!/usr/bin/env node
// Paper trading scanner — runs in GitHub Actions every 5 min.
// Writes state to Neon Postgres (when DATABASE_URL is set) + JSON files.
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ── Neon Postgres client (optional — requires @neondatabase/serverless) ──────
let neonSql = null;
if (process.env.DATABASE_URL) {
  try {
    const { neon } = await import("@neondatabase/serverless");
    neonSql = neon(process.env.DATABASE_URL);
    console.log("Neon Postgres: connected.");
  } catch (err) {
    console.warn("Neon driver not available:", err.message, "— writing JSON only.");
  }
}

async function dbRun(query, ...params) {
  if (!neonSql) return;
  try {
    await neonSql(query, params);
  } catch (err) {
    console.warn("DB write error:", err.message);
  }
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "dashboard-web", "public", "data");

// ── Config ────────────────────────────────────────────────────────────────────
const BANKROLL_INITIAL  = 1000;
const KELLY_FRACTION    = 0.25;       // ¼ Kelly
const MAX_POSITIONS     = 5;
const MIN_EDGE_PCT      = 0.03;       // 3% min edge after fees
const KILL_LOSS_PCT     = 0.10;       // 10% daily loss → kill switch
const MIN_LIQUIDITY_USD = 500;        // liquidity gate: skip thin markets
const RESOLUTION_BUFFER_H = 2;       // skip markets resolving in < 2 hours
const GAMMA             = "https://gamma-api.polymarket.com";

// ── Telegram alert (optional — set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID) ───
async function sendTelegram(msg) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "HTML" }),
    });
  } catch { /* non-blocking */ }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function readJson(file, fallback) {
  try {
    if (existsSync(file)) return JSON.parse(readFileSync(file, "utf-8"));
  } catch {}
  return fallback;
}

function writeJson(file, data) {
  writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

function parseList(v) {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string" && v.trim()) {
    try { const p = JSON.parse(v); return Array.isArray(p) ? p.map(String) : []; }
    catch { return []; }
  }
  return [];
}

function toNum(v) {
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

function todayPrefix() {
  return new Date().toISOString().slice(0, 10);
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Load state ────────────────────────────────────────────────────────────────
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
  bankroll_usd: BANKROLL_INITIAL,
  open_positions: 0,
  max_open_positions: MAX_POSITIONS,
  scan_count: 0,
  started_at: new Date().toISOString(),
};

const stats      = readJson(join(DATA, "stats.json"), defaultStats);
const allTrades  = readJson(join(DATA, "trades.json"), []);
const equity     = readJson(join(DATA, "equity.json"), []);

// Preserve started_at across restarts (first-run anchor for uptime)
if (!stats.started_at) stats.started_at = new Date().toISOString();

// Reset daily counters if date changed
const today = todayPrefix();
const statsDate = stats.last_scan_at?.slice(0, 10);
if (statsDate !== today) {
  stats.trades_today        = 0;
  stats.realized_pnl_today  = 0;
  stats.daily_loss_pct      = 0;
  stats.kill_switch_active  = false;
  stats.opportunities_found_today = 0;
  console.log("New trading day — counters reset.");
}

// ── Kill switch guard ─────────────────────────────────────────────────────────
if (stats.kill_switch_active) {
  console.log("Kill switch active — skipping scan.");
  stats.last_scan_at = new Date().toISOString();
  writeJson(join(DATA, "stats.json"), stats);
  if (neonSql) await dbRun(`UPDATE bot_stats SET last_scan_at = NOW(), kill_switch_active = true WHERE id = 1`);
  process.exit(0);
}

// ── Circuit breaker: skip if data feed failed last 3 consecutive scans ───────
if ((stats.consecutive_api_failures ?? 0) >= 3) {
  console.warn("Circuit breaker: 3+ consecutive API failures — halting scan.");
  await sendTelegram("⚡ <b>Arbiter circuit breaker</b>\n3+ consecutive API failures. Scanner halted pending recovery.");
  stats.last_scan_at = new Date().toISOString();
  writeJson(join(DATA, "stats.json"), stats);
  if (neonSql) await dbRun(`UPDATE bot_stats SET last_scan_at = NOW(), consecutive_api_failures = $1 WHERE id = 1`, stats.consecutive_api_failures);
  process.exit(0);
}

// ── Fetch Polymarket markets ──────────────────────────────────────────────────
console.log("Fetching Polymarket markets…");
let rows = [];
try {
  const res = await fetch(
    `${GAMMA}/markets?active=true&closed=false&limit=200&order=volume&ascending=false`,
    { headers: { "User-Agent": "arbiter-paper-scanner/1.0" } }
  );
  if (!res.ok) throw new Error(`Gamma API ${res.status}`);
  const data = await res.json();
  rows = Array.isArray(data) ? data : data.data ?? [];
  stats.consecutive_api_failures = 0; // reset on success
} catch (err) {
  console.error("Gamma API error:", err.message);
  stats.consecutive_api_failures = (stats.consecutive_api_failures ?? 0) + 1;
  stats.last_scan_at = new Date().toISOString();
  writeJson(join(DATA, "stats.json"), stats);
  if (neonSql) await dbRun(`UPDATE bot_stats SET last_scan_at = NOW(), consecutive_api_failures = $1 WHERE id = 1`, stats.consecutive_api_failures);
  process.exit(0);
}
console.log(`Fetched ${rows.length} markets.`);

// ── Detect Dutch-book opportunities ──────────────────────────────────────────
const opportunities = [];

const now = Date.now();

for (const r of rows) {
  const question = String(r.question ?? "").trim();
  if (!question) continue;

  const outcomes = parseList(r.outcomes ?? []);
  const prices   = parseList(r.outcomePrices ?? []).map(toNum);

  if (outcomes.length < 2 || prices.length < 2) continue;

  // Liquidity gate — skip thin markets
  const liquidity = toNum(r.liquidity ?? r.volume ?? 0);
  if (liquidity < MIN_LIQUIDITY_USD) continue;

  // Resolution buffer — skip markets resolving within 2 hours
  const endDateRaw = r.end_date_iso ?? r.endDateIso ?? r.end_date ?? null;
  if (endDateRaw) {
    const endMs = new Date(endDateRaw).getTime();
    if (!isNaN(endMs) && endMs - now < RESOLUTION_BUFFER_H * 3_600_000) continue;
  }

  const sumPrices = prices.reduce((a, b) => a + b, 0);
  const edge      = +(Math.max(0, 1.0 - sumPrices - 0.02)).toFixed(4);

  if (edge < MIN_EDGE_PCT) continue;

  opportunities.push({
    market_id: String(r.id ?? ""),
    question,
    venue: "polymarket",
    outcomes,
    prices,
    edge_pct: edge,
    depth_usd: toNum(r.liquidity),
    strategy: outcomes.length === 2 ? "dutch_book" : "mutually_exclusive",
    sum_prices: +sumPrices.toFixed(4),
  });
}

opportunities.sort((a, b) => b.edge_pct - a.edge_pct);
console.log(`Found ${opportunities.length} opportunities with edge >= ${MIN_EDGE_PCT * 100}%.`);

// ── Paper trade execution (top opportunity per scan) ─────────────────────────
const newTrades = [];

if (
  opportunities.length > 0 &&
  stats.open_positions < MAX_POSITIONS &&
  !stats.kill_switch_active
) {
  const opp    = opportunities[0];
  const kelly  = opp.edge_pct * KELLY_FRACTION;
  const notional = +(stats.bankroll_usd * kelly).toFixed(2);

  if (notional >= 1.0) {
    // Cost to buy all legs of the Dutch book
    const costPerSet  = opp.sum_prices;
    const sets        = +(notional / costPerSet).toFixed(4);
    const grossProfit = +(sets * (1 - opp.sum_prices)).toFixed(4);
    // Estimate fill at 80% of theoretical edge (slippage + partial fill)
    const fillPct     = 0.80;
    const lockedProfit = +(grossProfit * fillPct).toFixed(4);

    const trade = {
      id:            uid(),
      timestamp:     new Date().toISOString(),
      market_id:     opp.market_id,
      description:   opp.question,
      strategy:      opp.strategy,
      venue:         opp.venue,
      sets,
      notional_usd:  notional,
      locked_profit: lockedProfit,
      fill_pct:      fillPct,
      edge_pct:      opp.edge_pct,
      note:          "paper",
      mode:          "paper",
    };

    newTrades.push(trade);
    allTrades.push(trade);

    stats.bankroll_usd        = +(stats.bankroll_usd + lockedProfit - notional * (1 - fillPct)).toFixed(4);
    stats.trades_today        += 1;
    stats.realized_pnl_today  = +(stats.realized_pnl_today + lockedProfit).toFixed(4);
    stats.realized_pnl_total  = +(stats.realized_pnl_total + lockedProfit).toFixed(4);

    console.log(`Paper trade: ${opp.question.slice(0, 60)} | edge ${(opp.edge_pct * 100).toFixed(1)}% | profit $${lockedProfit}`);
    await sendTelegram(
      `📊 <b>Arbiter paper trade</b>\n` +
      `${opp.question.slice(0, 80)}\n` +
      `Edge: +${(opp.edge_pct * 100).toFixed(1)}% | Notional: $${notional} | Profit: +$${lockedProfit}\n` +
      `Bankroll: $${stats.bankroll_usd}`
    );
  }
}

// ── Kill switch check ─────────────────────────────────────────────────────────
const lossToday    = stats.realized_pnl_today < 0 ? Math.abs(stats.realized_pnl_today) : 0;
stats.daily_loss_pct = +(lossToday / BANKROLL_INITIAL).toFixed(4);
if (stats.daily_loss_pct >= KILL_LOSS_PCT && !stats.kill_switch_active) {
  stats.kill_switch_active = true;
  console.warn("Kill switch triggered! Daily loss exceeded 10%.");
  await sendTelegram(
    `🔴 <b>Arbiter KILL SWITCH triggered</b>\n` +
    `Daily loss: ${(stats.daily_loss_pct * 100).toFixed(1)}% ≥ 10% limit\n` +
    `Bankroll: $${stats.bankroll_usd}\n` +
    `Bot halted. Manual reset required.`
  );
}

// ── Update stats ──────────────────────────────────────────────────────────────
const totalTrades  = allTrades.length;
const winningTrades = allTrades.filter(t => t.locked_profit > 0).length;

stats.last_scan_at              = new Date().toISOString();
stats.opportunities_found_today += opportunities.length;
stats.win_rate                  = totalTrades > 0 ? +(winningTrades / totalTrades).toFixed(4) : 0;
stats.avg_edge_pct              = opportunities.length > 0
  ? +(opportunities.reduce((s, o) => s + o.edge_pct, 0) / opportunities.length).toFixed(4)
  : 0;
stats.scan_count                = (stats.scan_count ?? 0) + 1;
stats.open_positions            = 0; // all paper trades settle instantly

// Uptime: count from started_at
const startedAt = new Date(stats.started_at ?? stats.last_scan_at).getTime();
stats.uptime_hours = +((Date.now() - startedAt) / 3_600_000).toFixed(2);

// ── Update equity curve ───────────────────────────────────────────────────────
equity.push({
  ts:          stats.last_scan_at,
  bankroll:    stats.bankroll_usd,
  pnl_cumulative: stats.realized_pnl_total,
});
// Keep only last 500 data points (≈ 41 hours at 5-min intervals)
if (equity.length > 500) equity.splice(0, equity.length - 500);

// ── Write files (always — GitHub raw fallback) ────────────────────────────────
writeJson(join(DATA, "stats.json"),         stats);
writeJson(join(DATA, "trades.json"),        allTrades.slice(-200));
writeJson(join(DATA, "equity.json"),        equity);
writeJson(join(DATA, "opportunities.json"), opportunities.slice(0, 20));

// ── Write to Neon Postgres (when DATABASE_URL is set) ────────────────────────
if (neonSql) {
  // Upsert bot_stats row 1
  await dbRun(`
    INSERT INTO bot_stats (
      id, mode, bankroll_usd, realized_pnl_today, realized_pnl_total,
      win_rate, avg_edge_pct, kill_switch_active, daily_loss_pct,
      open_positions, max_open_positions, trades_today, opportunities_found_today,
      last_scan_at, uptime_hours, started_at, updated_at, consecutive_api_failures
    ) VALUES (
      1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), $16
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
  `,
    stats.mode,
    stats.bankroll_usd,
    stats.realized_pnl_today,
    stats.realized_pnl_total,
    stats.win_rate,
    stats.avg_edge_pct,
    stats.kill_switch_active,
    stats.daily_loss_pct,
    stats.open_positions,
    stats.max_open_positions,
    stats.trades_today,
    stats.opportunities_found_today,
    stats.last_scan_at,
    stats.uptime_hours,
    stats.started_at,
    stats.consecutive_api_failures ?? 0,
  );

  // Insert new trades (ignore duplicates)
  for (const t of newTrades) {
    await dbRun(`
      INSERT INTO trades (id, timestamp, market_id, description, strategy, venue,
                          sets, notional_usd, locked_profit, fill_pct, note, mode, edge_pct)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO NOTHING
    `,
      t.id, t.timestamp, t.market_id, t.description, t.strategy, t.venue,
      t.sets, t.notional_usd, t.locked_profit, t.fill_pct, t.note, t.mode, t.edge_pct,
    );
  }

  // Upsert today's equity point
  const todayDate = today;
  await dbRun(`
    INSERT INTO equity_history (date, equity, pnl)
    VALUES ($1::date, $2, $3)
    ON CONFLICT (date) DO UPDATE SET
      equity = EXCLUDED.equity,
      pnl    = EXCLUDED.pnl
  `, todayDate, stats.bankroll_usd, stats.realized_pnl_total);

  // Mark old opportunities inactive, insert new ones
  await dbRun(`UPDATE opportunities SET is_active = false WHERE detected_at < NOW() - INTERVAL '1 hour'`);
  for (const opp of opportunities.slice(0, 20)) {
    await dbRun(`
      INSERT INTO opportunities (market_id, question, edge_pct, implied_prob_yes, implied_prob_no,
                                  depth_usd, strategy, venue, detected_at, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), true)
      ON CONFLICT (market_id, detected_at) DO NOTHING
    `,
      opp.market_id, opp.question, opp.edge_pct,
      opp.prices?.[0] ?? 0, opp.prices?.[1] ?? 0,
      opp.depth_usd, opp.strategy, opp.venue,
    );
  }

  console.log("Neon Postgres: state synced.");
}

console.log(`Done. Bankroll: $${stats.bankroll_usd} | Total PnL: $${stats.realized_pnl_total} | Uptime: ${stats.uptime_hours}h`);
