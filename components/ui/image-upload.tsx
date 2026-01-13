"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./button";
import { ImagePlus, Trash, Crosshair, Wand2, Loader2, Pencil, Grid3x3 } from "lucide-react";
import Image from "next/image";
import { CldUploadWidget, type CldUploadWidgetResults } from "next-cloudinary";
import dynamic from "next/dynamic";
import type { Area } from "react-easy-crop";
import { toast } from "sonner";

// lazy client-only cropper
const Cropper: any = dynamic(() => import("react-easy-crop"), { ssr: false });

interface ImageUploadProps {
  disabled?: boolean;
  onChange: (value: string) => void; // parent decides to push/replace
  onRemove: (value: string) => void;
  value: string[];
  gender?: "Male" | "Female";
}

const BACKDROP_SRC = "/bday_bg.png";

/** Insert a Cloudinary transformation step into a secure_url */
function addTransform(url: string, transform: string) {
  const marker = "/upload/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  return `${url.slice(0, idx + marker.length)}${transform}/${url.slice(idx + marker.length)}`;
}

export default function ImageUpload({
  disabled,
  onChange,
  onRemove,
  value,
  gender,
}: ImageUploadProps) {
  const [isMounted, setIsMounted] = useState(false);

  // crop modal state
  const [isCropping, setIsCropping] = useState(false);
  const [targetUrl, setTargetUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const [isProcessing, setIsProcessing] = useState(false); // for the wand inside modal


  const [showGrid, setShowGrid] = useState(true);

  // are we editing an existing card, or adding a brand-new photo?
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingOriginalUrl, setEditingOriginalUrl] = useState<string | null>(null); // you may already have this from earlier fix


  function isCloudinaryUrl(u: string) {
    return /res\.cloudinary\.com\/.+\/image\/upload\//.test(u);
  }

  // under other useState hooks
  async function removeBgInModal() {
    if (!targetUrl) return;

    const toastId = toast.loading("Removing background...");

    try {
      setIsProcessing(true);

      const res = await fetch("/api/tools/rembg", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: targetUrl }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Background removal failed");

      // 🔁 Replace preview
      setTargetUrl(data.url);

      // 🔁 Replace existing image
      if (editingOriginalUrl) onRemove(editingOriginalUrl);
      onChange(data.url);

      toast.success("Background removed", {
        id: toastId,
        description: "Image updated",
      });

      // ✅ AUTO-CLOSE MODAL AFTER DONE
      setIsCropping(false);
      setIsAddingNew(false);
      setEditingOriginalUrl(null);

    } catch (err: any) {
      toast.error("Background removal failed", {
        id: toastId,
        description: err?.message ?? "Please try again.",
      });
    } finally {
      setIsProcessing(false);
    }
  }




  useEffect(() => {
    if (!isCropping) return;
    // reset crop state for the new image
    setZoom(1);
    setCrop({ x: 0, y: 0 });
    setCroppedAreaPixels(null);
  }, [targetUrl, isCropping]);

  useEffect(() => setIsMounted(true), []);
  if (!isMounted) return null;

  const placeholderSrc =
    gender === "Female" ? "/female_placeholder.png" :
      gender === "Male" ? "/male_placeholder.png" :
        null;



  const showPlaceholder = value.length === 0 && !!placeholderSrc;

  function openCropper(url: string, mode: "edit" | "add" = "edit") {
    if (mode === "edit") {
      setEditingOriginalUrl(url);      // we’ll replace this on Apply
      setIsAddingNew(false);
    } else {
      setEditingOriginalUrl(null);     // nothing to replace, we’ll add on Apply
      setIsAddingNew(true);
    }
    setTargetUrl(url);
    setZoom(1);
    setCrop({ x: 0, y: 0 });
    setCroppedAreaPixels(null);
    setIsCropping(true);
  }

  function autoCenter() {
    // center the image in the frame and reset zoom
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    // optional toast if you’re using Sonner:
    toast.message("Centered", { description: "Crop area reset to center." });
  }

  function applyCrop() {
    if (!targetUrl || !croppedAreaPixels) return;

    const { x, y, width, height } = croppedAreaPixels;
    const cropTx = [
      `c_crop,x_${Math.round(x)},y_${Math.round(y)},w_${Math.round(width)},h_${Math.round(height)}`,
      "c_thumb,w_700,h_700",
      "f_png,q_auto",
    ].join("/");

    const finalUrl = addTransform(targetUrl, cropTx);

    // 🔁 REMOVE OLD IMAGE IF EDITING OR RE-UPLOADING
    if (editingOriginalUrl) onRemove(editingOriginalUrl);

    onChange(finalUrl);

    toast.success("Image updated");

    // ✅ CLOSE MODAL
    setIsCropping(false);
    setIsAddingNew(false);
    setEditingOriginalUrl(null);
  }


  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        {value.length > 0 ? (
          value.map((url) => (
            <div key={url} className="relative">
              {/* Card with backdrop */}
              <div className="relative h-[240px] w-[240px] overflow-hidden rounded-xl shadow-sm ring-1 ring-black/5 bg-white">
                <Image
                  src={BACKDROP_SRC}
                  alt="Backdrop"
                  fill
                  sizes="240px"
                  className="object-cover"
                  priority
                />

                {/* Cut-out pinned to bottom, no gap */}
                <div className="absolute inset-0 flex items-end justify-center">
                  <Image
                    src={url}
                    alt="Employee cut-out"
                    fill
                    className="object-contain object-bottom drop-shadow-[0_10px_20px_rgba(0,0,0,0.35)]"
                    priority
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="absolute right-2 top-2 z-10 flex gap-2">
                {/* Edit (opens modal for crop/remove-bg) */}
                <Button
                  type="button"
                  onClick={() => openCropper(url)}
                  variant="secondary"
                  size="icon"
                  disabled={disabled}
                  title="Edit (crop / remove background)"
                >
                  <Pencil className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  onClick={() => onRemove(url)}
                  variant="destructive"
                  size="icon"
                  disabled={disabled}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </div>



            </div>
          ))
        ) : showPlaceholder ? (
          <div className="relative h-[240px] w-[240px] overflow-hidden rounded-xl shadow-sm ring-1 ring-black/5">
            <Image src={BACKDROP_SRC} alt="Backdrop" fill sizes="240px" className="object-cover" />
            <div className="absolute inset-0 flex items-end justify-center">
              <Image
                src={placeholderSrc!}
                alt={`${gender} placeholder`}
                width={210}
                height={210}
                className="h-[210px] w-[210px] object-contain opacity-70"
                priority
              />
            </div>
          </div>
        ) : (
          <div className="flex h-[240px] w-[240px] items-center justify-center rounded-xl border text-xs text-muted-foreground">
            No image yet
          </div>
        )}
      </div>

      {/* Upload widget (still allows new uploads with manual crop) */}
      <CldUploadWidget
        uploadPreset="evo6spz1"
        options={{
          multiple: false,
          cropping: false,                // ✅ disable Cloudinary’s crop UI
          sources: ["local", "url", "camera"],
          resourceType: "image",
          showAdvancedOptions: false,     // (optional) hide Cloudinary edit tools
        }}
        onUpload={(res: CldUploadWidgetResults) => {
          if (res?.event === "success" && res.info && typeof res.info === "object") {
            const raw = (res.info as any).secure_url as string | undefined;
            if (raw) {
              // 🧹 REMOVE OLD IMAGE FIRST
              if (value.length > 0) {
                value.forEach((url) => onRemove(url));
              }

              // 🔁 Open cropper as ADD (fresh image)
              openCropper(raw, "add");
            }
          }
        }}

        onError={(err) => console.error("Cloudinary upload error:", err)}
      >
        {({ open }) => (
          <Button type="button" onClick={() => open()} disabled={disabled} variant="secondary">
            <ImagePlus className="mr-2 h-4 w-4" />
            Upload & Crop
          </Button>
        )}
      </CldUploadWidget>

      {/* Crop Modal */}
      {isCropping && targetUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-[92vw] sm:max-w-[640px] rounded-xl bg-white shadow-xl">
            <div className="relative h-[60vh] max-h-[560px] w-full">
              <Cropper
                key={targetUrl}                 // <-- force re-mount on URL change
                image={targetUrl}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_c: Area, p: Area) => setCroppedAreaPixels(p)}
                showGrid={showGrid}
                restrictPosition={true}
              />

            </div>

            <div className="flex flex-col gap-3 p-3">
              {/* Zoom slider */}
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
                {/* Left: processing indicator if needed */}


                {/* Right: controls */}
                <div className="flex gap-2">

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowGrid((v) => !v)}
                    disabled={isProcessing}
                    title={showGrid ? "Hide grid" : "Show grid"}
                  >
                    <Grid3x3 className="mr-2 h-4 w-4" />
                    {showGrid ? "Hide Grid" : "Show Grid"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={autoCenter}
                    disabled={isProcessing}
                    title="Auto-center"
                  >
                    <Crosshair className="mr-2 h-4 w-4" />
                    Center
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={removeBgInModal}
                    disabled={isProcessing}
                    title="Remove background"
                  >
                    <Wand2 className="mr-2 h-4 w-4" />
                    Remove BG
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setIsCropping(false);
                      setIsAddingNew(false);       // reset mode if the user cancels a new upload
                      setEditingOriginalUrl(null);
                    }}
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>


                  <Button onClick={applyCrop} disabled={isProcessing}>
                    Apply Changes
                  </Button>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
