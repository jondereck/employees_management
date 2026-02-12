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
  DialogPortal,
  DialogOverlay
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
    key={qrMeta?.publicVersion}
    open={isOpen}
    onOpenChange={setIsOpen}
  >
    <DialogTrigger asChild>
      <div className="group relative cursor-pointer overflow-hidden rounded-xl border border-white/20 bg-white/5 p-2 transition-all hover:bg-white/10 active:scale-95">
        {qrValue ? (
          <QRCodeCanvas
            value={qrValue}
            size={100}
            className="rounded-lg opacity-80 transition-opacity group-hover:opacity-100"
            imageSettings={{
              src: ImageLogo.src,
              height: 20,
              width: 20,
              excavate: true,
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-6 min-w-[100px]">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
          </div>
        )}
      </div>
    </DialogTrigger>

    <DialogPortal>
      {/* Immersive Blur Overlay */}
      <DialogOverlay className="bg-black/40 backdrop-blur-md" />
      
   <DialogContent className="
  fixed z-[9999] max-w-md 
  border border-white/30
  bg-gradient-to-b from-white/30 to-white/10
  p-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.45)]
  backdrop-blur-3xl
  sm:rounded-[2rem]
  
">

        <DialogHeader className="space-y-3">
        <DialogTitle className="text-center text-2xl font-bold tracking-tight text-slate-900 drop-shadow-sm">

            Employee QR Code
          </DialogTitle>
         <DialogDescription className="text-center text-slate-700">

            Scan for instant verification or share the profile link.
          </DialogDescription>
        </DialogHeader>

        {qrValue && (
          <div className="relative flex justify-center py-10">
            {/* Ambient Glow behind QR */}
            <div className="absolute inset-0 m-auto h-40 w-40 rounded-full bg-white/20 blur-[60px]" />
            
            <div className="relative rounded-3xl bg-white p-6 shadow-2xl">
              <QRCodeCanvas
                ref={qrRef}
                value={qrValue}
                size={240} // Increased size
                imageSettings={{
                  src: ImageLogo.src,
                  height: 48, // Bigger logo
                  width: 48,
                  excavate: true,
                }}
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-row items-center justify-center gap-3 sm:justify-center">
          <Button
            size="lg"
            variant="ghost"
         className="h-12 w-12 rounded-full border border-white/40 bg-white/30 text-slate-800 hover:bg-white/50 shadow-sm"

            disabled={!qrValue}
            onClick={handleDownload}
          >
            <Download className="h-5 w-5" />
          </Button>

          <Button
            size="lg"
            variant="ghost"
          className="h-12 w-12 rounded-full border border-white/40 bg-white/30 text-slate-800 hover:bg-white/50 shadow-sm"

            disabled={!qrValue}
            onClick={handleCopyLink}
          >
            <Copy className="h-5 w-5" />
          </Button>

          <Button
            size="lg"
            variant="ghost"
            className="h-12 w-12 rounded-full border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300"
            onClick={handleRegenerate}
          >
            <RotateCcw className="h-5 w-5" />
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
