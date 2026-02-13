"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogPortal } from "@/components/ui/dialog";
import { Download, Copy, Maximize2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DialogOverlay } from "@radix-ui/react-dialog";

function empBase(s?: string | null) {
  return (s ?? "").split(",")[0]?.trim() || "photo";
}

export default function PublicHeadshot({
  src,
  employeeNo,
  className,
  bgSrc = "/bday_bg.png",
}: {
  src?: string | null;
  employeeNo?: string | null;
  className?: string;
  bgSrc?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"download" | "copy" | null>(null);

  if (!src) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-2xl bg-slate-100 text-slate-400 text-xs",
          "w-32 h-32 sm:w-40 sm:h-40",
          className
        )}
      >
        No Photo
      </div>
    );
  }

  const filename = `${empBase(employeeNo)}.png`;

  const handleDownload = async () => {
    setBusy("download");
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Downloaded image.");
    } catch {
      toast.error("Download failed.");
    } finally {
      setBusy(null);
    }
  };

  const handleCopy = async () => {
    setBusy("copy");
    try {
      const res = await fetch(src);
      const blob = await res.blob();

      if (!("clipboard" in navigator) || !("ClipboardItem" in window)) {
        throw new Error();
      }

      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);

      toast.success("Copied image.");
    } catch {
      toast.error("Clipboard not supported.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {/* MAIN CARD */}
      <div
        className={cn(
          "group relative aspect-square w-32 sm:w-40 rounded-3xl overflow-hidden",
          "border-4 border-white shadow-xl ring-1 ring-slate-200",
          className
        )}
        style={{
          backgroundImage: `url(${bgSrc})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <Image
          src={src}
          alt="Profile"
          fill
          onLoadStart={() => setLoading(true)}
          onLoadingComplete={() => setLoading(false)}
          className={cn(
            "object-cover transition-transform duration-500 group-hover:scale-110",
            loading ? "opacity-0" : "opacity-100"
          )}
        />

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-sm">
            <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
          </div>
        )}

        {/* Hover Action Bar */}
        <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 bg-gradient-to-t from-black/60 to-transparent p-3 flex justify-center gap-2">
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 rounded-full"
            onClick={handleDownload}
            disabled={busy === "download"}
          >
            <Download className="h-4 w-4" />
          </Button>

          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 rounded-full"
            onClick={handleCopy}
            disabled={busy === "copy"}
          >
            <Copy className="h-4 w-4" />
          </Button>

          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 rounded-full"
            onClick={() => setOpen(true)}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* EXPAND DIALOG */}
     <Dialog open={open} onOpenChange={setOpen}>
  <DialogPortal>
    {/* Dark overlay */}
    <DialogOverlay className="bg-black/80 backdrop-blur-sm" />

    <DialogContent className="max-w-3xl overflow-hidden border-none bg-transparent p-0 shadow-2xl sm:rounded-2xl">
      <div className="group relative flex flex-col">

        {/* Main Image Container */}
        <div
          className="relative aspect-square w-full overflow-hidden bg-slate-950 flex items-center justify-center transition-all"
          style={{
            backgroundImage: `url(${bgSrc ?? "/bday_bg.png"})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {src && (
            <Image
              src={src}
              alt="Full View"
              fill
              priority
              onLoadStart={() => setLoading(true)}
              onLoadingComplete={() => setLoading(false)}
              className={cn(
                "object-contain transition-transform duration-500 hover:scale-105",
                loading ? "opacity-0" : "opacity-100"
              )}
            />
          )}

          {loading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <Loader2 className="h-10 w-10 animate-spin text-white" />
            </div>
          )}

          {/* Floating Close Button */}
          <div className="absolute top-4 right-4 z-10">
            <DialogClose className="rounded-full bg-black/20 p-2 text-white/70 backdrop-blur-md transition-all hover:bg-black/40 hover:text-white">
              <X className="h-5 w-5" />
            </DialogClose>
          </div>
        </div>

        {/* Floating Bottom Action Bar */}
        <div className="absolute bottom-6 left-1/2 flex w-[90%] -translate-x-1/2 items-center justify-between rounded-2xl border border-white/10 bg-black/40 p-4 text-white backdrop-blur-xl transition-all group-hover:bottom-8 group-hover:bg-black/60">

          <div className="flex flex-col gap-0.5 overflow-hidden">
            <span className="text-sm font-semibold tracking-tight">
              HD Profile Image
            </span>
            <span className="truncate text-[10px] uppercase tracking-widest text-white/50">
              {filename}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-white/80 hover:bg-white/10 hover:text-white"
              onClick={handleCopy}
            >
              <Copy className="h-4 w-4" />
            </Button>

            <Button
              size="sm"
              className="rounded-full bg-white px-5 text-slate-900 transition-transform active:scale-95 hover:bg-slate-100"
              onClick={handleDownload}
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
}
