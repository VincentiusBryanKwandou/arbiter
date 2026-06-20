import { NextResponse } from "next/server";
import { scanPolymarket } from "@/lib/scanner";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Vercel Cron invokes this route every 5 minutes.
// Authorization header is set by Vercel automatically with CRON_SECRET.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();

  try {
    const { opportunities, scanned, ts } = await scanPolymarket(200, 0.01);

    const elapsed = Date.now() - start;

    return NextResponse.json({
      ok: true,
      ts,
      scanned,
      opportunities_found: opportunities.length,
      top_edge_pct: opportunities[0]?.edge_pct ?? 0,
      elapsed_ms: elapsed,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err), elapsed_ms: Date.now() - start },
      { status: 500 }
    );
  }
}
