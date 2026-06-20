#!/usr/bin/env node
// Paper trading scanner — runs in GitHub Actions every 5 min.
// Uses only Node.js built-ins (fetch, fs) — zero npm install needed.
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "dashboard-web", "public", "data");

// ── Config ────────────────────────────────────────────────────────────────────
const BANKROLL_INITIAL = 1000;
const KELLY_FRACTION   = 0.25;      // ¼ Kelly
const MAX_POSITIONS    = 5;
const MIN_EDGE_PCT     = 0.03;      // 3% min edge after fees
const KILL_LOSS_PCT    = 0.10;      // 10% daily loss → kill switch
const GAMMA            = "https://gamma-api.polymarket.com";

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
} catch (err) {
  console.error("Gamma API error:", err.message);
  stats.last_scan_at = new Date().toISOString();
  writeJson(join(DATA, "stats.json"), stats);
  process.exit(0);
}
console.log(`Fetched ${rows.length} markets.`);

// ── Detect Dutch-book opportunities ──────────────────────────────────────────
const opportunities = [];

for (const r of rows) {
  const question = String(r.question ?? "").trim();
  if (!question) continue;

  const outcomes = parseList(r.outcomes ?? []);
  const prices   = parseList(r.outcomePrices ?? []).map(toNum);

  if (outcomes.length < 2 || prices.length < 2) continue;

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
  }
}

// ── Kill switch check ─────────────────────────────────────────────────────────
const lossToday    = stats.realized_pnl_today < 0 ? Math.abs(stats.realized_pnl_today) : 0;
stats.daily_loss_pct = +(lossToday / BANKROLL_INITIAL).toFixed(4);
if (stats.daily_loss_pct >= KILL_LOSS_PCT) {
  stats.kill_switch_active = true;
  console.warn("Kill switch triggered! Daily loss exceeded 10%.");
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

// ── Write files ───────────────────────────────────────────────────────────────
writeJson(join(DATA, "stats.json"),         stats);
writeJson(join(DATA, "trades.json"),        allTrades.slice(-200));  // keep last 200
writeJson(join(DATA, "equity.json"),        equity);
writeJson(join(DATA, "opportunities.json"), opportunities.slice(0, 20));

console.log(`Done. Bankroll: $${stats.bankroll_usd} | Total PnL: $${stats.realized_pnl_total} | Uptime: ${stats.uptime_hours}h`);
