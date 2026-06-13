import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export async function GET() {
  const filePath = join(process.cwd(), "public", "data", "opportunities.json");
  let opps: unknown[] = [];
  try {
    if (existsSync(filePath)) {
      opps = JSON.parse(readFileSync(filePath, "utf-8"));
    }
  } catch {
    // ignore
  }
  return NextResponse.json(Array.isArray(opps) ? opps : [], {
    headers: { "Cache-Control": "s-maxage=15" },
  });
}
