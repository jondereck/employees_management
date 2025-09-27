"use client";

import { useEffect, useState } from "react";
import { Button } from "./button";
import { ImagePlus, Trash } from "lucide-react";
import Image from "next/image";
import { CldUploadWidget } from "next-cloudinary";


interface ImageUploadProps {
  disabled?: boolean;
  onChange: (value: string) => void;
  onRemove: (value: string) => void;
  value: string[];
  /** show placeholder only when no image */
  gender?: "Male" | "Female"; // if omitted, no placeholder is shown
}

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

  const placeholderSrc = gender === "Female"
    ? "/female_placeholder.png"
    : gender === "Male"
    ? "/male_placeholder.png"
    : null; // no generic fallback

  const showPlaceholder = value.length === 0 && !!placeholderSrc;

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        {value.length > 0 ? (
          value.map((url) => (
            <div key={url} className="relative h-[200px] w-[200px] overflow-hidden rounded-md">
              <div className="absolute right-2 top-2 z-10">
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
              <Image
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="object-cover"
                alt="employee image"
                src={url}
              />
            </div>
          ))
        ) : showPlaceholder ? (
          <div className="relative h-[200px] w-[200px] overflow-hidden rounded-md">
            <Image
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover"
              alt={`${gender} placeholder`}
              src={placeholderSrc!} // safe due to showPlaceholder
              priority
            />
          </div>
        ) : (
          <div className="flex h-[200px] w-[200px] items-center justify-center rounded-md border text-xs text-muted-foreground">
            No image yet
          </div>
        )}
      </div>

      <CldUploadWidget
        onUpload={(result: any) => onChange(result.info.secure_url)}
        uploadPreset="evo6spz1"
      >
        {({ open }) => (
          <Button
            type="button"
            disabled={disabled}
            variant="secondary"
            onClick={() => open()}
          >
            <ImagePlus className="mr-2 h-4 w-4" />
            Upload an Image
          </Button>
        )}
      </CldUploadWidget>
    </div>
  );
}
