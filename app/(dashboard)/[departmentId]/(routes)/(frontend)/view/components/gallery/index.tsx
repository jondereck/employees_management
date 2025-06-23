"use client"

import { useState } from "react";

import { Image as ImageType } from "../../../../employees/components/columns";

import { Tab } from "@headlessui/react";
import Image from "next/image";
import { cn, } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, Download, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";



interface GalleryProps {
  images: ImageType[];
}

const Gallery = ({
  images,
}: GalleryProps) => {
  const [loadingAction, setLoadingAction] = useState<{ id: string; type: "copy" | "download" } | null>(null);
  const isImageLoading = (id: string) => loadingAction?.id === id;


  const removeBackground = async (imageUrl: string): Promise<string | null> => {
    const formData = new FormData();
    formData.append("image_url", imageUrl);
    formData.append("size", "auto");

    try {
      const response = await fetch("https://api.remove.bg/v1.0/removebg", {
        method: "POST",
        headers: {
          "X-Api-Key": "PmgVbDF3vspFvkXAtsqKEUjz",
        },
        body: formData,
      });

      if (!response.ok) {
        console.error("Failed to remove background:", await response.text());
        return null;
      }

      const blob = await response.blob();
      return URL.createObjectURL(blob); // temporary preview URL
    } catch (error) {
      console.error("Error removing background:", error);
      return null;
    }
  };

  const handleDownload = async (image: ImageType) => {
    setLoadingAction({ id: image.id, type: "download" });
  
    try {
      const removedBgUrl = await removeBackground(image.url);
      if (!removedBgUrl) throw new Error("Background removal failed");
  
      const res = await fetch(removedBgUrl);
      const blob = await res.blob();
  
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `image-${image.id}-removed-bg.png`;
      a.click();
  
      toast.success("Downloaded image with background removed!");
    } catch (err: any) {
      const message = err?.message?.toLowerCase() ?? "";
  
      if (message.includes("limit")) {
        toast.warning("Background removal limit exceeded. Downloading original image.");
      } else if (message.includes("failed") || message.includes("500")) {
        toast.error("Server error while removing background. Downloading original image.");
      } else {
        toast.error("Unexpected error. Downloading original image.");
      }
  
      // Fallback to downloading original image
      try {
        const res = await fetch(image.url);
        const blob = await res.blob();
  
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `image-${image.id}.png`;
        a.click();
  
        toast.success("Downloaded original image.");
      } catch (fallbackErr) {
        toast.error("Failed to download original image.");
      }
    } finally {
      setLoadingAction(null);
    }
  };
  

  const handleCopy = async (image: ImageType) => {
    setLoadingAction({ id: image.id, type: "copy" });
  
    try {
      const removedBgUrl = await removeBackground(image.url);
      if (!removedBgUrl) throw new Error("Background removal failed");
  
      const res = await fetch(removedBgUrl);
      const blob = await res.blob();
  
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
  
      toast.success("Copied image with background removed!");
    } catch (err: any) {
      const message = err?.message?.toLowerCase() ?? "";
  
      if (message.includes("limit")) {
        toast.warning("Background removal limit exceeded. Copying original image.");
      } else if (message.includes("failed") || message.includes("500")) {
        toast.error("Server error while removing background. Copying original image.");
      } else {
        toast.error("Unexpected error. Copying original image.");
      }
  
      // Fallback to copying original image
      try {
        const res = await fetch(image.url);
        const blob = await res.blob();
  
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
  
        toast.success("Copied original image.");
      } catch (fallbackErr) {
        toast.error("Failed to copy original image.");
      }
    } finally {
      setLoadingAction(null);
    }
  };
  




  return (
    <Tab.Group as="div" className="flex flex-col-reverse">
      {/* Tab List - Horizontal scroll on small screens */}
      <div className="mt-2 mb-4 px-2 overflow-x-auto">
        <Tab.List className="flex gap-2 min-w-max">
          {images.map((image) => (
            <Tab key={image.id} className="focus:outline-none shrink-0">
              {({ selected }) => (
                <div
                  className={cn(
                    "rounded-md overflow-hidden border transition-all duration-200 cursor-pointer w-16 h-16",
                    selected
                      ? "ring-2 ring-primary border-primary"
                      : "border-muted hover:border-primary/50"
                  )}
                >
                  <Image
                    src={image.url}
                    alt="Thumbnail"
                    width={64}
                    height={64}
                    className="object-cover w-full h-full"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                </div>
              )}
            </Tab>
          ))}
        </Tab.List>
      </div>

      {/* Tab Panels */}
      <Tab.Panels className="w-full p-4">
        {images.map((image) => (
          <Tab.Panel key={image.id}>
            <div className="relative w-full max-w-sm mx-auto aspect-square overflow-hidden rounded-lg border bg-gray-100">
              <Image
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                src={image.url}
                alt="Main Image"
                className={cn(
                  "object-cover object-center transition-opacity duration-200",
                  isImageLoading(image.id) ? "opacity-40" : "opacity-100"
                )}
              />
              {/* Logo */}
              <div className="absolute top-2 left-2 z-10">
                <Image
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  src="https://res.cloudinary.com/ddzjzrqrj/image/upload/v1702523620/Lingayen-3-removebg-preview_lmhivo.png"
                  alt="Company Logo"
                  width={32}
                  height={32}
                  className="w-8 h-8"
                />

                  {/* Spinner Overlay */}
  {isImageLoading(image.id) && (
    <div className="absolute inset-0 flex items-center justify-center z-20">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  )}
              </div>
              <div className="absolute bottom-2 right-2 z-10 flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleDownload(image)}
                  className=" text-sm px-3 py-1 rounded-md shadow flex items-center gap-1"
                  disabled={loadingAction?.id === image.id && loadingAction.type === "download"}
                >
                  {loadingAction?.id === image.id && loadingAction.type === "download" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  
                </Button>

                <Button
                  variant="outline"
                  onClick={() => handleCopy(image)}
                  className= "text-sm px-3 py-1 rounded-md shadow flex items-center gap-1"
                  disabled={loadingAction?.id === image.id && loadingAction.type === "copy"}
                >
                  {loadingAction?.id === image.id && loadingAction.type === "copy" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  
                </Button>
              </div>

            </div>
          </Tab.Panel>

        ))}
      </Tab.Panels>
    </Tab.Group>




  );
}

export default Gallery;