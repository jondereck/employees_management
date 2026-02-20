"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import { cn } from "@/lib/utils";

type SimplePdfModalTileProps = {
  title?: string;
  description?: string;
  /** Public path or absolute URL to a PDF (e.g. "/_pdf/employee-handbook.pdf") */
  pdfUrl: string;

  /** Watermark options (handled by /api/pdf/wm) */
  watermarkText?: string;
  watermarkImageUrl?: string;
  wmSize?: number;
  wmOpacity?: number;
  wmRotationDeg?: number;

  /** Optional filename for manual download button */
  downloadFileName?: string;

  className?: string;
};

export default function SimplePdfModalTile({
  title = "PDF",
  description = "Open and read without leaving the app",
  pdfUrl,
  watermarkText = "CONFIDENTIAL • HRMO",
  watermarkImageUrl,
  wmSize = 320,
  wmOpacity = 0.12,
  wmRotationDeg = 30,
  downloadFileName = "document.pdf",
  className,
}: SimplePdfModalTileProps) {
  const [open, setOpen] = React.useState(false);
  const [pdfLoading, setPdfLoading] = React.useState(true);
  const [pdfError, setPdfError] = React.useState<string | null>(null);
  const loadingRef = React.useRef(pdfLoading);
  const fileParam = encodeURIComponent(pdfUrl); // e.g. '/_pdf/employee-handbook.pdf'
  const src = `/pdfjs-legacy/web/viewer.html?file=${fileParam}`;


  React.useEffect(() => {
    loadingRef.current = pdfLoading;
    if (!pdfLoading) setPdfError(null); // clear any old “still loading…” text
  }, [pdfLoading]);

  function needsPdfJsViewer() {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent;
    // iOS Safari, Samsung Internet, some mobile Chrome variants are unreliable
    return /iPhone|iPad|iPod|SamsungBrowser|FxiOS|CriOS/i.test(ua);
  }

  const [iframeSrc, setIframeSrc] = React.useState<string>("");



  // Build the viewer URL (server stamps watermark)
  const viewerUrl = React.useMemo(() => {
    const params = new URLSearchParams({
      file: pdfUrl,
      text: watermarkText ?? "",
      ...(watermarkImageUrl ? { img: watermarkImageUrl } : {}),
      size: String(wmSize ?? 320),
      opacity: String(wmOpacity ?? 0.12),
      rotate: String(wmRotationDeg ?? 30),
    });
    return `/api/pdf/wm?${params.toString()}`;
  }, [pdfUrl, watermarkText, watermarkImageUrl, wmSize, wmOpacity, wmRotationDeg]);

  const nativeUrl = viewerUrl; // your watermarked PDF
  const pdfJsUrl = React.useMemo(
    () => `/pdfjs-legacy/web/viewer.html?file=${encodeURIComponent(nativeUrl)}`,
    [nativeUrl]
  );

  const handleDownload = React.useCallback(() => {
    const a = document.createElement("a");
    a.href = viewerUrl;
    a.download = downloadFileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [viewerUrl, downloadFileName]);

  // when modal opens or URL changes, reset loading state
  React.useEffect(() => {
    if (!open) return;
    // try native first
    setIframeSrc(nativeUrl);
    setPdfLoading(true);
    loadingRef.current = true;

    // if the browser is known-problematic, or it still hasn't finished quickly,
    // swap to pdf.js viewer
    const swapFast = needsPdfJsViewer();
    const t = setTimeout(() => {
      if (loadingRef.current) {
        setIframeSrc(pdfJsUrl);
        // keep loader; pdf.js will trigger onLoad soon after
      }
    }, swapFast ? 100 : 1500); // Samsung/iOS: swap almost immediately

    return () => clearTimeout(t);
  }, [open, nativeUrl, pdfJsUrl]);

  async function ensurePdfJs() {
    // legacy build works best in Next.js
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf");
    // tell it where the worker is (you already have this path)
    (pdfjs as any).GlobalWorkerOptions.workerSrc = "/pdfjs-legacy/build/pdf.worker.min.js";
    return pdfjs;
  }
  function usePdfThumbnail(pdfUrl: string, targetWidth = 96) {
    const [thumb, setThumb] = React.useState<string | null>(null);
    const [thumbErr, setThumbErr] = React.useState<string | null>(null);

    React.useEffect(() => {
      let cancelled = false;

      async function run() {
        setThumb(null);
        setThumbErr(null);
        try {
          const pdfjs = await ensurePdfJs();
          const loadingTask = (pdfjs as any).getDocument({
            url: pdfUrl, // absolute or public path
            // safer defaults in Next/Edge:
            isEvalSupported: false,
            useWorkerFetch: true,
            useSystemFonts: true,
          });
          const pdf = await loadingTask.promise;
          const page = await pdf.getPage(1);

          const viewport = page.getViewport({ scale: 1 });
          const scale = targetWidth / viewport.width;
          const scaled = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d")!;
          canvas.width = Math.max(1, Math.floor(scaled.width));
          canvas.height = Math.max(1, Math.floor(scaled.height));

          // Render
          await page.render({ canvasContext: ctx, viewport: scaled }).promise;

          if (!cancelled) {
            setThumb(canvas.toDataURL("image/png"));
          }
        } catch (e: any) {
          if (!cancelled) setThumbErr(e?.message ?? "thumb-failed");
        }
      }
      run();

      return () => { cancelled = true; };
    }, [pdfUrl, targetWidth]);

    return { thumb, thumbErr };
  }


  const { thumb } = usePdfThumbnail(pdfUrl, 48); // 48–96 is good for the tile
  return (
  <Dialog open={open} onOpenChange={setOpen}>
  {/* TRIGGER TILE - GLASS OVERHAUL */}
  <DialogTrigger asChild>
    <button
      type="button"
      className="w-full rounded-[2rem] outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 group"
    >
      <Card
        className={cn(
          "relative flex items-center gap-4 rounded-[2rem] transition-all duration-300",
          "p-4 border-white/40 bg-white/40 backdrop-blur-md shadow-lg hover:shadow-xl hover:bg-white/60",
          "min-h-[112px]" 
        )}
      >
        {/* Thumbnail Squircle */}
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 overflow-hidden border border-white/20 shadow-inner">
          {thumb ? (
            <img
              src={thumb}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <FileText className="h-6 w-6 text-indigo-600" />
          )}
        </div>

        {/* Text Content */}
        <div className="min-w-0 flex-1 text-left">
          <div className="text-sm sm:text-base font-black text-slate-800 leading-tight uppercase tracking-tight">
            {title}
          </div>
          <div className="text-[11px] font-medium text-slate-500 leading-snug mt-1 line-clamp-2">
            {description}
          </div>
        </div>

        {/* Glass Button "Open" */}
        <div className="hidden sm:flex items-center justify-center h-8 px-3 rounded-xl bg-indigo-600/10 text-indigo-600 text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
          Open
        </div>
      </Card>
    </button>
  </DialogTrigger>

  {/* MODAL VIEWER - FROST GLASS OVERHAUL */}
  <DialogContent
    className={cn(
      "sm:max-w-5xl w-[calc(100vw-2rem)] p-0 gap-0 overflow-hidden",
      "bg-white/70 backdrop-blur-3xl border-white/40 rounded-[2.5rem] shadow-2xl"
    )}
  >
    <DialogHeader className="px-6 pt-6 pb-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-600 rounded-xl">
          <FileText className="h-4 w-4 text-white" />
        </div>
        <div>
          <DialogTitle className="text-sm font-black uppercase tracking-widest text-slate-800">
            {title}
          </DialogTitle>
          <DialogDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
            Internal Document Viewer
          </DialogDescription>
        </div>
      </div>
    </DialogHeader>

    {/* Controls Bar */}
    <div className="flex items-center justify-between px-6 pb-4 border-b border-white/20">
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100/50 px-3 py-1 rounded-full">
        Read-Only Mode
      </div>
      <Button 
        size="sm" 
        className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 text-[10px] font-black uppercase tracking-widest"
        onClick={handleDownload}
      >
        <Download className="mr-2 h-3.5 w-3.5" />
        Download PDF
      </Button>
    </div>

    {/* PDF Viewport */}
    <div className="h-[70vh] w-full bg-slate-900/5 relative">
      {pdfLoading && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-white/40 backdrop-blur-md">
          <div className="flex flex-col items-center gap-4">
            {/* Custom Spinner */}
            <div className="relative h-12 w-12">
               <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20" />
               <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
              Initializing Secure Viewer...
            </p>
          </div>
        </div>
      )}

      <iframe
        key={src}
        title={title}
        src={src}
        className="block h-full w-full border-0 brightness-[0.98] grayscale-[0.1]"
        onLoad={() => { setPdfLoading(false); loadingRef.current = false; }}
      />
    </div>
  </DialogContent>
</Dialog>


  );

}


