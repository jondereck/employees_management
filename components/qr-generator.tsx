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

  const [qrMeta, setQrMeta] = useState<{
    publicId: string;
    publicVersion: number;
  } | null>(
    publicId && publicVersion
      ? { publicId, publicVersion }
      : null
  );


  const baseUrl =
    process.env.NEXT_PUBLIC_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");
  const qrValue = qrMeta
    ? `${baseUrl}/view/employee/${employeeId}?pid=${qrMeta.publicId}&v=${qrMeta.publicVersion}`
    : "";

  useEffect(() => {
    if (publicId && publicVersion) {
      setQrMeta({ publicId, publicVersion });
    }
  }, [publicId, publicVersion]);







  const [isOpen, setIsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);




  const qrRef = useRef<HTMLCanvasElement | null>(null);

  // Filename rule: JDN + employeeNo(before comma) | fallback to employeeId
  const fileBaseName = useMemo(() => {
    const base = employeeNo
      ? employeeNo.split(",")[0].trim()
      : employeeId;
    return `JDN${base}`;
  }, [employeeNo, employeeId]);


  const router = useRouter();
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

      const data = await res.json();

      // ✅ IMMEDIATE, RELIABLE UPDATE
      setQrMeta({
        publicId: data.publicId,
        publicVersion: data.publicVersion,
      });

      toast.success("QR code regenerated");

      setConfirmOpen(false);
      setIsOpen(false);

      router.refresh();
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
    <div>
      <Dialog
        key={qrMeta?.publicVersion} // 🔥 FORCE REMOUNT
        open={isOpen}
        onOpenChange={setIsOpen}
      >
        <DialogTrigger asChild>
          <div className="cursor-pointer">
            {qrValue ? (
              <QRCodeCanvas
                value={qrValue}
                size={100}
                imageSettings={{
                  src: ImageLogo.src,
                  height: 20,
                  width: 20,
                  excavate: true,
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-6">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
    <p className="text-xs text-muted-foreground">Generating QR…</p>
  </div>
            )}
          </div>
        </DialogTrigger>

        <DialogPortal>
          <DialogContent className="fixed z-[9999] max-w-sm p-6">
            <DialogHeader>
              <DialogTitle className="text-center">
                Employee QR Code
              </DialogTitle>
              <DialogDescription className="text-center">
                Scan or share this QR code
              </DialogDescription>
            </DialogHeader>

            {qrValue && (
              <div className="flex justify-center py-6">
                <QRCodeCanvas
                  ref={qrRef}
                  value={qrValue}
                  size={size}
                  imageSettings={{
                    src: ImageLogo.src,
                    height: logoSize,
                    width: logoSize,
                    excavate: true,
                  }}
                />
              </div>
            )}

            <DialogFooter className="grid grid-cols-3 gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!qrValue}
                onClick={handleDownload}
              >
                <Download className="h-4 w-4" />
              </Button>

              <Button
                size="sm"
                variant="outline"
                disabled={!qrValue}
                onClick={handleCopyLink}
              >
                <Copy className="h-4 w-4" />
              </Button>

              <Button
                size="sm"
                variant="destructive"
                onClick={handleRegenerate}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
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
        description="This will invalidate ALL previously issued QR codes."
        confirmText="Yes, regenerate"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  );
};
