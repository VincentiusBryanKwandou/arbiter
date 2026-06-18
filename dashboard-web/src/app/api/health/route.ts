import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    bot: "arbiter",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
}
