import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb, seedUserStats } from "@/lib/db";
import { sanitizeString, applyRateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rl = applyRateLimit(req, 5, 60_000, "signup");
  if (rl) return rl;

  let username: string, password: string;
  try {
    const body = await req.json();
    username = sanitizeString(body.username, 50).toLowerCase().trim();
    password = String(body.password ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3–30 characters (letters, numbers, underscore)" },
      { status: 422 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 422 });
  }
  if (password.length > 128) {
    return NextResponse.json({ error: "Password too long" }, { status: 422 });
  }

  const hash = await bcrypt.hash(password, 10);

  try {
    const sql = getDb();
    const rows = await sql`
      INSERT INTO users (username, password_hash)
      VALUES (${username}, ${hash})
      RETURNING id
    ` as { id: number }[];

    const newUserId = rows[0].id;
    void seedUserStats(newUserId);
    return NextResponse.json({ ok: true, userId: newUserId }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }
    console.error("[signup]", msg);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
