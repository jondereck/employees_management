// lib/base-url.ts
export function getBaseUrl() {
  if (typeof window !== "undefined") return "";        // browser: use relative
  const protocol = process.env.VERCEL ? "https" : "http";
  const host =
    process.env.VERCEL_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    "localhost:3000";
  return `${protocol}://${host}`;
}
