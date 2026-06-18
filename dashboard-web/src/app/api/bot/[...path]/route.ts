import { NextRequest, NextResponse } from "next/server";

const BOT_URL = process.env.BOT_API_URL ?? "http://localhost:8001";

async function proxy(req: NextRequest, path: string[]) {
  const url = `${BOT_URL}/${path.join("/")}${req.nextUrl.search}`;
  try {
    const isWrite = req.method !== "GET" && req.method !== "HEAD";
    const body = isWrite ? await req.text() : undefined;

    const res = await fetch(url, {
      method: req.method,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body,
      signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 15_000); return c.signal; })(),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      {
        error: "Bot API tidak aktif.",
        hint: "Jalankan di terminal project root: uvicorn api.server:app --host 0.0.0.0 --port 8001",
        bot_url: BOT_URL,
      },
      { status: 503 }
    );
  }
}

type Ctx = { params: { path: string[] } };

export async function GET(req: NextRequest, { params }: Ctx) {
  return proxy(req, params.path);
}
export async function POST(req: NextRequest, { params }: Ctx) {
  return proxy(req, params.path);
}
export async function DELETE(req: NextRequest, { params }: Ctx) {
  return proxy(req, params.path);
}
export async function PUT(req: NextRequest, { params }: Ctx) {
  return proxy(req, params.path);
}
