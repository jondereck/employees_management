"use client";

import { useEffect, useState } from "react";
import { Button } from "./button";
import { ImagePlus, Trash, Crosshair, Wand2, Pencil, Grid3x3, Loader2, X } from "lucide-react";
import Image from "next/image";
import { CldUploadWidget, type CldUploadWidgetResults } from "next-cloudinary";
import dynamic from "next/dynamic";
import type { Area } from "react-easy-crop";
import { toast } from "sonner";
import { cn } from "@/lib/utils"; // Ensure you have this utility or replace with standard template literals

// Lazy client-only cropper
const Cropper: any = dynamic(() => import("react-easy-crop"), { ssr: false });

interface ImageUploadProps {
  disabled?: boolean;
  onChange: (value: string) => void;
  onRemove: (value: string) => void;
  value: string[];
  gender?: "Male" | "Female";
}

const BACKDROP_SRC = "/bday_bg.png";

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

  // Crop modal state
  const [isCropping, setIsCropping] = useState(false);
  const [targetUrl, setTargetUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [editingOriginalUrl, setEditingOriginalUrl] = useState<string | null>(null);

  useEffect(() => setIsMounted(true), []);

  useEffect(() => {
    if (!isCropping) return;
    setZoom(1);
    setCrop({ x: 0, y: 0 });
    setCroppedAreaPixels(null);
  }, [targetUrl, isCropping]);

  if (!isMounted) return null;

  const placeholderSrc =
    gender === "Female" ? "/female_placeholder.png" :
    gender === "Male" ? "/male_placeholder.png" :
    null;

  const showPlaceholder = value.length === 0 && !!placeholderSrc;

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

      setTargetUrl(data.url);
      if (editingOriginalUrl) onRemove(editingOriginalUrl);
      onChange(data.url);

      toast.success("Background removed", { id: toastId });
      setIsCropping(false);
    } catch (err: any) {
      toast.error("Error", { id: toastId, description: err?.message });
    } finally {
      setIsProcessing(false);
    }
  }

  function openCropper(url: string, mode: "edit" | "add" = "edit") {
    setEditingOriginalUrl(mode === "edit" ? url : null);
    setTargetUrl(url);
    setIsCropping(true);
  }

  function autoCenter() {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    toast.message("Centered");
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
    if (editingOriginalUrl) onRemove(editingOriginalUrl);
    onChange(finalUrl);
    toast.success("Image updated");
    setIsCropping(false);
  }

  return (
    <div className="flex flex-col items-center w-full">
      {/* 1. Image Preview Section */}
      {!isCropping && (
        <div className="mb-6 flex flex-col items-center justify-center w-full">
          {value.length > 0 ? (
            value.map((url) => (
              <div key={url} className="relative group">
                <div className="relative h-[240px] w-[240px] overflow-hidden rounded-2xl shadow-xl bg-white ring-4 ring-background transition-transform duration-300 group-hover:scale-[1.02]">
                  <Image
                    src={BACKDROP_SRC}
                    alt="Backdrop"
                    fill
                    className="object-cover"
                    priority
                  />
                  <div className="absolute inset-0 flex items-end justify-center">
                    <Image
                      src={url}
                      alt="Employee"
                      fill
                      className="object-contain object-bottom drop-shadow-2xl"
                    />
                  </div>
                </div>

                {/* Floating Actions */}
                <div className="absolute right-3 top-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-x-2 group-hover:translate-x-0">
                  <Button 
                    size="icon" 
                    variant="secondary"
                    className="h-8 w-8 shadow-lg"
                    onClick={() => openCropper(url)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="destructive"
                    className="h-8 w-8 shadow-lg"
                    onClick={() => onRemove(url)}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : showPlaceholder ? (
            <div className="relative h-[240px] w-[240px] rounded-2xl bg-muted/20 overflow-hidden border-2 border-dashed border-muted-foreground/10">
              <Image
                src={BACKDROP_SRC}
                alt="Backdrop"
                fill
                className="object-cover opacity-30 grayscale"
              />
              <div className="absolute inset-0 flex items-end justify-center">
                <Image
                  src={placeholderSrc!}
                  alt="placeholder"
                  width={210}
                  height={210}
                  className="opacity-20 grayscale transition-opacity group-hover:opacity-30"
                />
              </div>
            </div>
          ) : (
            <div className="flex h-[240px] w-[240px] items-center justify-center rounded-2xl border-2 border-dashed bg-secondary/5 text-xs text-muted-foreground/50 font-medium italic">
              No image uploaded
            </div>
          )}
          
          {/* Static Identity Label */}
          <div className="mt-4 text-center">
            <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground/40 italic">
              Primary Identity
            </p>
            <h3 className="text-xs font-bold text-muted-foreground mt-1">Employee Photo</h3>
          </div>
        </div>
      )}

      {/* 2. Centered Upload Button */}
      {!isCropping && (
        <CldUploadWidget
          uploadPreset="evo6spz1"
          onUpload={(res: CldUploadWidgetResults) => {
            if (res?.event === "success" && res.info && typeof res.info === "object") {
              const raw = (res.info as any).secure_url;
              if (raw) {
                value.forEach((url) => onRemove(url));
                openCropper(raw, "add");
              }
            }
          }}
        >
          {({ open }) => (
            <Button
              type="button"
              disabled={disabled}
              onClick={() => open()}
              variant="outline"
              className="w-[180px] h-10 shadow-sm border-primary/10 hover:bg-primary/5 hover:text-primary transition-all rounded-xl font-semibold"
            >
              <ImagePlus className="mr-2 h-4 w-4 text-primary" />
              Upload Photo
            </Button>
          )}
        </CldUploadWidget>
      )}

      {/* 3. Refined Crop Modal */}
      {isCropping && targetUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-[640px] rounded-3xl bg-background shadow-2xl overflow-hidden border border-border/50">
            {/* Modal Header */}
            <div className="p-4 border-b flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Wand2 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Refine Photo</h3>
                  <p className="text-[10px] text-muted-foreground">Crop and enhance your identity photo</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full" 
                onClick={() => setIsCropping(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Cropper Workspace */}
            <div className="relative h-[50vh] max-h-[500px] w-full bg-neutral-900">
              <Cropper
                image={targetUrl}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_c: Area, p: Area) => setCroppedAreaPixels(p)}
                showGrid={showGrid}
              />
            </div>

            {/* Controls Workspace */}
            <div className="p-6 space-y-6 bg-background">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
                  <span>Zoom Level</span>
                  <span>{Math.round(zoom * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-9 px-3 text-[11px] font-bold uppercase"
                    onClick={() => setShowGrid(!showGrid)}
                  >
                    <Grid3x3 className="mr-2 h-3.5 w-3.5" />
                    Grid
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-9 px-3 text-[11px] font-bold uppercase"
                    onClick={autoCenter}
                  >
                    <Crosshair className="mr-2 h-3.5 w-3.5" />
                    Center
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 px-3 text-[11px] font-bold uppercase border-primary/20 hover:bg-primary/5 text-primary"
                    onClick={removeBgInModal}
                    disabled={isProcessing}
                  >
                    {isProcessing ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-2 h-3.5 w-3.5" />}
                    Remove BG
                  </Button>
                  <Button 
                    size="sm" 
                    className="h-9 px-5 text-[11px] font-bold uppercase shadow-lg shadow-primary/20"
                    onClick={applyCrop}
                    disabled={isProcessing}
                  >
                    Save Changes
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