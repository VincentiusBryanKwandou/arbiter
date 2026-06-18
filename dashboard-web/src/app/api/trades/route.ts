import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const BOT_URL = process.env.BOT_API_URL;

export async function GET(req: NextRequest) {
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "100");

  if (BOT_URL) {
    try {
      const res = await fetch(`${BOT_URL}/trades?limit=${limit}`, {
        cache: "no-store",
        signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 8_000); return c.signal; })(),
      });
      if (res.ok) return NextResponse.json(await res.json());
    } catch { /* fall through */ }
  }

  const filePath = join(process.cwd(), "public", "data", "trades.json");
  try {
    if (existsSync(filePath)) {
      const all = JSON.parse(readFileSync(filePath, "utf-8")) as unknown[];
      return NextResponse.json(Array.isArray(all) ? all.slice(-limit).reverse() : []);
    }
  } catch { /* ignore */ }
  return NextResponse.json([]);
}
