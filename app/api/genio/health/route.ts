import { NextResponse } from "next/server";

export async function GET() {
  const isConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());

  return NextResponse.json(
    {
      ok: true,
      openaiConfigured: isConfigured,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    },
    { status: isConfigured ? 200 : 503 }
  );
}
