import { headers } from "next/headers";
import { z } from "zod";

function originFromReq(): string {
  const h = headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host  = h.get("x-forwarded-host") || h.get("host");
  // Fallback to env (configure in .env for local dev)
  return host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000");
}

function toAbsoluteUrl(input: unknown, origin: string): string | undefined {
  if (input == null) return undefined;
  const v = String(input).trim();
  if (v === "") return undefined;
  try { 
    // already absolute?
    new URL(v);
    return v;
  } catch {
    // make relative -> absolute
    try { return new URL(v, origin).toString(); } catch { return undefined; }
  }
}

// Zod: optional absolute URL; treats ""/null/undefined as optional
const OptionalAbsoluteUrl = z.preprocess((v) => {
  const abs = toAbsoluteUrl(v, originFromReq());
  return abs ?? undefined;
}, z.string().url().optional());
