#!/usr/bin/env node
// Paper trading scanner — runs in GitHub Actions every 5 min.
// Writes JSON files (committed to GitHub) + POSTs to Vercel API → Neon Postgres.
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ── Vercel API endpoint for syncing scan results to Neon ──────────────────────
// No npm install needed — uses built-in fetch (Node 18+).
const SCAN_API = process.env.SCAN_API_URL ?? "https://arbiterbot.vercel.app/api/scan-result";

async function pushToNeon(payload) {
  try {
    const res = await fetch(SCAN_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12_000),
    });
    const data = await res.json();
    if (data.ok) {
      console.log("Neon sync: ok —", JSON.stringify(data.written));
    } else {
      console.warn("Neon sync failed:", data.error);
    }
  } catch (err) {
    console.warn("Neon sync error:", err.message);
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

// ── Sync to Neon via Vercel API (no extra npm install in GitHub Actions) ─────
await pushToNeon({
  stats,
  new_trades: newTrades,
  opportunities: opportunities.slice(0, 20).map(o => ({
    ...o,
    implied_prob_yes: o.prices?.[0] ?? 0,
    implied_prob_no:  o.prices?.[1] ?? 0,
  })),
  equity_date: today,
});

console.log(`Done. Bankroll: $${stats.bankroll_usd} | Total PnL: $${stats.realized_pnl_total} | Uptime: ${stats.uptime_hours}h`);
