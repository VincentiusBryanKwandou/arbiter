import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export async function GET() {
  const filePath = join(process.cwd(), "public", "data", "backtest.json");
  if (existsSync(filePath)) {
    try {
      const data = JSON.parse(readFileSync(filePath, "utf-8"));
      return NextResponse.json(data, {
        headers: { "Cache-Control": "s-maxage=300" },
      });
    } catch {
      // fall through
    }
  }
  return NextResponse.json(null, {
    headers: { "Cache-Control": "s-maxage=300" },
  });
}
