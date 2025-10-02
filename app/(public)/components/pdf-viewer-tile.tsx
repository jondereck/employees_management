"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, FileText } from "lucide-react";
import { cn } from "@/lib/utils";


// ---- helpers (module scope) ----
// module-scope helper
function u8ToArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u8.byteLength);
  new Uint8Array(ab).set(u8);
  return ab;
}


type SimplePdfViewerTileProps = {
  title?: string;
  description?: string;

  /** Public path or absolute URL to a PDF (e.g. "/_pdf/employee-handbook.pdf") */
  pdfUrl: string;

  /** If you want to change the downloaded name, set this. */
  downloadFileName?: string;

  /** Optional: transform bytes before downloading (e.g., extra stamping beyond the watermark). */
  onPrepareDownload?: (bytes: ArrayBuffer) => Promise<Blob | ArrayBuffer>;

  /** Use native toolbar? */
  showNativeToolbar?: boolean;

  /** Watermark options (applies to viewer & download) */
  watermarkText?: string;            // e.g., "Municipality of Lingayen • HRMO"
  watermarkImageUrl?: string;        // e.g., "/logo.png" (png/jpg)
  wmSize?: number;                   // base size for text font / image width in points (default 320)
  wmOpacity?: number;                // 0..1 (default 0.12)
  wmRotationDeg?: number;            // default 30
  className?: string;
  nativeToolbarOnly?: boolean;
};

export default function SimplePdfViewerTile({
  title = "PDF",
  description = "Open and read without leaving the app",
  pdfUrl,
  downloadFileName = "document.pdf",
  onPrepareDownload,
  showNativeToolbar = true,
  nativeToolbarOnly = true,   // << default ON
  watermarkText = "CONFIDENTIAL • HRMO",
  watermarkImageUrl,           // optional
  wmSize = 320,
  wmOpacity = 0.12,
  wmRotationDeg = 30,
  className,
}: SimplePdfViewerTileProps) {
  const [open, setOpen] = React.useState(false);

  const [processing, setProcessing] = React.useState(false);
  const [embedOk, setEmbedOk] = React.useState(true);
// delete:
const [downloading, setDownloading] = React.useState(false);
// delete the whole handleDownload() function

  // Watermarked blob/url (created when dialog opens)
  const [wmBlob, setWmBlob] = React.useState<Blob | null>(null);
  const [wmUrl, setWmUrl] = React.useState<string | null>(null);

  // add this helper at top of file
function shouldUsePdfJs() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  // Many mobile browsers block inline PDF in embeds
  const isMobile = /Android|iPhone|iPad|iPod|SamsungBrowser/i.test(ua);
  // Safari iOS & Samsung Internet frequently fail inside dialogs
  const isProblematic = /SamsungBrowser|CriOS|FxiOS|Mobile Safari/i.test(ua);
  return isMobile || isProblematic;
}


  // Build a safe absolute URL for the iframe/file= usage
  const absPdfUrl = React.useMemo(() => {
    if (typeof window === "undefined") return pdfUrl;
    try {
      return new URL(pdfUrl, window.location.origin).toString();
    } catch {
      return pdfUrl;
    }
  }, [pdfUrl]);


  // If we have a watermarked blob URL, use that for viewing; else the original.
  const viewerBaseUrl = wmUrl ?? absPdfUrl;

// keep your existing viewerBaseUrl logic
const viewerUrl = React.useMemo(() => {
  const base = viewerBaseUrl; // wmUrl ?? absPdfUrl
  return `${base}#toolbar=1&navpanes=0`;   // always show native toolbar
}, [viewerBaseUrl]);



  // Clean up object URLs on unmount/close
  React.useEffect(() => {
    return () => {
      if (wmUrl) URL.revokeObjectURL(wmUrl);
    };
  }, [wmUrl]);

  // Fetch helper
  async function fetchAsArrayBuffer(url: string): Promise<ArrayBuffer> {
    const resp = await fetch(url, { credentials: "same-origin" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.arrayBuffer();
  }

  // Create watermarked PDF once when dialog opens (or when pdfUrl changes while open)
  React.useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function prepare() {
      setProcessing(true);
      setEmbedOk(true);

      try {
        // 1) Load original PDF bytes
        const srcBytes = await fetchAsArrayBuffer(absPdfUrl);

        // 2) Lazy import pdf-lib
        const { PDFDocument, rgb, degrees } = await import("pdf-lib");

        // 3) Create document from bytes
        const pdfDoc = await PDFDocument.load(srcBytes, { updateMetadata: false });

        // 4) Optional: embed watermark image
        let wmImg: any = null;
        if (watermarkImageUrl) {
          try {
            const imgBytes = await fetchAsArrayBuffer(
              new URL(watermarkImageUrl, typeof window !== "undefined" ? window.location.origin : undefined as any).toString()
            );
            // Heuristics to decide embed type by file header
            const isPng = imgBytes.byteLength >= 8 && new Uint8Array(imgBytes)[1] === 0x50; // crude check
            wmImg = isPng ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);
          } catch {
            // ignore image errors, continue with text-only watermark
            wmImg = null;
          }
        }

        const font = await pdfDoc.embedFont("Helvetica");

        // 5) Stamp each page
        const pages = pdfDoc.getPages();
        for (const page of pages) {
          const { width, height } = page.getSize();

          // Common transforms
          const rotate = degrees(wmRotationDeg);

          // (a) Image watermark (centered)
          if (wmImg) {
            const imgWidth = wmSize;
            const scale = imgWidth / wmImg.width;
            const imgHeight = wmImg.height * scale;

            page.drawImage(wmImg, {
              x: (width - imgWidth) / 2,
              y: (height - imgHeight) / 2,
              width: imgWidth,
              height: imgHeight,
              opacity: wmOpacity,
              rotate,
            });
          }

          // (b) Text watermark (large, centered)
          if (watermarkText) {
            const textSize = wmSize * 0.25; // tie text size to wmSize
            const textWidth = font.widthOfTextAtSize(watermarkText, textSize);
            const textHeight = font.heightAtSize(textSize);

            page.drawText(watermarkText, {
              x: (width - textWidth) / 2,
              y: (height - textHeight) / 2,
              size: textSize,
              font,
              color: rgb(0, 0, 0),
              opacity: wmOpacity,
              rotate,
            });
          }
        }

        // 6) Bytes → Blob → object URL
        const u8 = await pdfDoc.save(); // Uint8Array
        const bytesAB = u8ToArrayBuffer(u8); // <-- tight ArrayBuffer

        // 7) If caller wants another pass (e.g., add per-user stamp), allow it
        if (onPrepareDownload) {
          const maybe = await onPrepareDownload(bytesAB); // <-- pass ArrayBuffer
          const finalBlob = maybe instanceof Blob
            ? maybe
            : new Blob([maybe], { type: "application/pdf" });
          if (cancelled) return;
          setWmBlob(finalBlob);
          const url = URL.createObjectURL(finalBlob);
          setWmUrl(url);
          setProcessing(false);
          return;
        }

        const blob = new Blob([bytesAB], { type: "application/pdf" }); // <-- use ArrayBuffer
        if (cancelled) return;
        setWmBlob(blob);
        const url = URL.createObjectURL(blob);
        setWmUrl(url);

      } catch (err) {
        console.error("Watermarking failed, falling back to original:", err);
        if (!cancelled) {
          setWmBlob(null);
          setWmUrl(null);
        }
      } finally {
        if (!cancelled) setProcessing(false);
      }
    }

    void prepare();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    absPdfUrl,
    watermarkText,
    watermarkImageUrl,
    wmSize,
    wmOpacity,
    wmRotationDeg,
    onPrepareDownload,
  ]);

  async function handleDownload() {
    setDownloading(true);
    try {
      // If we already have a watermarked blob, download that directly
      if (wmBlob) {
        const url = URL.createObjectURL(wmBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = downloadFileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return;
      }

      // Fallback: download original (and still allow caller to prepare if provided)
      const bytes = await fetchAsArrayBuffer(absPdfUrl);
      const prepared = onPrepareDownload
        ? await onPrepareDownload(bytes)
        : new Blob([bytes], { type: "application/pdf" });
      const blob = prepared instanceof Blob ? prepared : new Blob([prepared], { type: "application/pdf" });
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

  const usePdfJs = shouldUsePdfJs();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Toolbar */}
      {!nativeToolbarOnly && (
        <div className="flex items-center justify-between gap-2 px-4 pb-3">
          <div className="text-sm text-muted-foreground hidden sm:block">
            {processing ? "Preparing watermarked copy…" : "Inline viewer; you can also download the file."}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={downloading || processing}
            >
              <Download className="mr-2 h-4 w-4" />
              {downloading ? "Preparing…" : "Download"}
            </Button>
          </div>
        </div>
      )}
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full h-full outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary rounded-xl",
            className
          )}
        >
          <Card className="group relative flex w-full items-center gap-4 rounded-xl p-4 hover:shadow-md transition border">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted overflow-hidden">
              <FileText className="h-6 w-6 text-foreground/70" />
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

        {usePdfJs ? (
        // ✅ Always works on mobile
        <iframe
          title={title}
          src={`/pdfjs-legacy/web/viewer.html?file=${encodeURIComponent(pdfUrl)}`}
          className="h-[80vh] w-full border-0"
          allow="fullscreen"
        />
      ) : (
        // old native embed path (kept for desktop Chrome/Edge)
        <object
          data={pdfUrl}
          type="application/pdf"
          className="h-[80vh] w-full"
        >
          <div className="p-6 text-center">
            <p className="mb-4 text-sm text-muted-foreground">
              Your browser can’t display PDFs inline.
            </p>
            <a href={pdfUrl} target="_blank" className="btn-primary">
              Open
            </a>
          </div>
        </object>
      )}
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            View {title} inside the app
          </DialogDescription>
        </DialogHeader>



        {/* Inline viewer with graceful fallback */}
        <div className="relative h-[82vh] w-full bg-muted/30">
          {embedOk ? (
            processing ? (
              <div className="h-full w-full grid place-items-center p-6 text-center">
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>Generating watermarked preview…</p>
                </div>
              </div>
            ) : (
              <iframe
                title={title}
                src={viewerUrl}
                className="h-full w-full"
                onError={() => setEmbedOk(false)}
              />
            )
          ) : (
            <div className="h-full w-full grid place-items-center p-6 text-center">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Inline preview is blocked by the browser/extension. You can still open the PDF in a new tab.
                </p>
                <a
                  href={viewerBaseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-primary underline"
                >
                  <FileText className="h-4 w-4" />
                  Open PDF in new tab
                </a>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
