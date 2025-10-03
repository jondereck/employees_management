"use client";

import { useEffect, useState } from "react";
import { Button } from "./button";
import { ImagePlus, Trash, Wand2 } from "lucide-react";
import Image from "next/image";
import { CldUploadWidget, type CldUploadWidgetResults } from "next-cloudinary";

interface ImageUploadProps {
  disabled?: boolean;
  onChange: (value: string) => void;        // parent decides to push/replace
  onRemove: (value: string) => void;
  value: string[];
  gender?: "Male" | "Female";
}

/** Insert a Cloudinary transformation into an existing secure_url. */
function addTransform(url: string, transform: string) {
  const marker = "/upload/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  return `${url.slice(0, idx + marker.length)}${transform}/${url.slice(idx + marker.length)}`;
}

/** Square crop + background removal → PNG (transparent) */
function makeSquareCutout(url: string) {
  return addTransform(
    url,
    "c_thumb,g_auto,w_700,h_700,e_background_removal:fineedges_y,f_png,q_auto"
  );
}

const BACKDROP_SRC = "/bday_bg.png"; // C:\Users\user\employees_management\public\bday_bg.png

export default function ImageUpload({
  disabled,
  onChange,
  onRemove,
  value,
  gender,
}: ImageUploadProps) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);
  if (!isMounted) return null;

  const placeholderSrc =
    gender === "Female" ? "/female_placeholder.png" :
      gender === "Male" ? "/male_placeholder.png" :
        null;

  const showPlaceholder = value.length === 0 && !!placeholderSrc;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        {value.length > 0 ? (
          value.map((url) => (
            <div key={url} className="relative">
              {/* Card with backdrop */}
              <div className="relative h-[240px] w-[240px] overflow-hidden rounded-xl shadow-sm ring-1 ring-black/5 bg-white">
                {/* Backdrop image from /public */}
                <Image
                  src={BACKDROP_SRC}
                  alt="Backdrop"
                  fill
                  sizes="240px"
                  className="object-cover"
                  priority
                />

                {/* Cut-out person layered on top (transparent PNG from Cloudinary) */}
                <div className="absolute inset-0 flex items-end justify-center">
                  <Image
                    src={url}
                    alt="Employee cut-out"
                    fill
                    // object-contain keeps aspect; object-bottom removes the visual gap;
                    // slight scale ensures we hide any transparent edge Cloudinary leaves.
                    className="object-contain object-bottom translate-y-[1px] scale-[1.015] drop-shadow-[0_10px_20px_rgba(0,0,0,0.35)]"
                    priority
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="absolute right-2 top-2 z-10 flex gap-2">
                <Button
                  type="button"
                  onClick={() => onChange(makeSquareCutout(url))}
                  variant="secondary"
                  size="icon"
                  disabled={disabled}
                  title="Re-process (square + remove background)"
                >
                  <Wand2 className="h-4 w-4" />
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
          <div
            className="
              relative h-[240px] w-[240px] overflow-hidden rounded-xl
              shadow-sm ring-1 ring-black/5
            "
          >
            <Image src={BACKDROP_SRC} alt="Backdrop" fill sizes="240px" className="object-cover" />
            <div className="absolute inset-0 flex items-end justify-center p-3">
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

      {/* Upload (auto background removal on success) */}
      <CldUploadWidget
        uploadPreset="evo6spz1"
        options={{ multiple: false, cropping: true }}
        onUpload={(res: CldUploadWidgetResults) => {
          if (res?.event === "success" && res.info && typeof res.info === "object") {
            const raw = (res.info as any).secure_url as string | undefined;
            if (raw) {
              const cutout = makeSquareCutout(raw); // ⬅️ auto remove bg + square
              onChange(cutout);
            }
          }
        }}
        onError={(err) => console.error("Cloudinary upload error:", err)}
      >
        {({ open }) => (
          <Button type="button" onClick={() => open()} disabled={disabled} variant="secondary">
            <ImagePlus className="mr-2 h-4 w-4" />
            Upload & Auto-Remove BG
          </Button>
        )}
      </CldUploadWidget>
    </div>
  );
}
