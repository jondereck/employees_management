"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogPortal
} from "@/components/ui/dialog";
import ImageLogo from "@/public/icon-192x192.png"; // local asset (same-origin)
import { toast } from "sonner";

import axios from "axios";
import { useRouter } from "next/navigation";
import { Copy, Download, Printer, RotateCcw } from "lucide-react";
import { AlertModal } from "./modals/alert-modal";


interface QrCodeGeneratorProps {
  departmentId: string;
  employeeId: string;
  /** Optional: para ma-apply ang JDN + truncate-before-comma filename rule */
  employeeNo?: string | null;
  /** Optional: QR size in px (canvas). Default 200 (modal), 100 (trigger) */
  size?: number;
  publicId: string;
  publicVersion: number;
  publicEnabled: boolean;
}

export const QrCodeGenerator: React.FC<QrCodeGeneratorProps> = ({
  departmentId,
  employeeId,
  employeeNo,
  size = 200,
  publicId,
  publicVersion,
  publicEnabled
}) => {

  console.log("QrCodeGenerator props:", {
    publicId,
    publicVersion,
    publicEnabled,
  });

  const [qrData, setQrData] = useState({
    publicId,
    publicVersion,
  });


  const baseUrl =
    process.env.NEXT_PUBLIC_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");
  const qrValue =
    `${baseUrl}/view/employee/${employeeId}` +
    `?pid=${qrData.publicId}&v=${qrData.publicVersion}`;


  const router = useRouter();



  const [isOpen, setIsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);



  useEffect(() => {
    if (publicId && publicVersion) {
      setQrData({ publicId, publicVersion });
    }
  }, [publicId, publicVersion]);


  const qrRef = useRef<HTMLCanvasElement | null>(null);

  // Filename rule: JDN + employeeNo(before comma) | fallback to employeeId
  const fileBaseName = useMemo(() => {
    const base = employeeNo
      ? employeeNo.split(",")[0].trim()
      : employeeId;
    return `JDN${base}`;
  }, [employeeNo, employeeId]);



  const handleRegenerate = () => {
    setConfirmOpen(true);
  };

  const handleConfirmRegenerate = async () => {
    try {
      setLoading(true);

      const res = await fetch(
        `/api/${departmentId}/employees/${employeeId}/regenerate-qr`,
        { method: "POST" }
      );

      if (!res.ok) throw new Error("Failed");

      const updated = await res.json();

      // ✅ UPDATE LOCAL STATE
      setQrData({
        publicId: updated.publicId,
        publicVersion: updated.publicVersion,
      });

      toast.success("QR code regenerated");
      setConfirmOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to regenerate QR");
    } finally {
      setLoading(false);
    }
  };



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
    <div className="">
      {/* Small preview (click to enlarge) */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <div
            className="my-4 flex flex-col items-start space-y-2 cursor-pointer"
            role="button"
            tabIndex={0}
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
        <DialogPortal>
          <DialogContent className="fixed z-[9999] w-full max-w-sm p-6">
            <DialogHeader>
              <DialogTitle className="text-center">
                Employee QR Code
              </DialogTitle>
              <DialogDescription className="text-center text-muted-foreground">
                Scan the QR code or download/print it.
              </DialogDescription>
            </DialogHeader>

            <div className="flex justify-center items-center py-6">
              <QRCodeCanvas
                value={qrValue}
                size={size}
                ref={qrRef}
                imageSettings={{
                  src: ImageLogo.src,
                  height: logoSize,
                  width: logoSize,
                  excavate: true,
                }}
              />
            </div>

            <DialogFooter className="mt-6 space-y-3">
              {/* Secondary actions */}
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Download className="h-4 w-4" />

                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Copy className="h-4 w-4" />

                </Button>


                {/* Destructive action */}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleRegenerate}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />

                </Button>
              </div>
            </DialogFooter>


          </DialogContent>
        </DialogPortal>

      </Dialog>

      <AlertModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmRegenerate}
        loading={loading}
        title="Regenerate QR Code?"
        description="This will invalidate ALL previously issued QR codes for this employee. Any printed or shared QR codes will stop working."
        confirmText="Yes, regenerate"
        cancelText="Cancel"
        variant="destructive"
      />

    </div>
  );
};
