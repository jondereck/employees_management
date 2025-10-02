// app/api/pdf/wm/route.ts
import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";



async function fetchBytes(url: string) {
  const r = await fetch(url, { cache: "force-cache" });
  if (!r.ok) throw new Error(`Fetch ${url} -> ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const file = searchParams.get("file");
    if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });

    const text = searchParams.get("text") ?? "Municipality of Lingayen";
    const img = searchParams.get("img");
    const size = Number(searchParams.get("size") ?? 320);
    const opacity = Number(searchParams.get("opacity") ?? 0.12);
    const rotate = Number(searchParams.get("rotate") ?? 30);

    const base = new URL(req.url);
    const fileUrl = new URL(file, base.origin).toString();
    const imgUrl = img ? new URL(img, base.origin).toString() : null;

    const srcBytes = await fetchBytes(fileUrl);

    const { PDFDocument, rgb, degrees } = await import("pdf-lib");
    const pdfDoc = await PDFDocument.load(srcBytes, { updateMetadata: false });

    let wmImg: any = null;
    if (imgUrl) {
      try {
        const ib = await fetchBytes(imgUrl);
        try {
          wmImg = await pdfDoc.embedPng(ib);
        } catch {
          wmImg = await pdfDoc.embedJpg(ib);
        }
      } catch {
        wmImg = null;
      }
    }

    const font = await pdfDoc.embedFont("Helvetica");

    for (const page of pdfDoc.getPages()) {
      const { width, height } = page.getSize();
      const rot = degrees(rotate);

      if (wmImg) {
        const imgWidth = size;
        const scale = imgWidth / wmImg.width;
        const imgHeight = wmImg.height * scale;
        page.drawImage(wmImg, {
          x: (width - imgWidth) / 2,
          y: (height - imgHeight) / 2,
          width: imgWidth,
          height: imgHeight,
          opacity,
          rotate: rot,
        });
      }

      if (text) {
        const textSize = size * 0.25;
        const textWidth = font.widthOfTextAtSize(text, textSize);
        const textHeight = font.heightAtSize(textSize);
        page.drawText(text, {
          x: (width - textWidth) / 2,
          y: (height - textHeight) / 2,
          size: textSize,
          font,
          color: rgb(0, 0, 0),
          opacity,
          rotate: rot,
        });
      }
    }

const bytes = await pdfDoc.save(); // Uint8Array

// Convert to standalone ArrayBuffer (avoid SAB issues)
const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

// Optional nice filename from query (?name=Employee-Handbook.pdf)
const name = (searchParams.get("name") || "document.pdf").replace(/[^\w.-]+/g, "_");

return new NextResponse(ab as ArrayBuffer, {
  status: 200,
  headers: {
    "Content-Type": "application/pdf",
    // 👇 render inline, not as a download
    "Content-Disposition": `inline; filename="${name}"`,
    // caching (tune as you like)
    "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    // harden a bit
    "X-Content-Type-Options": "nosniff",
    // (optional) helps some viewers with range requests / seeking
    // "Accept-Ranges": "bytes",
  },
});

  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
