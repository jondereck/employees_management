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
}

const ImageUpload = ({
  disabled,
  onChange,
  onRemove,
  value,
}: ImageUploadProps) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);


  const onUpload = (result: any) => {
    onChange(result.info.secure_url);
  }

  if (!isMounted) {
    return null;
  }

  const defaultImageUrl = "https://res.cloudinary.com/ddzjzrqrj/image/upload/v1700612053/profile-picture-vector-illustration_mxkhbc.jpg"
  return (
    <div>
      <div className="mb-4 flex item-center gap-4">
        {value.length > 0 ? (
          value.map((url) => (
            <div key={url} className="relative w-[200px] h-[200px] rounded-md overflow-hidden">
              <div className="z-10 absolute top-2 right-2">
                <Button
                  type="button"
                  onClick={() => onRemove(url)}
                  variant="destructive"
                  size="icon"
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
              <Image
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                fill
                className="object-cover"
                alt="image"
                src={url}
              />
            </div>
          )) 
          )
          : (
            <div className="relative w-[200px] h-[200px] rounded-md overflow-hidden">
              <Image 
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                fill
                className="object cover"
                alt="default image"
                src={defaultImageUrl}
              />
            </div>
          )
        }
      </div>
      <CldUploadWidget 
        onUpload={(result:any) => onChange(result.info.secure_url)}
        uploadPreset="evo6spz1">
        {({ open }) => {
          const onClick = () => {
            open();
          };

          return (
            <Button
              type="button"
              disabled={disabled}
              variant="secondary"
              onClick={onClick}
            >
              <ImagePlus className="h-4 w-4 mr-2" />
              Upload an Image
            </Button>
          );
        }} 
      </CldUploadWidget>
    </div>
  );
}

export default ImageUpload;