/**
 * Live market data langsung dari Polymarket Gamma API.
 * Tidak butuh bot Python — berjalan di Vercel serverless.
 * Melakukan deteksi Dutch book dasar menggunakan mid-price sebagai proxy.
 */
import { NextResponse } from "next/server";
import type { LiveMarket } from "@/types";

const GAMMA = "https://gamma-api.polymarket.com";

const POLITICS_KW = [
  "politic", "election", "president", "senate", "congress", "governor",
  "primary", "parliament", "vote", "ballot", "trump", "biden", "harris",
  "democrat", "republican", "minister", "cabinet", "prime minister",
  "referendum", "campaign", "candidate", "party", "legislation",
];

function isPolitical(question: string, tags: string[]): boolean {
  const hay = [question, ...tags].join(" ").toLowerCase();
  return POLITICS_KW.some((kw) => hay.includes(kw));
}

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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "150"), 300);
  const showAll = searchParams.get("all") === "1";

  try {
    const res = await fetch(
      `${GAMMA}/markets?active=true&closed=false&limit=${limit}&order=volume&ascending=false`,
      {
        headers: { "User-Agent": "arbiter-dashboard/1.0" },
        next: { revalidate: 30 },
      }
    );
    if (!res.ok) throw new Error(`Gamma API ${res.status}`);

    const data = await res.json();
    const rows: unknown[] = Array.isArray(data) ? data : (data as { data?: unknown[] }).data ?? [];

    const markets: LiveMarket[] = [];

    for (const raw of rows) {
      const r = raw as Record<string, unknown>;
      const question = String(r.question ?? "");
      const tagsRaw = parseList(r.tags ?? []);
      const tags = tagsRaw.map((t) => {
        try { return String((JSON.parse(t) as { label?: string }).label ?? t); }
        catch { return t; }
      });

      if (!showAll && !isPolitical(question, tags)) continue;

      const outcomes = parseList(r.outcomes ?? []);
      const prices = parseList(r.outcomePrices ?? []).map(toNum);
      const tokenIds = parseList(r.clobTokenIds ?? []);

      if (outcomes.length < 2 || prices.length < 2 || tokenIds.length < 2) continue;

      const sumPrices = prices.reduce((a, b) => a + b, 0);
      // Mid-price estimate: actual arb needs bid/ask from CLOB, this is an indicator only.
      // We subtract 0.02 (approx fee + spread buffer) to get conservative edge estimate.
      const potEdge = +(Math.max(0, 1.0 - sumPrices - 0.02)).toFixed(4);
      const hasArb = potEdge > 0.01; // >1% edge above fee buffer

      markets.push({
        market_id: String(r.id ?? ""),
        question,
        outcomes,
        prices,
        token_ids: tokenIds,
        volume: toNum(r.volume),
        liquidity: toNum(r.liquidity),
        end_date: r.endDate ? String(r.endDate) : null,
        sum_prices: +sumPrices.toFixed(4),
        potential_edge: potEdge,
        has_arb: hasArb,
        strategy: outcomes.length === 2 ? "binary_dutch_book" : "mutually_exclusive",
        venue: "polymarket",
      });
    }

    // Arb first, then by volume
    markets.sort((a, b) => {
      if (a.has_arb !== b.has_arb) return a.has_arb ? -1 : 1;
      return b.volume - a.volume;
    });

    return NextResponse.json({ markets, count: markets.length, ts: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ markets: [], count: 0, error: String(e) }, { status: 500 });
  }
}
