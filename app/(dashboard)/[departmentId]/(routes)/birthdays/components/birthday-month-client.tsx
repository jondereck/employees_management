"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import Image from "next/image";
import * as htmlToImage from "html-to-image";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import NextImage from "next/image";
import { Download, Calendar, Loader2, CheckCircle2, XCircle } from "lucide-react";

import { toastProgress } from "@/lib/linear-progress";


const transparentPx =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

function waitForImg(img: HTMLImageElement, timeout = 8000) {
  return new Promise<boolean>((resolve) => {
    if (img.complete && img.naturalWidth > 0) return resolve(true);
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      img.removeEventListener("load", onload);
      img.removeEventListener("error", onerror);
      clearTimeout(to);
      resolve(true); // resolve even on error so we don't hang
    };
    const onload = () => cleanup();
    const onerror = () => cleanup();
    img.addEventListener("load", onload);
    img.addEventListener("error", onerror);
    const to = setTimeout(cleanup, timeout);
  });
}

async function preloadBoardAssets(node: HTMLElement) {
  const imgs = Array.from(node.querySelectorAll("img")) as HTMLImageElement[];
  await Promise.allSettled(imgs.map((img) => waitForImg(img, 8000)));
  // also warm the per-card background
  await new Promise((r) => {
  const bg = new window.Image();
bg.crossOrigin = "anonymous";
bg.onload = () => r(null);
bg.onerror = () => r(null);
bg.src = "/bday_bg.png";
setTimeout(() => r(null), 3000);
  });
}


type Person = {
  id: string;
  firstName: string;
  lastName: string;
  nickname?: string | null;
  birthday: string | Date;
  imageUrl?: string | null;
};

function monthName(m: number) {
  return [
    "JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE",
    "JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"
  ][m];
}
function safeDate(d: string | Date) {
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}
function displayName(p: Person) {
  const nick = (p.nickname ?? "").trim();
  if (nick) return nick.toUpperCase();
  const first = (p.firstName ?? "").trim();
  const last = (p.lastName ?? "").trim();
  return `${first} ${last}`.trim().toUpperCase();
}
function fmtMonthDay(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); // e.g., Jan 5
}

export default function BirthdayMonthClient({
  departmentId,
  initialMonth,
  people,
  subtitle,
}: {
  departmentId: string;
  initialMonth: number;
  people: Person[];
  subtitle?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [showDates, setShowDates] = useState<boolean>(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const monthParam = searchParams.get("month");
  const month = Number.isFinite(Number(monthParam)) ? Number(monthParam) : initialMonth;

  const [exporting, setExporting] = useState(false);



  // Bigger image & tight layout presets
  const gridClass =
    "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3";

  // Filter + sort
  const celebrants = useMemo(() => {
    return people
      .filter((p) => {
        const d = safeDate(p.birthday);
        return d && d.getMonth() === month;
      })
      .sort((a, b) => {
        const da = safeDate(a.birthday)!;
        const db = safeDate(b.birthday)!;
        return da.getDate() - db.getDate();
      });
  }, [people, month]);

  const onChangeMonth = (m: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", m);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };



// ...

const handleDownload = async () => {
  if (!boardRef.current || exporting) return;
  setExporting(true);

  try {
    await toastProgress(async (progress) => {
      const node = boardRef.current!;

      // Hide controls
      const hidden: HTMLElement[] = [];
      node.querySelectorAll<HTMLElement>("[data-hide-in-export]").forEach((el) => {
        if (getComputedStyle(el).visibility !== "hidden") {
          el.style.visibility = "hidden";
          hidden.push(el);
        }
      });

      try {
        // Preparing…
        progress.set(8);
        progress.label("Preparing…");
        if ((document as any).fonts?.ready) await (document as any).fonts.ready;

        // Preload images
        await preloadBoardAssets(node);
        progress.set(60);
        progress.label("Encoding PNG…");

        // Render to PNG
        const blob = await htmlToImage.toBlob(node, {
          pixelRatio: 2,
          backgroundColor: "#ffffff",
          cacheBust: true,
          imagePlaceholder: transparentPx,
          style: {
            width: getComputedStyle(node).width,
            height: getComputedStyle(node).height,
          } as Partial<CSSStyleDeclaration>,
          filter: (n: HTMLElement) =>
            (n as any).dataset?.hideInExport === undefined,
        });
        if (!blob) throw new Error("PNG encoding returned empty blob.");

        // Save
        progress.set(96);
        progress.label("Saving…");
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${monthName(month)}_Birthday_Celebrants.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      } finally {
        // Restore UI
        document.querySelectorAll<HTMLElement>("[data-hide-in-export]").forEach((el) => {
          el.style.visibility = "";
        });
      }
    }, {
      loading: "Processing…",
      success: "Export complete",
      error: "Export failed. Please try again.",
      autoTick: { start: 5, max: 88, step: 2, intervalMs: 120 }, // optional smooth progress
    });
  } finally {
    setExporting(false);
  }
};


async function exportBoardPNG(node: HTMLElement, filename: string) {
  // hide controls
  const hidden: HTMLElement[] = [];
  node.querySelectorAll<HTMLElement>("[data-hide-in-export]").forEach((el) => {
    if (getComputedStyle(el).visibility !== "hidden") {
      el.style.visibility = "hidden";
      hidden.push(el);
    }
  });

  try {
    // fonts + images
    if ((document as any).fonts?.ready) await (document as any).fonts.ready;
    await preloadBoardAssets(node);

    const blob = await htmlToImage.toBlob(node, {
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      cacheBust: true,
      imagePlaceholder: transparentPx,
      style: {
        width: getComputedStyle(node).width,
        height: getComputedStyle(node).height,
      } as Partial<CSSStyleDeclaration>,
      filter: (n: HTMLElement) => (n as any).dataset?.hideInExport === undefined,
    });

    if (!blob) throw new Error("PNG encoding returned empty blob.");

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } finally {
    hidden.forEach((el) => (el.style.visibility = ""));
  }
}



  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-3">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <Select value={String(month)} onValueChange={onChangeMonth}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => (
                <SelectItem key={i} value={String(i)}>{monthName(i)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 ml-1" data-hide-in-export>
            <Switch checked={showDates} onCheckedChange={setShowDates} id="toggle-dates" />
            <label htmlFor="toggle-dates" className="text-sm select-none cursor-pointer">
              Show dates
            </label>
          </div>

          <div className="text-xs sm:text-sm text-muted-foreground ml-1">
            {celebrants.length} celebrant{celebrants.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="flex gap-2">
  <Button
  onClick={handleDownload}
  variant="outline"
  size="sm"
  data-hide-in-export
  disabled={exporting}
>
  <Download className="h-4 w-4 mr-2" />
  {exporting ? "Exporting…" : "Download PNG"}
</Button>
        </div>
      </div>

      {/* Board */}
      <div
        ref={boardRef}
        className={cn(
          // tighter padding so images dominate
          "rounded-2xl border shadow-sm p-3 sm:p-4",
          // background image from /public
          "bg-white bg-center bg-cover",
        )}
        style={{
          backgroundImage: "url('')",
        }}
      >
        {/* Header */}
        <div className="text-center space-y-1.5 sm:space-y-2 mb-4 sm:mb-6">
          <div
            className={cn(
              "text-7xl md:text-8xl lg:text-9xl font-black tracking-wide leading-none"
            )}
            style={{
              letterSpacing: "0.06em",
              backgroundImage:
                "linear-gradient(90deg, #7e22ce 0%, #db2777 50%, #f59e0b 100%)",
              WebkitBackgroundClip: "text",
              color: "transparent",
              textShadow: "0 1px 0 rgba(255,255,255,0.35)",
            }}
          >
            {monthName(month)}
          </div>
          <div
            className="text-3xl md:text-4xl lg:text-5xl font-extrabold uppercase"
            style={{ letterSpacing: "0.045em" }}
          >
            Birthday <span className="lowercase font-black">celebrators</span>
          </div>
          {subtitle ? (
            <div className="text-xs sm:text-sm text-muted-foreground">{subtitle}</div>
          ) : null}
        </div>

        {/* Grid */}
        {celebrants.length > 0 ? (
          <div className={gridClass}>
            {celebrants.map((p) => {
              const d = safeDate(p.birthday)!;
              const name = displayName(p);

              return (
  <div
    key={p.id}
    className={cn(
      "relative rounded-xl border bg-white/80 overflow-hidden hover:shadow-md transition"
    )}
  >
    {/* Photo wrapper: puts /bday_bg.png behind the image */}
    <div
      className="relative w-full aspect-square bg-center bg-cover"
      style={{ backgroundImage: "url('/bday_bg.png')" }}
    >
      {p.imageUrl ? (
       <NextImage
        key={`${p.id}-${p.imageUrl ?? "none"}`}   // 👉 force a unique node per person
  src={p.imageUrl ?? "/hrmo-logi.png"}
   unoptimized                // ✅ lets the browser load image directly (no CDN transforms)    // ✅ prevents tainted canvas
  referrerPolicy="no-referrer"
  alt={name}
  fill
  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
  className="object-cover"
  crossOrigin="anonymous"   // ✅ help avoid tainted canvas
  loading="eager"     
   onError={(e) => {
    // fallback if an image 404s
    try { (e.currentTarget as any).src = "/avatar-placeholder.png"; } catch {}
  }}      // ✅ ensure it loads before export
/>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80">
          <span className="text-5xl font-black text-gray-300 select-none">
            {name.slice(0, 1) || "?"}
          </span>
        </div>
      )}

      {/* top-right date pill (respects your showDates switch) */}
      {showDates && (
        <div className="absolute top-2 right-2">
          <div className="rounded-md bg-white/95 text-pink-700 border border-pink-200 px-2 py-0.5 text-xs font-extrabold shadow-sm">
            {fmtMonthDay(d)}
          </div>
        </div>
      )}

      {/* NAME BAR — stronger, bigger, with shadow for readability */}
      <div className="absolute inset-x-0 bottom-0">
        {/* subtle gradient so text sits on darker base */}
        <div className="h-12 bg-gradient-to-t from-black/70 via-black/50 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center px-2 py-2">
          <span
            className={cn(
              "uppercase font-black tracking-wide",
              "text-white text-[clamp(14px,2.4vw,20px)]",
              "drop-shadow-[0_2px_2px_rgba(0,0,0,0.65)]"
            )}
            style={{
              textShadow:
                "0 1px 2px rgba(0,0,0,.85), 0 0 10px rgba(0,0,0,.55), 0 0 2px rgba(0,0,0,.9)",
              letterSpacing: "0.06em",
            }}
            title={name}
          >
            {name}
          </span>
        </div>
      </div>
    </div>
  </div>
);

            })}
          </div>
        ) : (
          <div className="text-center text-sm text-muted-foreground py-8">
            No active birthday celebrants for {monthName(month)}.
          </div>
        )}

        <div className="mt-3 text-[10px] text-muted-foreground text-center print:hidden">
          Auto-generated from HRPS • {new Date().getFullYear()}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
