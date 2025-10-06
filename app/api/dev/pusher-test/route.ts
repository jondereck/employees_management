import { pusherServer } from "@/lib/pusher";
import { NextResponse } from "next/server";


export async function POST() {
  await pusherServer.trigger("dev-hrps", "ping", { when: new Date().toISOString() });
  return NextResponse.json({ ok: true });
}
