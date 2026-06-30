import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getDb } from "@/lib/db";
import { applyRateLimit, sanitizeNumber } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rl = applyRateLimit(req, 10, 60_000, "bankroll");
  if (rl) return rl;

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const token = await getToken({ req, secret }).catch(() => null);
  if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const userId = token.userId ? Number(token.userId) : 1;

  let bankroll_usd: number;
  try {
    const body = await req.json();
    bankroll_usd = sanitizeNumber(body.bankroll_usd, 0, 10_000_000);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  if (bankroll_usd <= 0) {
    return NextResponse.json({ ok: false, error: "bankroll_usd must be greater than 0" }, { status: 422 });
  }

  try {
    const sql = getDb();

    // Get current bankroll
    const rows = await sql`SELECT bankroll_usd FROM bot_stats WHERE user_id = ${userId} LIMIT 1` as { bankroll_usd: number }[];
    const oldBankroll = rows.length > 0 ? Number(rows[0].bankroll_usd) : 1000;

    // Upsert — create row if it doesn't exist yet (new user who hasn't been seeded)
    await sql`
      INSERT INTO bot_stats (user_id, bankroll_usd)
      VALUES (${userId}, ${bankroll_usd})
      ON CONFLICT (user_id) DO UPDATE SET
        bankroll_usd = ${bankroll_usd},
        updated_at   = NOW()
    `;

    return NextResponse.json({ ok: true, old: oldBankroll, new: bankroll_usd });
  } catch (err) {
    console.error("[bankroll]", err);
    return NextResponse.json({ ok: false, error: "Database error" }, { status: 500 });
  }
}
