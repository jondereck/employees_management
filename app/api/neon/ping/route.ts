// app/api/neon/ping/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.NEON_API_KEY;
  if (!key) return NextResponse.json({ ok: false, error: "Missing NEON_API_KEY" }, { status: 500 });

  const res = await fetch("https://console.neon.tech/api/v2/users/me", {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${key}`,
    },
    cache: "no-store",
  });

  const text = await res.text();
  return NextResponse.json({ ok: res.ok, status: res.status, body: safeJson(text) });

  function safeJson(s: string) {
    try { return JSON.parse(s); } catch { return s; }
  }
}
