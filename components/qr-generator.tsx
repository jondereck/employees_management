"use client";

import { useRef, useState, useMemo } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import ImageLogo from "@/public/icon-192x192.png"; // local asset (same-origin)
import { toast } from "sonner";

interface QrCodeGeneratorProps {
  departmentId: string;
  employeeId: string;
  /** Optional: para ma-apply ang JDN + truncate-before-comma filename rule */
  employeeNo?: string | null;
  /** Optional: QR size in px (canvas). Default 200 (modal), 100 (trigger) */
  size?: number;
}

export const QrCodeGenerator: React.FC<QrCodeGeneratorProps> = ({
  departmentId,
  employeeId,
  employeeNo,
  size = 200,
}) => {

  const baseUrl =
    process.env.NEXT_PUBLIC_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");
  const qrValue = `${baseUrl}/view/employee/${employeeId}`;


  const [isOpen, setIsOpen] = useState(false);
  const qrRef = useRef<HTMLCanvasElement | null>(null);

  // Filename rule: JDN + employeeNo(before comma) | fallback to employeeId
  const fileBaseName = useMemo(() => {
    const base = employeeNo
      ? employeeNo.split(",")[0].trim()
      : employeeId;
    return `JDN${base}`;
  }, [employeeNo, employeeId]);

  const handleOpen = () => setIsOpen(true);

  const handleDownload = () => {
    const canvas = qrRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileBaseName}.png`;
    link.click();
    toast.success(`QR Code for ${fileBaseName}.png downloaded!`);
  };


  const handlePrint = () => {
    const canvas = qrRef.current;
    if (!canvas) return;
    const imgData = canvas.toDataURL("image/png");
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(
        `<img src="${imgData}" onload="window.print(); window.close();" />`
      );
      w.document.close();
    }
  };



  // NEW: copy link to clipboard (with fallback)
  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(qrValue);
      } else {
        const ta = document.createElement("textarea");
        ta.value = qrValue;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast.success("Profile link copied!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  // Logo size ~20% ng QR (pareho sa bulk exporter)
  const logoSize = Math.round(size * 0.2);

  return (
    <div className="hidden md:block">
      {/* Small preview (click to enlarge) */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <div
            className="my-4 flex flex-col items-start space-y-2 cursor-pointer"
            onClick={handleOpen}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && handleOpen()}
            title="Click to enlarge"
          >
            <QRCodeCanvas
              value={qrValue}
              size={100}
              // embed center icon for preview as well
              imageSettings={{
                src: ImageLogo.src,
                height: Math.round(100 * 0.2),
                width: Math.round(100 * 0.2),
                excavate: true, // clears modules under the image for better contrast
              }}
            />
          </div>
        </DialogTrigger>

        {/* Modal */}
        <DialogContent className="w-full max-w-sm p-6">
          <DialogHeader>
            <DialogTitle className="text-center">Employee QR Code</DialogTitle>
            <DialogDescription className="text-center text-muted-foreground">
              Scan the QR code or download/print it.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-center items-center py-6">
            <QRCodeCanvas
              value={qrValue}
              size={size}
              ref={qrRef}
              // center logo (same-origin image; won’t taint canvas)
              imageSettings={{
                src: ImageLogo.src,
                height: logoSize,
                width: logoSize,
                excavate: true,
              }}
            // You can tweak errorCorrectionLevel if needed
            // level="H"
            // includeMargin
            />
          </div>
          {/* Link + Copy (no overlap, truncates nicely) */}
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <input
                  readOnly
                  value={qrValue}
                  className="w-full rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground truncate"
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label="Public profile link"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={handleCopyLink}
              >
                Copy link
              </Button>
            </div>
          </div>


          <DialogFooter className="flex justify-between items-center mt-4">
            <Button variant="outline" onClick={handleDownload}>⬇️ Download</Button>
            <Button variant="outline" onClick={handlePrint}>🖨️ Print</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
