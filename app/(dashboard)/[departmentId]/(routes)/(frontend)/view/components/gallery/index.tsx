"use client";

import { type CSSProperties, useEffect, useState } from "react";
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
  DialogPortal,
  DialogOverlay,
  DialogClose,
} from "@/components/ui/dialog";

type GalleryImage = {
  id: string;
  url: string;
  createdAt?: string;
  updatedAt?: string;
};

interface GalleryProps {
  images: GalleryImage[];
  employeeNo?: string | null;
  employeeId: string;
  gender?: "Male" | "Female";
}

const Gallery = ({ images, employeeId, employeeNo, gender }: GalleryProps) => {
  const [loadingAction, setLoadingAction] = useState<{ id: string; type: "copy" | "download" } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const isImageLoading = (id: string) => loadingAction?.id === id;

  // Placeholder logic
  const placeholderSrc = gender === "Female" ? "/female_placeholder.png" : "/male_placeholder.png";

  const rawImages = images ?? [];
  const displayImages: GalleryImage[] = rawImages.length === 0 
    ? [{ id: "placeholder", url: placeholderSrc }] 
    : rawImages;

  const isPlaceholder = (img: GalleryImage) => img.id === "placeholder";

  useEffect(() => {
    if (displayImages.length > 0 && (!activeId || !displayImages.some(i => i.id === activeId))) {
      setActiveId(displayImages[0].id);
    }
  }, [images, gender, activeId, displayImages]);

  const activeIndex = Math.max(0, displayImages.findIndex((i) => i.id === activeId));
  const activeImage = displayImages[activeIndex];

  // Helpers
  const sanitizeBase = (s: string) => s.replace(/[<>:"/\\|?*\x00-\x1F]/g, "-").trim();
  const buildFilename = (img: GalleryImage) => {
    const base = (employeeNo ?? "").toString().split(",")[0].trim() || employeeId;
    return `${sanitizeBase(base)}.png`;
  };

  const handleDownload = async (image: GalleryImage) => {
    if (isPlaceholder(image)) return;
    setLoadingAction({ id: image.id, type: "download" });
    try {
      const res = await fetch(image.url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = buildFilename(image);
      a.click();
      toast.success("Downloaded profile image.");
    } catch {
      toast.error("Download failed.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCopy = async (image: GalleryImage) => {
    if (isPlaceholder(image)) return;
    setLoadingAction({ id: image.id, type: "copy" });
    try {
      const res = await fetch(image.url);
      const blob = await res.blob();
      const item = new ClipboardItem({ [blob.type]: blob });
      await navigator.clipboard.write([item]);
      toast.success("Image copied to clipboard.");
    } catch {
      toast.error("Copy failed.");
    } finally {
      setLoadingAction(null);
    }
  };

  const photoBackground: CSSProperties = {
    backgroundImage: "url('/bday_bg.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
  };

  return (
    <>
      <Tab.Group
        as="div"
        className="flex flex-col gap-2"
        selectedIndex={activeIndex}
        onChange={(idx) => setActiveId(displayImages[idx]?.id ?? null)}
      >
        {/* Main Display Area */}
        <Tab.Panels className="w-full">
          {displayImages.map((image, idx) => (
            <Tab.Panel key={image.id}>
              <div
                className="group relative mx-auto aspect-square w-full overflow-hidden rounded-2xl border-4 border-white bg-slate-100 shadow-xl ring-1 ring-slate-200"
                style={!isPlaceholder(image) ? photoBackground : undefined}
              >
                <Image
                  fill
                  src={image.url}
                  alt="Employee"
                  className={cn(
                    "object-cover object-center transition duration-300 group-hover:scale-110",
                    isImageLoading(image.id) ? "opacity-40" : "opacity-100"
                  )}
                />

                {/* Company Logo Overlay (Top Left) */}
                {!isPlaceholder(image) && (
                  <div className="absolute left-2 top-2 z-10 opacity-80">
                    <Image
                      src="https://res.cloudinary.com/ddzjzrqrj/image/upload/v1702523620/Lingayen-3-removebg-preview_lmhivo.png"
                      alt="Logo"
                      width={24}
                      height={24}
                      className="h-6 w-6"
                    />
                  </div>
                )}

                {/* Loading Spinner */}
                {isImageLoading(image.id) && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-sm">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                )}

                {/* Hover Actions Bar (Bottom) */}
                {!isPlaceholder(image) && (
                  <div className="absolute inset-x-0 bottom-0 z-10 flex translate-y-full items-center justify-center gap-2 bg-gradient-to-t from-black/60 to-transparent p-3 transition-transform duration-300 group-hover:translate-y-0">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8 rounded-full shadow-lg"
                      onClick={() => handleDownload(image)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8 rounded-full shadow-lg"
                      onClick={() => handleCopy(image)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8 rounded-full shadow-lg"
                      onClick={() => {
                        setActiveId(image.id);
                        setPreviewOpen(true);
                      }}
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </Tab.Panel>
          ))}
        </Tab.Panels>

        {/* Thumbnail Bar - Only shows if multiple images exist */}
        {displayImages.length > 1 && (
          <div className="px-1 overflow-x-auto no-scrollbar">
            <Tab.List className="flex gap-2 min-w-max py-1">
              {displayImages.map((image) => (
                <Tab key={image.id} className="focus:outline-none">
                  {({ selected }) => (
                    <div
                      className={cn(
                        "h-12 w-12 rounded-lg overflow-hidden border-2 transition-all shadow-sm",
                        selected ? "border-primary ring-2 ring-primary/20 scale-105" : "border-transparent opacity-60 hover:opacity-100"
                      )}
                    >
                      <Image
                        src={image.url}
                        alt="Thumb"
                        width={48}
                        height={48}
                        className="object-cover w-full h-full"
                      />
                    </div>
                  )}
                </Tab>
              ))}
            </Tab.List>
          </div>
        )}
      </Tab.Group>

  <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
  <DialogPortal>
    {/* Darker overlay for focus */}
    <DialogOverlay className="bg-black/80 backdrop-blur-sm" />
    
    <DialogContent className="max-w-3xl overflow-hidden border-none bg-transparent p-0 shadow-2xl sm:rounded-2xl">
      <div className="group relative flex flex-col">
        
        {/* Main Image Container */}
        <div 
          className="relative aspect-square w-full overflow-hidden bg-slate-950 flex items-center justify-center transition-all"
          style={photoBackground}
        >
          {activeImage && (
            <Image 
              src={activeImage.url} 
              alt="Full View" 
              fill 
              className="object-contain transition-transform duration-500 hover:scale-105" 
              priority
            />
          )}

          {/* Floating Top Close/Info - Subtle hint of UI */}
          <div className="absolute top-4 right-4 z-10">
             <DialogClose className="rounded-full bg-black/20 p-2 text-white/70 backdrop-blur-md transition-all hover:bg-black/40 hover:text-white">
                <X className="h-5 w-5" />
             </DialogClose>
          </div>
        </div>

        {/* Floating Bottom Action Bar */}
        <div className="absolute bottom-6 left-1/2 flex w-[90%] -translate-x-1/2 items-center justify-between rounded-2xl border border-white/10 bg-black/40 p-4 text-white backdrop-blur-xl transition-all group-hover:bottom-8 group-hover:bg-black/60">
          <div className="flex flex-col gap-0.5 overflow-hidden">
            <span className="text-sm font-semibold tracking-tight">HD Profile Image</span>
            <span className="truncate text-[10px] uppercase tracking-widest text-white/50">
              {buildFilename(activeImage!)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 rounded-full text-white/80 hover:bg-white/10 hover:text-white"
              onClick={() => handleCopy(activeImage!)}
            >
              <Copy className="h-4 w-4" />
            </Button>
            
            <Button 
              size="sm" 
              className="rounded-full bg-white px-5 text-slate-900 transition-transform active:scale-95 hover:bg-slate-100"
              onClick={() => handleDownload(activeImage!)}
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
        </div>
      </div>
    </DialogContent>
  </DialogPortal>
</Dialog>
    </>
  );
};

export default Gallery;