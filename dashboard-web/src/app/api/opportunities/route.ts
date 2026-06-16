import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const BOT_URL = process.env.BOT_API_URL;

export async function GET() {
  if (BOT_URL) {
    try {
      const res = await fetch(`${BOT_URL}/opportunities`, {
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      if (res.ok) return NextResponse.json(await res.json());
    } catch { /* fall through */ }
  }

  const filePath = join(process.cwd(), "public", "data", "opportunities.json");
  try {
    if (existsSync(filePath)) {
      const opps = JSON.parse(readFileSync(filePath, "utf-8"));
      return NextResponse.json(Array.isArray(opps) ? opps : []);
    }
  } catch { /* ignore */ }
  return NextResponse.json([]);
}
