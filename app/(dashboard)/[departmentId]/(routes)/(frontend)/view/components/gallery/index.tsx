"use client";

import { useEffect, useState } from "react";
import { Tab } from "@headlessui/react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, Download, Copy, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

type GalleryImage = { id: string; url: string };

interface GalleryProps {
  images: GalleryImage[];
  employeeNo?: string | null;
  employeeId: string;
  gender?: "Male" | "Female";   // NEW
}

const Gallery = ({ images, employeeId, employeeNo, gender }: GalleryProps) => {
  const [loadingAction, setLoadingAction] =
    useState<{ id: string; type: "copy" | "download" } | null>(null);
  const isImageLoading = (id: string) => loadingAction?.id === id;
  const [activeIndex, setActiveIndex] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);

  // ---- placeholder logic
  const placeholderSrc =
    gender === "Female" ? "/female_placeholder.png"
    : gender === "Male"  ? "/male_placeholder.png"
    : null;

  const isEmpty = images.length === 0 && !!placeholderSrc;
  const displayImages: GalleryImage[] = isEmpty
    ? [{ id: "placeholder", url: placeholderSrc! }]
    : images;

  const isPlaceholder = (img: GalleryImage) => img.id === "placeholder";

  const activeImage = displayImages[activeIndex];

  useEffect(() => { setActiveIndex(0); }, [images, gender]);

  // ===== helpers =====
  const sanitizeBase = (s: string) => s.replace(/[<>:"/\\|?*\x00-\x1F]/g, "-").trim();
  const getExtFromUrl = (url: string) => {
    try {
      const u = new URL(url);
      const proxied = u.searchParams.get("url");
      const path = proxied ? new URL(proxied, u.origin).pathname : u.pathname;
      const m = path.match(/\.([a-zA-Z0-9]+)$/);
      return (m?.[1] || "png").toLowerCase();
    } catch { return "png"; }
  };
  const buildFilename = (img: GalleryImage, extHint?: string) => {
    const baseRaw = (employeeNo ?? "").toString().trim();
    const base = baseRaw || employeeId;
    const ext = (extHint || getExtFromUrl(img.url) || "png").toLowerCase();
    return `${sanitizeBase(base)}.${ext}`;
  };

  // ===== remove.bg =====
  const removeBackground = async (imageUrl: string): Promise<string | null> => {
    const formData = new FormData();
    formData.append("image_url", imageUrl);
    formData.append("size", "auto");
    try {
      const response = await fetch("https://api.remove.bg/v1.0/removebg", {
        method: "POST",
        headers: { "X-Api-Key": "PmgVbDF3vspFvkXAtsqKEUjz" },
        body: formData,
      });
      if (!response.ok) return null;
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch { return null; }
  };

  const handleDownload = async (image: GalleryImage) => {
    if (isPlaceholder(image)) return; // no actions on placeholder
    setLoadingAction({ id: image.id, type: "download" });
    try {
      const removedBgUrl = await removeBackground(image.url);
      if (!removedBgUrl) throw new Error("Background removal failed");
      const res = await fetch(removedBgUrl);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = buildFilename(image, "png");
      a.click();
      toast.success("Downloaded image with background removed!");
    } catch (err: any) {
      try {
        const res = await fetch(image.url);
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = buildFilename(image);
        a.click();
        toast.success("Downloaded original image.");
      } catch { toast.error("Failed to download image."); }
    } finally { setLoadingAction(null); }
  };

  const handleCopy = async (image: GalleryImage) => {
    if (isPlaceholder(image)) return; // no actions on placeholder
    setLoadingAction({ id: image.id, type: "copy" });
    try {
      const removedBgUrl = await removeBackground(image.url);
      const res = await fetch(removedBgUrl || image.url);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success(removedBgUrl ? "Copied image with background removed!" : "Copied image.");
    } catch { toast.error("Failed to copy image."); }
    finally { setLoadingAction(null); }
  };

  return (
    <>
      <Tab.Group
        as="div"
        className="flex flex-col-reverse"
        selectedIndex={activeIndex}
        onChange={setActiveIndex}
      >
        {/* Thumbs (hide when only one image — e.g., placeholder) */}
        {displayImages.length > 1 && (
          <div className="mt-2 mb-4 px-2 overflow-x-auto">
            <Tab.List className="flex gap-2 min-w-max">
              {displayImages.map((image) => (
                <Tab key={image.id} className="focus:outline-none shrink-0">
                  {({ selected }) => (
                    <div
                      className={cn(
                        "w-16 h-16 rounded-md overflow-hidden border transition-all cursor-pointer",
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
                        sizes="(max-width:768px)100vw,(max-width:1200px)50vw,33vw"
                      />
                    </div>
                  )}
                </Tab>
              ))}
            </Tab.List>
          </div>
        )}

        {/* Panels */}
        <Tab.Panels className="w-full p-4">
          {displayImages.map((image, idx) => (
            <Tab.Panel key={image.id}>
              <div className="relative mx-auto w-full max-w-sm aspect-square overflow-hidden rounded-lg border bg-gray-100">
                {/* open preview only if not placeholder */}
                {!isPlaceholder(image) && (
                  <button
                    type="button"
                    onClick={() => { setActiveIndex(idx); setPreviewOpen(true); }}
                    className="absolute inset-0 z-[5] focus:outline-none"
                    aria-label="Open full preview"
                  />
                )}

                <Image
                  fill
                  sizes="(max-width:768px)100vw,(max-width:1200px)50vw,33vw"
                  src={image.url}
                  alt={isPlaceholder(image) ? "Placeholder" : "Main Image"}
                  className={cn(
                    "object-cover object-center transition-opacity duration-200",
                    isImageLoading(image.id) ? "opacity-40" : "opacity-100"
                  )}
                />

                {/* Top-left logo (hide on placeholder) */}
                {!isPlaceholder(image) && (
                  <div className="absolute top-2 left-2 z-10">
                    <Image
                      src="https://res.cloudinary.com/ddzjzrqrj/image/upload/v1702523620/Lingayen-3-removebg-preview_lmhivo.png"
                      alt="Company Logo"
                      width={32}
                      height={32}
                      className="w-8 h-8"
                      sizes="(max-width:768px)100vw,(max-width:1200px)50vw,33vw"
                    />
                  </div>
                )}

                {/* Spinner overlay */}
                {isImageLoading(image.id) && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                )}

                {/* Actions (hidden for placeholder) */}
                {!isPlaceholder(image) && (
                  <div className="absolute bottom-2 right-2 z-10 flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleDownload(image)}
                      className="text-sm px-3 py-1 rounded-md shadow flex items-center gap-1"
                      disabled={loadingAction?.id === image.id && loadingAction.type === "download"}
                      title="Download"
                    >
                      {loadingAction?.id === image.id && loadingAction.type === "download"
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Download className="h-4 w-4" />}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => handleCopy(image)}
                      className="text-sm px-3 py-1 rounded-md shadow flex items-center gap-1"
                      disabled={loadingAction?.id === image.id && loadingAction.type === "copy"}
                      title="Copy to clipboard"
                    >
                      {loadingAction?.id === image.id && loadingAction.type === "copy"
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Copy className="h-4 w-4" />}
                    </Button>

                    <Button
                      variant="outline"
                      className="text-sm px-3 py-1 rounded-md shadow flex items-center gap-1"
                      onClick={() => { setActiveIndex(idx); setPreviewOpen(true); }}
                      title="Open full preview"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </Tab.Panel>
          ))}
        </Tab.Panels>
      </Tab.Group>

      {/* Full preview dialog (skip if placeholder) */}
      <Dialog open={previewOpen && !isPlaceholder(activeImage)} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl p-0">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle className="text-base">Preview</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Click download to save as <strong>{activeImage ? buildFilename(activeImage) : ""}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="relative w-full">
            <div className="relative mx-auto w-full aspect-[4/3] bg-black">
              {activeImage && !isPlaceholder(activeImage) && (
                <Image src={activeImage.url} alt="Full preview" fill className="object-contain" sizes="100vw" priority />
              )}
            </div>
          </div>

          <DialogFooter className="px-4 pb-4 gap-2">
            {activeImage && !isPlaceholder(activeImage) && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleCopy(activeImage)}
                  disabled={loadingAction?.id === activeImage.id && loadingAction.type === "copy"}
                >
                  {loadingAction?.id === activeImage.id && loadingAction.type === "copy"
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <Copy className="mr-2 h-4 w-4" />}
                  Copy
                </Button>
                <Button
                  onClick={() => handleDownload(activeImage)}
                  disabled={loadingAction?.id === activeImage.id && loadingAction.type === "download"}
                >
                  {loadingAction?.id === activeImage.id && loadingAction.type === "download"
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <Download className="mr-2 h-4 w-4" />}
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
