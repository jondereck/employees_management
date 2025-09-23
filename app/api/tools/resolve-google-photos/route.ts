import { NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set([
  "photos.app.goo.gl",
  "photos.google.com",
]);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");
    if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

    const u = new URL(url);
    if (!ALLOWED_HOSTS.has(u.hostname)) {
      return NextResponse.json({ error: "Only Google Photos share links are supported" }, { status: 400 });
    }

    // fetch the share page server-side (CORS-safe here)
    const res = await fetch(url, { redirect: "follow" });
    const html = await res.text();

    // try to find the first lh*.googleusercontent.com image URL in the page
    const match = html.match(/https:\/\/lh\d\.googleusercontent\.com\/[^\s"'<>\\)]+/);
    if (!match) {
      return NextResponse.json({ error: "Could not find an image on that page." }, { status: 404 });
    }

    // strip trailing punctuation if any
    let direct = match[0].replace(/[),.]+$/, "");

    // optional: add a max width hint if missing (Google handles params)
    if (!/[?&]w=\d+/.test(direct)) {
      const sep = direct.includes("?") ? "&" : "?";
      direct = `${direct}${sep}w=1600`;
    }

    return NextResponse.json({ url: direct });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Resolve failed" }, { status: 500 });
  }
}
