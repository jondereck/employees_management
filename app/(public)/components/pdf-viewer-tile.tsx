"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { PDFDocument, rgb, degrees } from "pdf-lib";


let pdfjsLib: any = null;

async function ensurePdfJs() {
  if (!pdfjsLib) {
    // legacy build avoids the defineProperty crash in Next/Edge
    pdfjsLib = await import("pdfjs-dist/legacy/build/pdf");

    // import the legacy worker as an asset URL so Next can serve it
    const workerUrl = (await import(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"
    )).default;

    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  }
}




// ---------------------------------------------------------

type PdfViewerTileProps = {
  title?: string;
  description?: string;
  pdfUrl: string;

  // Watermark options
  watermarkImageUrl?: string;
  watermarkText?: string;
  wmSize?: number;
  wmOpacity?: number;
  wmRotationDeg?: number;

  // Viewer options
  usePdfJsViewer?: boolean;

  // NEW: Thumbnail options
  thumbnailUrl?: string;     // static image (/public/thumbs/handbook.png)
  autoThumbnail?: boolean;   // render page 1 via pdfjs if no thumbnailUrl
  thumbWidth?: number;       // px; default 40 (fits your tile icon area)
  thumbHeight?: number;      // px; aspect kept by contain

  className?: string;
  downloadFileName?: string;
};

export default function PdfViewerTile({
  title = "Handbook & Policies",
  description = "Open and read without leaving the app",
  pdfUrl,
  watermarkImageUrl = "/logo.png",
  watermarkText,
  wmSize = 0.35,
  wmOpacity = 0.15,
  wmRotationDeg = 0,
  usePdfJsViewer = false,

  thumbnailUrl,
  autoThumbnail = true,
  thumbWidth = 40,
  thumbHeight = 40,

  className,
  downloadFileName = "document-watermarked.pdf",
}: PdfViewerTileProps) {
  const [open, setOpen] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
 const [thumbDataUrl, setThumbDataUrl] = React.useState<string | null>(null);
const [thumbError, setThumbError] = React.useState<string | null>(null);

  
React.useEffect(() => {
  let aborted = false;

  async function makeThumb() {
    setThumbError(null);

    if (thumbnailUrl) {
      setThumbDataUrl(thumbnailUrl);
      return;
    }
    if (!autoThumbnail) return;

    try {
      // 0) prove we’re in the browser
      if (typeof window === "undefined") return;

      // 1) normalize to absolute URL
      const absUrl = new URL(pdfUrl.startsWith("/") ? pdfUrl : `/${pdfUrl}`, window.location.origin).toString();
      console.debug("[PdfThumb] absUrl:", absUrl);

      // 2) fetch the bytes yourself (avoids CORS/cookies issues)
      
      

      // 3) load pdfjs (client) — we’ll render without worker for simplicity
    await ensurePdfJs();
const resp = await fetch(new URL(pdfUrl, window.location.origin).toString(), {
  credentials: "same-origin",
  cache: "force-cache",
});
if (!resp.ok) throw new Error(`fetch failed (${resp.status})`);
const data = await resp.arrayBuffer();

// Let pdf.js use its worker (no disableWorker here)
const loadingTask = pdfjsLib.getDocument({ data });
const pdf = await loadingTask.promise;
const page = await pdf.getPage(1);

const baseViewport = page.getViewport({ scale: 1 });
const targetW = 160;
const scale = targetW / baseViewport.width;
const viewport = page.getViewport({ scale });

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("2D canvas context unavailable");

canvas.width = Math.ceil(viewport.width);
canvas.height = Math.ceil(viewport.height);

await page.render({ canvasContext: ctx, viewport }).promise;
setThumbDataUrl(canvas.toDataURL("image/jpeg", 0.85));
    } catch (err: any) {
      console.warn("[PdfThumb] failed:", err);
      if (!aborted) setThumbError(err?.message || "Thumbnail failed");
    }
  }

  makeThumb();
  return () => { aborted = true; };
}, [pdfUrl, thumbnailUrl, autoThumbnail]);



  const iframeSrc = usePdfJsViewer
    ? `/pdfjs/web/viewer.html?file=${encodeURIComponent(pdfUrl)}`
    : `${pdfUrl}#toolbar=0&navpanes=0`;

  async function handleDownloadWatermarked() {
    setDownloading(true);
    try {
      const [pdfBytes, imgBytes] = await Promise.all([
        fetch(pdfUrl).then(r => r.arrayBuffer()),
        watermarkImageUrl ? fetch(watermarkImageUrl).then(r => r.arrayBuffer()) : Promise.resolve(new ArrayBuffer(0)),
      ]);

      const pdfDoc = await PDFDocument.load(pdfBytes);
      let embeddedImg: any | null = null;

      if (watermarkImageUrl) {
        const isPng = watermarkImageUrl.toLowerCase().endsWith(".png");
        const isJpg = /\.(jpe?g)$/i.test(watermarkImageUrl);
        if (isPng) embeddedImg = await pdfDoc.embedPng(imgBytes);
        else if (isJpg) embeddedImg = await pdfDoc.embedJpg(imgBytes);
      }

      for (const page of pdfDoc.getPages()) {
        const { width, height } = page.getSize();
        const targetWidth = width * wmSize;
        let imgW = 0, imgH = 0;
        if (embeddedImg) {
          const ratio = embeddedImg.height / embeddedImg.width;
          imgW = targetWidth;
          imgH = targetWidth * ratio;
          page.drawImage(embeddedImg, {
            x: (width - imgW) / 2,
            y: (height - imgH) / 2,
            width: imgW,
            height: imgH,
            opacity: wmOpacity,
            rotate: degrees(wmRotationDeg),
          });
        }
        if (watermarkText?.trim()) {
          const fontSize = Math.max(24, Math.min(64, width * 0.05));
          page.drawText(watermarkText, {
            x: width / 2 - (watermarkText.length * fontSize * 0.25),
            y: height / 2 - fontSize / 2 - (embeddedImg ? imgH * 0.6 : 0),
            size: fontSize,
            opacity: wmOpacity,
            color: rgb(0.2, 0.2, 0.2),
            rotate: degrees(wmRotationDeg),
          });
        }
      }

      const stamped = await pdfDoc.save(); // Uint8Array -> normalize to ArrayBuffer
      const ab = new ArrayBuffer(stamped.byteLength);
      new Uint8Array(ab).set(stamped);
      const blob = new Blob([ab], { type: "application/pdf" });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadFileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full h-full outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary rounded-xl",
            className
          )}
        >
          <Card className="group relative flex w-full items-center gap-4 rounded-xl p-4 hover:shadow-md transition border">
            {/* Thumbnail / Icon */}
         <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted overflow-hidden relative">
  {thumbDataUrl ? (
    <img
      src={thumbDataUrl}
      alt=""
      className="h-full w-full object-contain"
      width={thumbWidth}
      height={thumbHeight}
      style={{ maxWidth: thumbWidth, maxHeight: thumbHeight }}
    />
  ) : (
    <FileText className="h-6 w-6 text-foreground/70" />
  )}
  {thumbError && (
    <span className="absolute -bottom-1 right-1 rounded bg-amber-500 text-[10px] px-1 py-[1px] text-white">
      !
    </span>
  )}
</div>

            <div className="min-w-0">
              <div className="font-semibold leading-tight">{title}</div>
              <div className="text-sm text-muted-foreground truncate">{description}</div>
            </div>

            <div className="ml-auto text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition">
              Open
            </div>
          </Card>
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[96vw] md:max-w-[90vw] lg:max-w-[80vw] xl:max-w-[70vw] p-0 overflow-hidden sm:rounded-2xl">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">View {title} inside the app</DialogDescription>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 px-4 pb-3">
          <div className="text-sm text-muted-foreground hidden sm:block">
            Inline viewer — watermark overlay; download is watermarked.
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadWatermarked} disabled={downloading}>
              <Download className="mr-2 h-4 w-4" />
              {downloading ? "Preparing…" : "Download (watermarked)"}
            </Button>
          </div>
        </div>

        {/* Watermark overlay + viewer */}
        <div className="relative h-[82vh] w-full">
          <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ opacity: 0.20 }}>
            {watermarkImageUrl && (
              <img
                src={watermarkImageUrl}
                alt=""
                className="select-none"
                style={{ width: "40%", maxWidth: 420, transform: "none", opacity: 0.5, filter: "grayscale(100%) contrast(120%)" }}
              />
            )}
            {watermarkText && (
              <div className="absolute text-4xl md:text-6xl font-bold tracking-wider">{watermarkText}</div>
            )}
          </div>

          <iframe title={title} src={iframeSrc} className="h-full w-full" loading="lazy" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
