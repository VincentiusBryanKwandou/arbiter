import { NextResponse } from "next/server";
import { initSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/db/init  — run once after first deploy to create tables
export async function GET() {
  try {
    await initSchema();
    return NextResponse.json({ ok: true, message: "Schema initialized" });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
