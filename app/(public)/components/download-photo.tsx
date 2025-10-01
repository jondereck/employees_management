// components/public/PublicHeadshot.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Download, Copy, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function empBase(s?: string | null) {
  return (s ?? "").split(",")[0]?.trim() || "photo";
}

async function downloadBlob(src: string, filename: string) {
  const tid = toast.loading("Preparing download…");
  try {
    const res = await fetch(src, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Saved as ${filename}`, { id: tid });
  } catch (e) {
    toast.error("Direct download blocked. Opening in a new tab…", { id: tid });
    window.open(src, "_blank");
  }
}

async function copyImageToClipboard(src: string) {
  const tid = toast.loading("Copying image…");
  try {
    const res = await fetch(src, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();

    await navigator.clipboard.write([new window.ClipboardItem({ [blob.type]: blob })]);
    toast.success("Copied image to clipboard!", { id: tid });
  } catch {
    toast.error("Copy failed. Some browsers block image clipboard.", { id: tid });
  }
}

export default function PublicHeadshot({
  src,
  employeeNo,
  className,
  sizes = "(min-width:1280px) 13rem, (min-width:1024px) 11rem, (min-width:640px) 10rem, 8rem",
  bgSrc = "/bday_bg.png",
}: {
  src?: string | null;
  employeeNo?: string | null;
  className?: string;
  sizes?: string;
   bgSrc?: string;  
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"download" | "copy" | null>(null);

  if (!src) {
    return (
      <div className={cn(
        "rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 text-xs",
        "w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 xl:w-32 xl:h-32",
        className
      )}>
        No photo
      </div>
    );
  }

  const filename = `${empBase(employeeNo)}.png`;

  return (
    <>
          <div
        className={cn(
          // sizing
          "relative rounded-2xl p-1.5 sm:p-2",
          "w-32 h-32 sm:w-40 sm:h-40 lg:w-44 lg:h-44 xl:w-52 xl:h-52",
          className
        )}
        style={{
          backgroundImage: `url(${bgSrc})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <Image
          src={src}
          alt="Profile photo"
          fill
          sizes={sizes}
          className="object-cover block"
          priority
        />

        {/* Floating action buttons */}
        <div className="absolute bottom-2 right-2 z-10 flex gap-2">
          <Button
            size="icon"
            variant="secondary"
            className="h-7 w-7 md:h-8 md:w-8 rounded-xl shadow-md"
            disabled={busy !== null}
            onClick={async () => {
              try { setBusy("download"); await downloadBlob(src, filename); }
              finally { setBusy(null); }
            }}
            title={`Download (${filename})`}
          >
            <Download className={`md:h-4 md:w-4 h-3.5 w-3.5 ${busy === "download" ? "animate-pulse" : ""}`} />
          </Button>


            <Button
              size="icon"
              variant="secondary"
              className="h-7 w-7 md:h-8 md:w-8 rounded-xl shadow-md"
              disabled={busy !== null}
              onClick={async () => { try { setBusy("copy"); await copyImageToClipboard(src); } finally { setBusy(null); } }}
              title="Copy image to clipboard"
            >
              <Copy className={`md:h-4 md:w-4 h-3.5 w-3.5 ${busy==="copy" ? "animate-pulse" : ""}`} />
            </Button>

          <Button
            size="icon"
            variant="secondary"
            className="h-7 w-7 md:h-8 md:w-8 rounded-xl shadow-md"
            onClick={() => setOpen(true)}
            title="Expand"
          >
            <Maximize2 className="md:h-4 md:w-4 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

 {/* Expand dialog with full-bleed background (no black bars) */}
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="sm:max-w-[1000px] p-0 bg-transparent border-0 shadow-none">
    <div className="relative w-[96vw] max-w-[1000px] rounded-2xl overflow-hidden shadow-2xl mx-auto">
      {/* Background layer */}
      <div className="relative w-full h-[68vh] sm:h-[70vh]">
        <Image
          src={bgSrc ?? "/bday_bg.png"}
          alt=""
          fill
          className="object-cover"     // 👈 always fills; no letterboxing
          priority
        />
        {/* optional darken for contrast */}
        <div className="absolute inset-0 bg-black/20" />

        {/* Foreground (your headshot), slightly inset so the BG is visible */}
        <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
          <div className="relative w-full max-w-[820px] aspect-[4/5] sm:aspect-video rounded-xl overflow-hidden ring-1 ring-black/10 bg-black/50">
            <Image
              src={src}
              alt="Profile photo expanded"
              fill
              sizes="100vw"
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={() => setOpen(false)}
          className="absolute top-3 right-3 h-8 w-8 rounded-xl bg-white/90 backdrop-blur shadow flex items-center justify-center"
          title="Close"
        >
          ✕
        </button>
      </div>
    </div>
  </DialogContent>
</Dialog>


    </>
  );
}
