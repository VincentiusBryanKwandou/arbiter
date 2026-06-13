import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export async function GET(req: NextRequest) {
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "50");
  const filePath = join(process.cwd(), "public", "data", "trades.json");

  let trades: unknown[] = [];
  try {
    if (existsSync(filePath)) {
      trades = JSON.parse(readFileSync(filePath, "utf-8"));
    }
  } catch {
    // ignore
  }

  const sliced = Array.isArray(trades) ? trades.slice(-limit).reverse() : [];
  return NextResponse.json(sliced);
}
