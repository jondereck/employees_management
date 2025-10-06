"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import type { Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Wand2, Loader2, Crosshair, Grid3x3,  } from "lucide-react";
import { toast } from "sonner";

// lazy client-only cropper
const Cropper: any = dynamic(() => import("react-easy-crop"), { ssr: false });

function addTransform(url: string, transform: string) {
  const marker = "/upload/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  return `${url.slice(0, idx + marker.length)}${transform}/${url.slice(idx + marker.length)}`;
}

function isCloudinaryUrl(u: string) {
  return /https?:\/\/res\.cloudinary\.com\/.+\/image\/upload\//.test(u);
}

type Props = {
  open: boolean;
  initialUrl: string;               // Cloudinary/remote url to start with
  onCancel: () => void;
  onDone: (finalUrl: string) => void; // Return cropped (and/or BG-removed) url
};

export default function EditImageModal({ open, initialUrl, onCancel, onDone }: Props) {
  const [targetUrl, setTargetUrl] = useState<string>(initialUrl);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showGrid, setShowGrid] = useState(true);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mediaSize, setMediaSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    // any time the incoming initialUrl changes (new file/upload), reset state
    setTargetUrl(initialUrl);
    setZoom(1);
    setCrop({ x: 0, y: 0 });
    setCroppedAreaPixels(null);
  }, [initialUrl, open]);

  // re-center helper
  function autoCenter() {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }

  // optional: center & fit (cover square)
  function centerAndFit() {
    setCrop({ x: 0, y: 0 });
    if (!containerRef.current || !mediaSize) { setZoom(1); return; }
    const rect = containerRef.current.getBoundingClientRect();
    const viewport = Math.min(rect.width, rect.height);
    const { width: mw, height: mh } = mediaSize;
    const zoomNeeded = Math.max(viewport / mw, viewport / mh);
    setZoom(zoomNeeded);
  }

  async function removeBgInModal() {
    try {
      setIsProcessing(true);
      const res = await fetch("/api/tools/rembg", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: targetUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Background removal failed");
      setTargetUrl(data.url); // Cloudinary url
      setZoom(1);
      setCrop({ x: 0, y: 0 });
      setCroppedAreaPixels(null);
      toast.success("Background removed", { description: "Preview updated." });
    } catch (e: any) {
      toast.error("Background removal failed", { description: e?.message ?? "Please try again." });
    } finally {
      setIsProcessing(false);
    }
  }

  function applyCrop() {
    if (!croppedAreaPixels || !targetUrl) return;

    if (!isCloudinaryUrl(targetUrl)) {
      toast.message("Applied without crop", {
        description: "Final image isn’t Cloudinary-hosted; returning wand result.",
      });
      onDone(targetUrl);
      return;
    }

    const { x, y, width, height } = croppedAreaPixels;
    const tx = [
      `c_crop,x_${Math.round(x)},y_${Math.round(y)},w_${Math.round(width)},h_${Math.round(height)}`,
      "c_thumb,w_700,h_700",
      "f_png,q_auto",
    ].join("/");

    const finalUrl = addTransform(targetUrl, tx);
    onDone(finalUrl);
    toast.success("Crop applied");
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-[92vw] sm:max-w-[640px] rounded-xl bg-white shadow-xl">
        <div ref={containerRef} className="relative h-[60vh] max-h-[560px] w-full">
          <Cropper
            key={targetUrl}
            image={targetUrl}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_c: Area, p: Area) => setCroppedAreaPixels(p)}
            onMediaLoaded={({ naturalWidth, naturalHeight }: any) =>
              setMediaSize({ width: naturalWidth, height: naturalHeight })
            }
            showGrid={showGrid}
            restrictPosition
          />
        </div>

        <div className="flex flex-col gap-3 p-3">
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full"
          />

          <div className="flex items-center justify-between gap-2">
            <div className="min-h-[28px] text-sm text-muted-foreground">
              {isProcessing && (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing…
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setShowGrid(v => !v)} disabled={isProcessing}>
                <Grid3x3 className="mr-2 h-4 w-4" />
                {showGrid ? "Hide Grid" : "Show Grid"}
              </Button>
              <Button variant="secondary" onClick={autoCenter} disabled={isProcessing} title="Center">
                <Crosshair className="mr-2 h-4 w-4" /> Center
              </Button>
              <Button variant="secondary" onClick={centerAndFit} disabled={isProcessing} title="Center & fit">
                <Crosshair className="mr-2 h-4 w-4" /> Center & Fit
              </Button>
              <Button variant="secondary" onClick={removeBgInModal} disabled={isProcessing}>
                <Wand2 className="mr-2 h-4 w-4" /> Remove BG
              </Button>
              <Button onClick={applyCrop} disabled={isProcessing}>Apply</Button>
              <Button variant="secondary" onClick={onCancel} disabled={isProcessing}>Cancel</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
