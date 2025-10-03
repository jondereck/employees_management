"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./button";
import { ImagePlus, Trash, Crop as CropIcon } from "lucide-react";
import Image from "next/image";
import { CldUploadWidget, type CldUploadWidgetResults } from "next-cloudinary";
import dynamic from "next/dynamic";
import type { Area } from "react-easy-crop";

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

  useEffect(() => setIsMounted(true), []);
  if (!isMounted) return null;

  const placeholderSrc =
    gender === "Female" ? "/female_placeholder.png" :
    gender === "Male"   ? "/male_placeholder.png"   :
    null;

  const showPlaceholder = value.length === 0 && !!placeholderSrc;

  function openCropper(url: string) {
    setTargetUrl(url);
    setZoom(1);
    setCrop({ x: 0, y: 0 });
    setIsCropping(true);
  }

function applyCrop() {
  if (!targetUrl || !croppedAreaPixels) return;

  const { x, y, width, height } = croppedAreaPixels;

  // Build Cloudinary crop transform with *absolute pixels*
  const cropTx = [
    `c_crop,x_${Math.round(x)},y_${Math.round(y)},w_${Math.round(width)},h_${Math.round(height)}`,
    "c_thumb,w_700,h_700", // resize to square after crop
    "f_png,q_auto"
  ].join("/");

  const newUrl = addTransform(targetUrl, cropTx);
  onChange(newUrl);
  setIsCropping(false);
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
                {/* Crop existing photo */}
                <Button
                  type="button"
                  onClick={() => openCropper(url)}
                  variant="secondary"
                  size="icon"
                  disabled={disabled}
                  title="Crop existing image"
                >
                  <CropIcon className="h-4 w-4" />
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
        options={{ multiple: false, cropping: true }}
        onUpload={(res: CldUploadWidgetResults) => {
          if (res?.event === "success" && res.info && typeof res.info === "object") {
            const raw = (res.info as any).secure_url as string | undefined;
            if (raw) onChange(raw);
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
  image={targetUrl}
  crop={crop}
  zoom={zoom}
  aspect={1}
  onCropChange={setCrop}
  onZoomChange={setZoom}
  onCropComplete={(croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }}
  showGrid={false}
  restrictPosition={true}
/>
            </div>

            <div className="flex items-center justify-between gap-3 p-3">
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setIsCropping(false)}>
                  Cancel
                </Button>
                <Button onClick={applyCrop}>Apply Crop</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
