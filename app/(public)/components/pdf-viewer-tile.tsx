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


React.useEffect(() => {
  loadingRef.current = pdfLoading;
  if (!pdfLoading) setPdfError(null); // clear any old “still loading…” text
}, [pdfLoading]);

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

  setPdfLoading(true);
  loadingRef.current = true;
  setPdfError(null);

  const id = setTimeout(() => {
    // only show the hint if we're STILL loading at 10s
    if (loadingRef.current) {
      setPdfError("Still loading… your network might be slow.");
    }
  }, 10000);

  return () => clearTimeout(id);
}, [open, viewerUrl]);


  return (



      <Dialog open={open} onOpenChange={setOpen}>

        {/* Trigger tile — equal height & consistent icon */}
        <DialogTrigger asChild>
    <button
      type="button"
      className="w-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
    >
      <Card
        className={cn(
          "group relative flex items-center gap-3 sm:gap-4 rounded-xl border transition hover:shadow-md",
          "p-3 sm:p-4",
          "min-h-[100px] sm:min-h-[112px]" // consistent but compact
        )}
      >
        <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg bg-muted">
          <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-foreground/70" />
        </div>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="text-sm sm:text-base font-semibold leading-tight">{title}</div>
          <div className="text-xs sm:text-sm text-muted-foreground leading-snug">{description}</div>
        </div>
        <div className="ml-auto hidden sm:block text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition">
          Open
        </div>
      </Card>
    </button>
  </DialogTrigger>

        {/* Simple modal viewer — background remains visible behind it */}
        <DialogContent
          className={cn(
            // wide but not full; keep backdrop visible
            "sm:max-w-4xl w-[calc(100vw-2rem)] p-0 overflow-hidden",
            // remove default gaps so iframe can fill
            "gap-0"
          )}
        >
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="text-base">{title}</DialogTitle>
            <DialogDescription className="sr-only">View {title} inside the app</DialogDescription>
          </DialogHeader>

          {/* Small top bar inside modal (download optional) */}
          <div className="flex items-center justify-between px-4 pb-3">
            <div className="text-xs text-muted-foreground">Read & download</div>
            <Button size="sm" variant="outline" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>

          <div className="h-[75vh] w-full bg-muted/20">
            {/* Loader overlay */}
            {pdfLoading && (
              <div
                className="absolute inset-0 z-10 grid place-items-center bg-background/50 backdrop-blur-[1px]"
                aria-live="polite"
                aria-busy="true"
              >
                <div className="flex flex-col items-center gap-3">
                  {/* spinner */}
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
                  {/* indeterminate bar */}
                  <div className="relative h-1 w-64 overflow-hidden rounded-full bg-muted">
                    <div className="absolute inset-y-0 left-0 w-1/3 animate-[loader_1.2s_infinite_linear] rounded-full bg-primary" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Loading {title}…{pdfError ? <span className="ml-1 text-foreground/70">{pdfError}</span> : null}
                  </p>
                  <a
                    href={viewerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline text-primary hover:opacity-80"
                  >
                    Open in a new tab instead
                  </a>
                </div>
              </div>
            )}

            {/* PDF viewport */}

       <iframe
  key={viewerUrl}
  title={title}
  src={viewerUrl}
  className="block h-full w-full border-0"
  onLoad={() => { setPdfLoading(false); loadingRef.current = false; }}
  onError={() => {
    setPdfLoading(false);
    loadingRef.current = false;
    setPdfError("Failed to load PDF.");
  }}
/>


            <style jsx>{`
  @keyframes loader {
    0% { transform: translateX(-100%); }
    50% { transform: translateX(30%); }
    100% { transform: translateX(100%); }
  }
`}</style>
          </div>
        </DialogContent>
      </Dialog>


  );

}


