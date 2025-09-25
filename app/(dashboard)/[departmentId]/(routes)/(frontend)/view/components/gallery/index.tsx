"use client";

import { useEffect, useMemo, useState } from "react";
import { Tab } from "@headlessui/react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, Download, Copy, Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// Extend your ImageType to include employeeNo (optional)
type GalleryImage = {
  id: string;
  url: string;

};

interface GalleryProps {
  images: GalleryImage[];
    employeeNo?: string | null; 
  employeeId: string; 
}

const Gallery = ({ images,  employeeId, employeeNo }: GalleryProps) => {
  const [loadingAction, setLoadingAction] = useState<{ id: string; type: "copy" | "download" } | null>(null);
  const isImageLoading = (id: string) => loadingAction?.id === id;
  const [activeIndex, setActiveIndex] = useState(0);

  



  // NEW: Preview dialog state
  const [previewOpen, setPreviewOpen] = useState(false);
  const activeImage = images[activeIndex];

  useEffect(() => {
    setActiveIndex(0); // show newest when images change
  }, [images]);

  // ===== helpers (NEW) =====
const sanitizeBase = (s: string) => s.replace(/[<>:"/\\|?*\x00-\x1F]/g, "-").trim();

const getExtFromUrl = (url: string) => {
  try {
    const u = new URL(url);
    // handle Next.js image proxy: /_next/image?url=...&w=...
    const proxied = u.searchParams.get("url");
    const path = proxied ? new URL(proxied, u.origin).pathname : u.pathname;
    const m = path.match(/\.([a-zA-Z0-9]+)$/);
    return (m?.[1] || "png").toLowerCase();
  } catch {
    return "png";
  }
};

const buildFilename = (img: GalleryImage, extHint?: string) => {
  const baseRaw = (employeeNo ?? "").toString().trim(); // <- from Gallery props
  const base = baseRaw || employeeId;                   // <- from Gallery props
  const ext = (extHint || getExtFromUrl(img.url) || "png").toLowerCase();
  return `${sanitizeBase(base)}.${ext}`;
};


  // ===== remove.bg as in your code =====
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
      return URL.createObjectURL(blob); // temp preview URL
    } catch (error) {
      console.error("Error removing background:", error);
      return null;
    }
  };

  const handleDownload = async (image: GalleryImage) => {
    setLoadingAction({ id: image.id, type: "download" });
    try {
      const removedBgUrl = await removeBackground(image.url);
      if (!removedBgUrl) throw new Error("Background removal failed");

      // remove.bg output is PNG — force png ext for this case
      const res = await fetch(removedBgUrl);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = buildFilename(image, "png"); // NEW
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
      // Fallback to original
      try {
        const res = await fetch(image.url);
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = buildFilename(image); // NEW: employeeNo + original ext
        a.click();
        toast.success("Downloaded original image.");
      } catch {
        toast.error("Failed to download original image.");
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCopy = async (image: GalleryImage) => {
    setLoadingAction({ id: image.id, type: "copy" });
    try {
      const removedBgUrl = await removeBackground(image.url);
      if (!removedBgUrl) throw new Error("Background removal failed");

      const res = await fetch(removedBgUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
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
      // Fallback to original
      try {
        const res = await fetch(image.url);
        const blob = await res.blob();
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        toast.success("Copied original image.");
      } catch {
        toast.error("Failed to copy original image.");
      }
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <>
      <Tab.Group as="div" className="flex flex-col-reverse" selectedIndex={activeIndex} onChange={setActiveIndex}>
        {/* Thumbs */}
        <div className="mt-2 mb-4 px-2 overflow-x-auto">
          <Tab.List className="flex gap-2 min-w-max">
            {images.map((image) => (
              <Tab key={image.id} className="focus:outline-none shrink-0">
                {({ selected }) => (
                  <div
                    className={cn(
                      "rounded-md overflow-hidden border transition-all duration-200 cursor-pointer w-16 h-16",
                      selected ? "ring-2 ring-primary border-primary" : "border-muted hover:border-primary/50"
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

        {/* Panels */}
        <Tab.Panels className="w-full p-4">
          {images.map((image, idx) => (
            <Tab.Panel key={image.id}>
              <div className="relative w-full max-w-sm mx-auto aspect-square overflow-hidden rounded-lg border bg-gray-100">
                {/* Click to open full (NEW) */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveIndex(idx);
                    setPreviewOpen(true);
                  }}
                  className="absolute inset-0 z-[5] focus:outline-none"
                  aria-label="Open full preview"
                />

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

                {/* Top-left logo */}
                <div className="absolute top-2 left-2 z-10">
                  <Image
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    src="https://res.cloudinary.com/ddzjzrqrj/image/upload/v1702523620/Lingayen-3-removebg-preview_lmhivo.png"
                    alt="Company Logo"
                    width={32}
                    height={32}
                    className="w-8 h-8"
                  />
                </div>

                {/* Spinner overlay */}
                {isImageLoading(image.id) && (
                  <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/10">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                )}

                {/* Bottom-right actions */}
                <div className="absolute bottom-2 right-2 z-10 flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleDownload(image)}
                    className="text-sm px-3 py-1 rounded-md shadow flex items-center gap-1"
                    disabled={loadingAction?.id === image.id && loadingAction.type === "download"}
                    title="Download"
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
                    className="text-sm px-3 py-1 rounded-md shadow flex items-center gap-1"
                    disabled={loadingAction?.id === image.id && loadingAction.type === "copy"}
                    title="Copy to clipboard"
                  >
                    {loadingAction?.id === image.id && loadingAction.type === "copy" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>

                  {/* Open full btn (visible if overlay button isn't tapped) */}
                  <Button
                    variant="outline"
                    className="text-sm px-3 py-1 rounded-md shadow flex items-center gap-1"
                    onClick={() => {
                      setActiveIndex(idx);
                      setPreviewOpen(true);
                    }}
                    title="Open full preview"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Tab.Panel>
          ))}
        </Tab.Panels>
      </Tab.Group>

      {/* Full preview dialog (NEW) */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl p-0">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle className="text-base">Preview</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Click download to save as <strong>{activeImage ? buildFilename(activeImage) : ""}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="relative w-full">
            <div className="relative mx-auto w-full aspect-[4/3] bg-black">
              {activeImage && (
                <Image
                  src={activeImage.url}
                  alt="Full preview"
                  fill
                  className="object-contain"
                  sizes="100vw"
                  priority
                />
              )}
            </div>

            {/* Top-right quick close */}
          
          </div>

          <DialogFooter className="px-4 pb-4 gap-2">
            {activeImage && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleCopy(activeImage)}
                  disabled={loadingAction?.id === activeImage.id && loadingAction.type === "copy"}
                >
                  {loadingAction?.id === activeImage.id && loadingAction.type === "copy" ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Copy className="w-4 h-4 mr-2" />
                  )}
                  Copy
                </Button>
                <Button
                  onClick={() => handleDownload(activeImage)}
                  disabled={loadingAction?.id === activeImage.id && loadingAction.type === "download"}
                >
                  {loadingAction?.id === activeImage.id && loadingAction.type === "download" ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Download
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Gallery;
