"use client";

import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import NextImage from "next/image";
import * as htmlToImage from "html-to-image";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { toastProgress } from "@/lib/linear-progress";
import { Download, Calendar, Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

import BirthdayGreetingCard from "./birthday-greetting-card";




const transparentPx =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

type Person = {
  id: string;
  firstName: string;
  lastName: string;
  nickname?: string | null;
  birthday: string | Date;
  imageUrl?: string | null;
  prefix?: string | null;
  middleName?: string | null;
  suffix?: string | null;
  isHead: boolean;
};

const SHOW_DATES_STORAGE_KEY = "birthdays.showDates";
type HeadsFilter = "all" | "heads-only";


// temporary swap <img> sources to a safe placeholder if they look cross-origin and fail
function swapUninlineableImages(node: HTMLElement) {
  const imgs = Array.from(node.querySelectorAll("img")) as HTMLImageElement[];
  const originals: Array<{ el: HTMLImageElement; src: string }> = [];

  for (const el of imgs) {
    const src = el.currentSrc || el.src;
    if (!src) continue;
    const isData = src.startsWith("data:");
    const sameOrigin = (() => {
      try { return new URL(src, location.href).origin === location.origin; } catch { return false; }
    })();
    // If not same-origin and not data:, it's risky. We'll swap to placeholder during export.
    if (!isData && !sameOrigin) {
      originals.push({ el, src });
      el.setAttribute("data-export-swapped", "1");
      el.src = "/avatar-placeholder.png";
    }
  }

  return () => {
    for (const { el, src } of originals) {
      if (el.getAttribute("data-export-swapped") === "1") {
        el.removeAttribute("data-export-swapped");
        el.src = src;
      }
    }
  };
}

async function exportWithFallback(node: HTMLElement, filename: string, pixelRatio = 2) {
  // Try PNG->Blob first; if it fails, try dataURL (toPng) and convert to Blob
  try {
    const blob = await htmlToImage.toBlob(node, {
      pixelRatio,
      backgroundColor: "#ffffff",
      cacheBust: true,
      imagePlaceholder: transparentPx,
      style: {
        width: getComputedStyle(node).width,
        height: getComputedStyle(node).height,
      } as Partial<CSSStyleDeclaration>,
      filter: (n: any) => n?.dataset?.hideInExport === undefined,
    });
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      return;
    }
    throw new Error("toBlob returned null");
  } catch {
    // fallback: toPng (data URL) then fetch->blob (works better in some browsers)
    const dataUrl = await htmlToImage.toPng(node, {
      pixelRatio,
      backgroundColor: "#ffffff",
      cacheBust: true,
      imagePlaceholder: transparentPx,
      style: {
        width: getComputedStyle(node).width,
        height: getComputedStyle(node).height,
      } as Partial<CSSStyleDeclaration>,
      filter: (n: any) => n?.dataset?.hideInExport === undefined,
    });
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
}

function monthName(m: number) {
  return [
    "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
    "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
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
  if (first) return first.toUpperCase();     // ← show FIRST name only
  const last = (p.lastName ?? "").trim();
  return `${first} ${last}`.trim().toUpperCase();
}

function fmtMonthDay(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

async function waitForImg(img: HTMLImageElement, timeout = 8000) {
  return new Promise<boolean>((resolve) => {
    if (img.complete && img.naturalWidth > 0) return resolve(true);
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      img.removeEventListener("load", onload);
      img.removeEventListener("error", onerror);
      clearTimeout(to);
      resolve(true);
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
  // warm per-card background
  await new Promise((r) => {
    const bg = new window.Image();
    bg.crossOrigin = "anonymous";
    bg.onload = () => r(null);
    bg.onerror = () => r(null);
    bg.src = "/bday_bg.png";
    setTimeout(() => r(null), 1200);
  });
}

type ExportPreset = "fast-jpeg" | "high-png";

export default function BirthdayMonthClient({
  departmentId,
  initialMonth,
  people,
}: {
  departmentId: string;
  initialMonth: number;
  people: Person[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [showDates, setShowDates] = useState<boolean>(false);
  const [showHeader, setShowHeader] = useState<boolean>(true);
  const [showWatermark, setShowWatermark] = useState<boolean>(true);
  const [density, setDensity] = useState<number>(3); // 1..5 -> bigger..smaller cards
  const [exporting, setExporting] = useState(false);

  const boardRef = useRef<HTMLDivElement>(null);
  const monthParam = searchParams.get("month");
  const month = Number.isFinite(Number(monthParam)) ? Number(monthParam) : initialMonth;
  const headsParam = searchParams.get("heads");
  const headsFilter: HeadsFilter = headsParam === "heads-only" ? "heads-only" : "all";

  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [showExcluded, setShowExcluded] = useState(false);
  const excludedPeople = useMemo(
    () => people.filter(p => excluded.has(p.id)),
    [people, excluded]
  );

  function toggleInclude(id: string) {
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const [cardPerson, setCardPerson] = useState<Person | null>(null);
  const openCardFor = (p: Person) => setCardPerson(p);
  const closeCard = () => setCardPerson(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(SHOW_DATES_STORAGE_KEY);
    if (stored !== null) {
      setShowDates(stored === "true");
    }
  }, []);

  const handleToggleShowDates = useCallback((value: boolean) => {
    setShowDates(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SHOW_DATES_STORAGE_KEY, value ? "true" : "false");
    }
  }, []);

  const onHeadsFilterChange = useCallback((value: HeadsFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("heads");
    } else {
      params.set("heads", "heads-only");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [router, pathname, searchParams]);





  // Responsive grid based on density
  const gridClass = useMemo(() => {
    // density 1 = large cards, 5 = tiny
    const map = [
      "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
      "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
      "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7",
      "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8",
      "grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10",
    ];
    return `grid ${map[Math.min(4, Math.max(0, density - 1))]} gap-2.5 sm:gap-3`;
  }, [density]);

  // Filter + sort
  const celebrants = useMemo(() => {
    return people
      .filter((p) => {
        const d = safeDate(p.birthday);
        return d && d.getMonth() === month;
      })
      .filter((p) => (headsFilter === "all" ? true : p.isHead))
      .sort((a, b) => {
        const da = safeDate(a.birthday)!;
        const db = safeDate(b.birthday)!;
        return da.getDate() - db.getDate();
      });
  }, [people, month, headsFilter]);

  const onChangeMonth = useCallback((m: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", m);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [router, pathname, searchParams]);

  // ---- Export helpers -------------------------------------------------------
  const doExport = useCallback(
    async (preset: ExportPreset) => {
      if (!boardRef.current || exporting) return;
      setExporting(true);

      // preset config
      const isPng = preset === "high-png";
      const filename = `${monthName(month)}_Birthday_Celebrants.${isPng ? "png" : "jpg"}`;
      let pixelRatio = isPng ? 2 : 1.25; // faster & lighter for JPEG
      const jpegQuality = 0.85;

      try {
        await toastProgress(async (progress) => {
          const node = boardRef.current!;

          // hide UI
          const hidden: HTMLElement[] = [];
          node.querySelectorAll<HTMLElement>("[data-hide-in-export]").forEach((el) => {
            if (getComputedStyle(el).visibility !== "hidden") {
              el.style.visibility = "hidden";
              hidden.push(el);
            }
          });

          // we will optionally swap risky images if needed
          let restoreSwaps: (() => void) | null = null;

          try {
            progress.set(8);
            progress.label("Preparing…");
            if ((document as any).fonts?.ready) await (document as any).fonts.ready;

            // preloading: do full preload for PNG (highest fidelity); light for JPEG
            if (isPng) {
              await preloadBoardAssets(node);
            } else {
              // light preload: images only, shorter timeout
              const imgs = Array.from(node.querySelectorAll("img")) as HTMLImageElement[];
              await Promise.allSettled(
                imgs.map((img) => new Promise((r) => {
                  if (img.complete && img.naturalWidth > 0) return r(null);
                  img.onload = () => r(null);
                  img.onerror = () => r(null);
                  setTimeout(() => r(null), 2000);
                }))
              );
            }

            progress.set(60);
            progress.label(isPng ? "Encoding PNG…" : "Encoding JPEG…");

            // inner helper to save a dataURL/Blob
            const saveBlob = async (blob: Blob) => {
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = filename; // extension matches preset
              document.body.appendChild(a);
              a.click();
              a.remove();
              setTimeout(() => URL.revokeObjectURL(url), 1500);
            };

            const runExport = async () => {
              if (isPng) {
                // Always a PNG (dataURL -> blob with image/png)
                const dataUrl = await htmlToImage.toPng(node, {
                  pixelRatio,
                  backgroundColor: "#ffffff",
                  cacheBust: true,
                  imagePlaceholder: transparentPx,
                  style: {
                    width: getComputedStyle(node).width,
                    height: getComputedStyle(node).height,
                  } as Partial<CSSStyleDeclaration>,
                  filter: (n: any) => n?.dataset?.hideInExport === undefined,
                });
                const res = await fetch(dataUrl);
                const blob = await res.blob(); // type image/png
                await saveBlob(blob);
              } else {
                // True JPEG
                const dataUrl = await htmlToImage.toJpeg(node, {
                  pixelRatio,
                  quality: jpegQuality,
                  backgroundColor: "#ffffff",
                  cacheBust: true,
                  imagePlaceholder: transparentPx,
                  style: {
                    width: getComputedStyle(node).width,
                    height: getComputedStyle(node).height,
                  } as Partial<CSSStyleDeclaration>,
                  filter: (n: any) => n?.dataset?.hideInExport === undefined,
                });
                const res = await fetch(dataUrl);
                const blob = await res.blob(); // type image/jpeg
                await saveBlob(blob);
              }
            };

            try {
              await runExport();
            } catch {
              // likely CORS — swap only risky images to placeholder then retry
              restoreSwaps = swapUninlineableImages(node);
              try {
                await runExport();
              } catch {
                // maybe memory — try a smaller ratio once
                pixelRatio = isPng ? 1.5 : 1.1;
                await runExport();
              }
            }

            progress.set(96);
            progress.label("Saving…");
          } finally {
            if (restoreSwaps) restoreSwaps();
            document.querySelectorAll<HTMLElement>("[data-hide-in-export]").forEach((el) => {
              el.style.visibility = "";
            });
          }
        }, {
          loading: "Processing…",
          success: "Export complete",
          error: "Export failed. Please try again.",
          autoTick: { start: 5, max: 88, step: 2, intervalMs: 120 },
        });
      } finally {
        setExporting(false);
      }
    },
    [exporting, month]
  );

  // --------------------------------------------------------------------------

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-3">
      {/* Sticky Controls */}
      <div
        className={cn(
          "z-30 sticky top-0 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60",
          "border-b px-3 py-2 sm:px-4"
        )}
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExcluded(true)}
              data-hide-in-export
              disabled={excludedPeople.length === 0}
              title="View and restore excluded celebrants"
            >
              Show excluded ({excludedPeople.length})
            </Button>


            <div className="text-xs sm:text-sm text-muted-foreground ml-1">
              {celebrants.length} celebrant{celebrants.length === 1 ? "" : "s"}
            </div>
          </div>

          <div className="flex items-center gap-2" data-hide-in-export>
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium text-muted-foreground">Heads:</span>
              <Select
                value={headsFilter}
                onValueChange={(value) => onHeadsFilterChange(value as HeadsFilter)}
              >
                <SelectTrigger className="h-8 w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="heads-only">Heads only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings2 className="mr-2 h-4 w-4" />
                  Options
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Show dates on cards</span>
                    <Switch checked={showDates} onCheckedChange={handleToggleShowDates} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Show header</span>
                    <Switch checked={showHeader} onCheckedChange={setShowHeader} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Show watermark</span>
                    <Switch checked={showWatermark} onCheckedChange={setShowWatermark} />
                  </div>
                  <div>
                    <div className="mb-2 text-sm">Grid density</div>
                    <Slider
                      value={[density]}
                      onValueChange={(v) => setDensity(v[0] ?? 3)}
                      min={1}
                      max={5}
                      step={1}
                    />
                    <div className="mt-1 text-xs text-muted-foreground">
                      {density === 1 ? "Large cards" : density === 5 ? "Compact cards" : "Balanced"}
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              onClick={() => doExport("fast-jpeg")}
              variant="outline"
              size="sm"
              disabled={exporting}
            >
              <Download className="h-4 w-4 mr-2" />
              {exporting ? "Exporting…" : "Fast JPEG"}
            </Button>

            <Button
              onClick={() => doExport("high-png")}
              size="sm"
              disabled={exporting}
            >
              <Download className="h-4 w-4 mr-2" />
              {exporting ? "Exporting…" : "High PNG"}
            </Button>
          </div>
        </div>
      </div>

      {/* Board */}
      <div
        ref={boardRef}
        className={cn(
          "rounded-2xl border shadow-sm p-3 sm:p-4",
          "bg-white bg-center bg-cover"
        )}
        style={{ backgroundImage: "url('')" }}
      >
        {/* Header */}
        {showHeader && (
          <div className="text-center space-y-1.5 sm:space-y-2 mb-4 sm:mb-6">
            <div
              className={cn("text-7xl md:text-8xl lg:text-9xl font-black tracking-wide leading-none")}
              style={{
                letterSpacing: "0.06em",
                backgroundImage: "linear-gradient(90deg, #7e22ce 0%, #db2777 50%, #f59e0b 100%)",
                WebkitBackgroundClip: "text",
                color: "transparent",
                textShadow: "0 1px 0 rgba(255,255,255,0.35)",
              }}
            >
              {monthName(month)}
            </div>
            <div className="text-3xl md:text-4xl lg:text-5xl font-extrabold uppercase" style={{ letterSpacing: "0.045em" }}>
              Birthday <span className="lowercase font-black">celebrators</span>
            </div>
          </div>
        )}

        {/* Grid */}
        {celebrants.length > 0 ? (
          <div className={gridClass}>
            {celebrants
              .filter(p => !excluded.has(p.id))   // <- hides excluded from the list
              .map((p) => {
                const d = safeDate(p.birthday)!;
                const name = displayName(p);

                return (
                  <div
                    key={p.id}
                    className="relative rounded-xl border bg-white/80 overflow-hidden hover:shadow-md transition"
                  >
                    {/* Photo wrapper: make it clickable */}
                    <div
                      className="relative w-full aspect-square bg-center bg-cover cursor-pointer"
                      style={{ backgroundImage: "url('/bday_bg.png')" }}
                      onClick={() => openCardFor(p)}        // <-- CLICK opens the modal
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter") openCardFor(p); }}
                    >
                      {/* Include/Exclude toggle (editor-only) */}
                      {excluded.has(p.id) && (
                        <div className="absolute top-2 right-2 text-[10px] rounded bg-yellow-100 text-yellow-900 px-1.5 py-0.5 border border-yellow-200">
                          Excluded
                        </div>
                      )}
                      <div className="absolute top-2 left-2 z-10" data-hide-in-export>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleInclude(p.id); }}  // don't open modal
                          className={cn(
                            "text-[11px] rounded px-2 py-0.5 border shadow-sm",
                            excluded.has(p.id)
                              ? "bg-white/90 text-red-600 border-red-200"
                              : "bg-white/90 text-emerald-700 border-emerald-200"
                          )}
                          title={excluded.has(p.id) ? "Excluded (click to include)" : "Included (click to exclude)"}
                        >
                          {excluded.has(p.id) ? "Excluded" : "Included"}
                        </button>
                      </div>

                      {/* Image */}
                      {p.imageUrl ? (
                        <NextImage
                          key={`${p.id}-${p.imageUrl ?? "none"}`}
                          src={p.imageUrl ?? "/avatar-placeholder.png"}
                          unoptimized
                          referrerPolicy="no-referrer"
                          alt={name}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                          className="object-cover"
                          crossOrigin="anonymous"
                          loading="eager"
                          onError={(e) => { try { (e.currentTarget as any).src = "/avatar-placeholder.png"; } catch { } }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80">
                          <span className="text-5xl font-black text-gray-300 select-none">
                            {name.slice(0, 1) || "?"}
                          </span>
                        </div>
                      )}

                      {showDates && (
                        <div className="absolute top-2 right-2">
                          <div className="rounded-md bg-white/95 text-pink-700 border border-pink-200 px-2 py-0.5 text-xs font-extrabold shadow-sm">
                            {fmtMonthDay(d)}
                          </div>
                        </div>
                      )}

                      {/* NAME BAR */}
                      <div className="absolute inset-x-0 bottom-0">
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

        {showWatermark && (
          <div className="mt-3 text-[10px] text-muted-foreground text-center print:hidden">
            Auto-generated from HRPS • {new Date().getFullYear()}
          </div>
        )}
      </div>

      <Dialog open={showExcluded} onOpenChange={setShowExcluded}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Excluded celebrants ({excludedPeople.length})</DialogTitle>
          </DialogHeader>

          {excludedPeople.length === 0 ? (
            <div className="text-sm text-muted-foreground">No one is excluded.</div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {excludedPeople.map(p => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 rounded border px-2 py-1"
                  >
                    <Badge variant="secondary" className="font-mono">{p.id.slice(0, 6)}</Badge>
                    <span className="text-sm">
                      {(p.nickname?.trim() || p.firstName).toUpperCase()}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleInclude(p.id)}
                    >
                      Include
                    </Button>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    // include all
                    setExcluded(prev => {
                      const next = new Set(prev);
                      excludedPeople.forEach(p => next.delete(p.id));
                      return next;
                    });
                    setShowExcluded(false);
                  }}
                >
                  Include all
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!cardPerson} onOpenChange={(o) => !o && closeCard()}>
        <DialogContent className="max-w-[720px]">
          {cardPerson && (
            <div className="w-full flex justify-center">
              <BirthdayGreetingCard
                person={{
                  id: cardPerson.id,
                  firstName: cardPerson.firstName,
                  lastName: cardPerson.lastName,
                  nickname: cardPerson.nickname,
                  imageUrl: cardPerson.imageUrl,
                  middleName: cardPerson.middleName,
                  suffix: cardPerson.suffix,
                  prefix: cardPerson.prefix,
                }}

              />
            </div>
          )}
        </DialogContent>
      </Dialog>


      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          .print\\:hidden { display: none !important; }
          header, nav, footer { display: none !important; }
        }
      `}</style>
    </div>
  );
}
