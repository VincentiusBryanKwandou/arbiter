// Dutch-book scanner — runs server-side against Polymarket Gamma REST API.
// No external process or storage required; executes inside Vercel functions.

export interface Opportunity {
  market_id: string;
  question: string;
  venue: string;
  outcomes: string[];
  prices: number[];
  edge_pct: number;
  depth_usd: number;
  strategy: string;
  sum_prices: number;
}

const GAMMA = "https://gamma-api.polymarket.com";

function parseList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string" && v.trim()) {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p.map(String) : [];
    } catch { return []; }
  }
  return [];
}

function toNum(v: unknown): number {
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

export async function scanPolymarket(
  limit = 200,
  minEdgePct = 0.01
): Promise<{ opportunities: Opportunity[]; scanned: number; ts: string }> {
  const res = await fetch(
    `${GAMMA}/markets?active=true&closed=false&limit=${limit}&order=volume&ascending=false`,
    {
      headers: { "User-Agent": "arbiter-scanner/1.0" },
      cache: "no-store",
      signal: (() => {
        const c = new AbortController();
        setTimeout(() => c.abort(), 15_000);
        return c.signal;
      })(),
    }
  );

  if (!res.ok) throw new Error(`Gamma API ${res.status}`);

  const data = await res.json();
  const rows: unknown[] = Array.isArray(data)
    ? data
    : (data as { data?: unknown[] }).data ?? [];

  const opportunities: Opportunity[] = [];

  for (const raw of rows) {
    const r = raw as Record<string, unknown>;
    const question = String(r.question ?? "").trim();
    if (!question) continue;

    const outcomes = parseList(r.outcomes ?? []);
    const prices = parseList(r.outcomePrices ?? []).map(toNum);

    if (outcomes.length < 2 || prices.length < 2) continue;

    const sumPrices = prices.reduce((a, b) => a + b, 0);
    // Conservative edge: subtract 2% fee/spread buffer
    const edge = +(Math.max(0, 1.0 - sumPrices - 0.02)).toFixed(4);

    if (edge < minEdgePct) continue;

    const liquidity = toNum(r.liquidity);

    opportunities.push({
      market_id: String(r.id ?? ""),
      question,
      venue: "polymarket",
      outcomes,
      prices,
      edge_pct: edge,
      depth_usd: liquidity,
      strategy: outcomes.length === 2 ? "dutch_book" : "mutually_exclusive",
      sum_prices: +sumPrices.toFixed(4),
    });
  }

  opportunities.sort((a, b) => b.edge_pct - a.edge_pct);

  return {
    opportunities: opportunities.slice(0, 20),
    scanned: rows.length,
    ts: new Date().toISOString(),
  };
}
