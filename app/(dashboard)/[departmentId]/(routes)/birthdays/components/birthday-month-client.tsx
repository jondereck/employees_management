"use client";

import {
  useMemo,
  useRef,
  useState,
  useCallback,
  useEffect,
  type CSSProperties,
} from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import NextImage from "next/image";
import * as htmlToImage from "html-to-image";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { toastProgress } from "@/lib/linear-progress";
import { Download, Calendar, Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import {
  AUTO_THEME_ID,
  birthdayThemeOptions,
  createThemeStyle,
  getAutoThemeId,
  isBirthdayThemeId,
  isBirthdayThemeMode,
  resolveBirthdayTheme,
  type BirthdayTheme,
  type BirthdayThemeId,
  type BirthdayThemeMode,
} from "@/themes/birthdays";

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
const THEME_STORAGE_KEY = "birthdays.themeMode";
const EXPORT_SAFE_STORAGE_KEY = "birthdays.exportSafe";
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

function clamp01(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  if (![3, 6].includes(normalized.length)) return hex;
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;

  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);

  if ([r, g, b].some((channel) => Number.isNaN(channel))) return hex;

  return `rgba(${r}, ${g}, ${b}, ${clamp01(alpha)})`;
}

function getWatermarkOpacity(theme: BirthdayTheme, exportSafe: boolean) {
  const base = clamp01(theme.watermarkOpacity ?? 0.05);
  return exportSafe ? clamp01(base * 0.7) : base;
}

function buildOrnamentStyle(
  themeId: BirthdayThemeId,
  theme: BirthdayTheme,
  exportSafe: boolean
): CSSProperties | null {
  if (exportSafe || !theme.ornament || theme.ornament === "none") {
    return null;
  }

  const accent = theme.accentColor;
  const soft = theme.accentSoftColor ?? theme.accentColor;

  switch (theme.ornament) {
    case "confetti":
      return {
        backgroundImage: `radial-gradient(circle at 12% 16%, ${hexToRgba(soft, 0.28)} 0, transparent 55%),
          radial-gradient(circle at 78% 18%, ${hexToRgba(accent, 0.2)} 0, transparent 60%),
          radial-gradient(circle at 26% 78%, rgba(255, 255, 255, 0.18) 0, transparent 58%),
          radial-gradient(circle at 68% 64%, ${hexToRgba(accent, 0.18)} 0, transparent 55%)`,
        backgroundSize: "180% 180%, 210% 210%, 200% 200%, 190% 190%",
        backgroundRepeat: "no-repeat",
        mixBlendMode: "screen",
        opacity: 0.38,
      } satisfies CSSProperties;
    case "snow":
      if (themeId === "rainy-season") {
        return {
          backgroundImage: `linear-gradient(180deg, ${hexToRgba(accent, 0.18)} 0%, transparent 70%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, transparent 80%)`,
          backgroundSize: "8px 28px, 12px 34px",
          backgroundRepeat: "repeat",
          backgroundPosition: "0 0, 12px 8px",
          mixBlendMode: "screen",
          opacity: 0.32,
        } satisfies CSSProperties;
      }
      return {
        backgroundImage: `radial-gradient(circle, rgba(255, 255, 255, 0.38) 0, transparent 65%),
          radial-gradient(circle at 22% 12%, rgba(255, 255, 255, 0.25) 0, transparent 60%),
          radial-gradient(circle at 72% 32%, ${hexToRgba(soft, 0.25)} 0, transparent 62%)`,
        backgroundSize: "160px 160px, 220px 220px, 260px 260px",
        backgroundPosition: "0 0, 40px 60px, -30px 90px",
        backgroundRepeat: "repeat",
        mixBlendMode: "screen",
        opacity: 0.32,
      } satisfies CSSProperties;
    case "stars":
      return {
        backgroundImage: `radial-gradient(circle at 10% 20%, rgba(255, 255, 255, 0.25) 0, transparent 55%),
          radial-gradient(circle at 78% 68%, ${hexToRgba(accent, 0.2)} 0, transparent 60%),
          radial-gradient(circle at 42% 82%, rgba(255, 255, 255, 0.18) 0, transparent 58%)`,
        backgroundSize: "200% 200%, 220% 220%, 240% 240%",
        backgroundRepeat: "no-repeat",
        mixBlendMode: "screen",
        opacity: 0.36,
      } satisfies CSSProperties;
    case "leaves":
      return {
        backgroundImage: `radial-gradient(circle at 18% 24%, ${hexToRgba(soft, 0.28)} 0, transparent 52%),
          radial-gradient(circle at 72% 68%, ${hexToRgba(accent, 0.24)} 0, transparent 58%),
          linear-gradient(135deg, ${hexToRgba(accent, 0.12)} 25%, transparent 25%),
          linear-gradient(225deg, ${hexToRgba(soft, 0.12)} 25%, transparent 25%)`,
        backgroundSize: "160% 160%, 200% 200%, 60px 60px, 60px 60px",
        backgroundPosition: "0 0, 30px 60px, 0 0, 30px 30px",
        backgroundRepeat: "repeat",
        mixBlendMode: "soft-light",
        opacity: 0.3,
      } satisfies CSSProperties;
    case "bats":
      return {
        backgroundImage: `radial-gradient(circle at 16% 24%, rgba(255, 255, 255, 0.22) 0, transparent 58%),
          radial-gradient(circle at 74% 74%, ${hexToRgba(accent, 0.28)} 0, transparent 58%),
          radial-gradient(circle at 46% 86%, rgba(255, 255, 255, 0.16) 0, transparent 55%)`,
        backgroundSize: "200% 200%, 220% 220%, 240% 240%",
        backgroundRepeat: "no-repeat",
        mixBlendMode: "screen",
        opacity: 0.32,
      } satisfies CSSProperties;
    case "bunting":
      return {
        backgroundImage: `linear-gradient(135deg, ${hexToRgba(accent, 0.32)} 25%, transparent 25%),
          linear-gradient(225deg, ${hexToRgba(theme.accentSoftColor ?? theme.accentColor, 0.32)} 25%, transparent 25%)`,
        backgroundSize: "90px 90px, 90px 90px",
        backgroundPosition: "0 0, 45px 0",
        backgroundRepeat: "repeat",
        mixBlendMode: "soft-light",
        opacity: 0.4,
      } satisfies CSSProperties;
    default:
      return null;
  }
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

  const monthParam = searchParams.get("month");
  const month = Number.isFinite(Number(monthParam)) ? Number(monthParam) : initialMonth;
  const headsParam = searchParams.get("heads");
  const headsFilter: HeadsFilter = headsParam === "heads-only" ? "heads-only" : "all";
  const themeParamRaw = searchParams.get("theme");
  const searchThemeMode = isBirthdayThemeMode(themeParamRaw)
    ? (themeParamRaw as BirthdayThemeMode)
    : null;
  const exportSafeParam = searchParams.get("exportSafe");

  const [showDates, setShowDates] = useState<boolean>(false);
  const [showHeader, setShowHeader] = useState<boolean>(true);
  const [showWatermark, setShowWatermark] = useState<boolean>(true);
  const [density, setDensity] = useState<number>(3); // 1..5 -> bigger..smaller cards
  const [exporting, setExporting] = useState(false);

  const [themeMode, setThemeModeState] = useState<BirthdayThemeMode>(() => {
    if (searchThemeMode) return searchThemeMode;
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (isBirthdayThemeMode(stored)) {
        return stored as BirthdayThemeMode;
      }
    }
    return AUTO_THEME_ID;
  });

  const [exportSafe, setExportSafeState] = useState<boolean>(() => {
    if (exportSafeParam === "1") return true;
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(EXPORT_SAFE_STORAGE_KEY);
      if (stored === "1") return true;
      if (stored === "0") return false;
    }
    const initialTheme = resolveBirthdayTheme(searchThemeMode ?? AUTO_THEME_ID, month).theme;
    return initialTheme.exportSafeDefaults ?? false;
  });

  const boardRef = useRef<HTMLDivElement>(null);
  const themeModeRef = useRef(themeMode);
  const exportSafeRef = useRef(exportSafe);

  useEffect(() => {
    themeModeRef.current = themeMode;
  }, [themeMode]);

  useEffect(() => {
    exportSafeRef.current = exportSafe;
  }, [exportSafe]);

  const commitUrlState = useCallback(
    (nextTheme: BirthdayThemeMode, nextExportSafe: boolean) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextTheme === AUTO_THEME_ID) {
        params.delete("theme");
      } else {
        params.set("theme", nextTheme);
      }
      if (nextExportSafe) {
        params.set("exportSafe", "1");
      } else {
        params.delete("exportSafe");
      }
      const nextQuery = params.toString();
      const currentQuery = searchParams.toString();
      if (nextQuery === currentQuery) return;
      const url = nextQuery ? `${pathname}?${nextQuery}` : pathname;
      router.replace(url, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const updateThemeMode = useCallback(
    (value: BirthdayThemeMode, options?: { persist?: boolean }) => {
      setThemeModeState(value);
      themeModeRef.current = value;
      if (options?.persist === false) return;
      commitUrlState(value, exportSafeRef.current);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(THEME_STORAGE_KEY, value);
      }
    },
    [commitUrlState]
  );

  const updateExportSafe = useCallback(
    (value: boolean, options?: { persist?: boolean }) => {
      setExportSafeState(value);
      exportSafeRef.current = value;
      if (options?.persist === false) return;
      commitUrlState(themeModeRef.current, value);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(EXPORT_SAFE_STORAGE_KEY, value ? "1" : "0");
      }
    },
    [commitUrlState]
  );

  useEffect(() => {
    if (!searchThemeMode) return;
    if (searchThemeMode !== themeModeRef.current) {
      updateThemeMode(searchThemeMode);
    }
  }, [searchThemeMode, updateThemeMode]);

  useEffect(() => {
    if (exportSafeParam === null) return;
    const shouldBe = exportSafeParam === "1";
    if (shouldBe !== exportSafeRef.current) {
      updateExportSafe(shouldBe);
    }
  }, [exportSafeParam, updateExportSafe]);

  const { id: activeThemeId, theme: activeTheme } = useMemo(
    () => resolveBirthdayTheme(themeMode, month),
    [themeMode, month]
  );

  const themeStyles = useMemo(
    () => createThemeStyle(activeTheme, exportSafe),
    [activeTheme, exportSafe]
  );

  const ornamentStyles = useMemo(
    () => buildOrnamentStyle(activeThemeId, activeTheme, exportSafe),
    [activeThemeId, activeTheme, exportSafe]
  );

  const themeLabel = themeMode === AUTO_THEME_ID ? `Auto • ${activeTheme.label}` : activeTheme.label;
  const headingFontFamily = activeTheme.headingFont ?? "'Bebas Neue', 'Oswald', 'Impact', 'Arial Black', sans-serif";
  const watermarkText = activeTheme.watermarkText ?? monthName(month);
  const watermarkOpacity = getWatermarkOpacity(activeTheme, exportSafe);

  const accentTextColor = activeTheme.accentTextColor ?? "#0f172a";

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

  const handleThemeModeChange = useCallback(
    (value: string) => {
      if (!value) return;
      if (value === AUTO_THEME_ID || isBirthdayThemeId(value)) {
        updateThemeMode(value as BirthdayThemeMode);
      }
    },
    [updateThemeMode]
  );





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

      const previousExportSafe = exportSafeRef.current;
      const temporarilyEnabled = !previousExportSafe;
      if (temporarilyEnabled) {
        updateExportSafe(true, { persist: false });
      }

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
        if (temporarilyEnabled) {
          updateExportSafe(previousExportSafe, { persist: false });
        }
        setExporting(false);
      }
    },
    [exporting, month, updateExportSafe]
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
              <PopoverContent align="end" className="w-[320px]">
                <div className="space-y-4">
                  <div className="space-y-3">
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
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="mb-2 text-sm font-medium text-muted-foreground">Theme</div>
                      <ToggleGroup
                        type="single"
                        value={themeMode}
                        onValueChange={handleThemeModeChange}
                        variant="outline"
                        size="sm"
                        className="flex flex-wrap gap-1.5"
                      >
                        {birthdayThemeOptions.map((option) => (
                          <ToggleGroupItem
                            key={option.id}
                            value={option.id}
                            className="justify-start whitespace-nowrap px-2 py-1 text-xs font-medium"
                          >
                            {option.label}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Export-safe (High-contrast)</span>
                      <Switch checked={exportSafe} onCheckedChange={(value) => updateExportSafe(value)} />
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-sm font-medium text-muted-foreground">Grid density</div>
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
          "relative overflow-hidden rounded-3xl border p-3 sm:p-5 transition-all",
          exportSafe
            ? "shadow-[var(--bday-board-shadow-safe,_0_18px_32px_rgba(15,23,42,0.18))]"
            : "shadow-[var(--bday-board-shadow,_0_26px_48px_rgba(15,23,42,0.28))]"
        )}
        style={{
          ...(themeStyles as CSSProperties),
          background: "var(--bday-bg, linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%))",
          borderColor: "var(--bday-border, rgba(148,163,184,0.35))",
          color: "var(--bday-foreground, inherit)",
        }}
      >
        {ornamentStyles && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
            style={ornamentStyles}
          />
        )}
        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-end gap-2" data-hide-in-export>
            <Badge
              variant="outline"
              className="border-transparent px-2.5 py-0.5 text-xs font-semibold tracking-wide"
              style={{
                background: "var(--bday-badge-bg, rgba(255,255,255,0.85))",
                color: "var(--bday-badge-color, #0f172a)",
                boxShadow: "0 6px 14px rgba(15, 23, 42, 0.18)",
                backdropFilter: "blur(4px)",
              }}
            >
              {themeLabel}
            </Badge>
            {exportSafe && (
              <Badge variant="outline" className="px-2.5 py-0.5 text-xs font-semibold">
                Export-safe
              </Badge>
            )}
          </div>

          {showHeader && (
            <div className="text-center space-y-1.5 sm:space-y-2">
              <div
                className="text-7xl md:text-8xl lg:text-9xl font-black leading-none"
                style={{
                  letterSpacing: "0.08em",
                  fontFamily: headingFontFamily,
                  backgroundImage:
                    activeTheme.headerStyle === "solid"
                      ? undefined
                      : "var(--bday-heading-gradient)",
                  WebkitBackgroundClip:
                    activeTheme.headerStyle === "solid" ? undefined : "text",
                  color:
                    activeTheme.headerStyle === "solid"
                      ? "var(--bday-heading-color, currentColor)"
                      : "transparent",
                  textShadow: "var(--bday-heading-shadow, 0 10px 24px rgba(15,23,42,0.45))",
                }}
              >
                {monthName(month)}
              </div>
              <div
                className="text-3xl md:text-4xl lg:text-5xl font-extrabold uppercase"
                style={{
                  letterSpacing: "0.05em",
                  fontFamily: headingFontFamily,
                  color: "var(--bday-subheading-color, currentColor)",
                }}
              >
                Birthday <span className="lowercase font-black">celebrators</span>
              </div>
            </div>
          )}

          {celebrants.length > 0 ? (
            <div className={gridClass}>
              {celebrants
                .filter((p) => !excluded.has(p.id))
                .map((p) => {
                  const d = safeDate(p.birthday)!;
                  const name = displayName(p);

                  return (
                    <div
                      key={p.id}
                      className="relative overflow-hidden rounded-xl border transition-all duration-200 hover:-translate-y-0.5"
                      style={{
                        background: "var(--bday-card-surface, rgba(255,255,255,0.82))",
                        borderColor: "var(--bday-card-border, rgba(148,163,184,0.45))",
                        boxShadow: exportSafe
                          ? "var(--bday-card-shadow-safe, 0 12px 24px rgba(15,23,42,0.22))"
                          : "var(--bday-card-shadow, 0 18px 36px rgba(15,23,42,0.32))",
                      }}
                    >
                      <div
                        className="relative w-full aspect-square cursor-pointer overflow-hidden"
                        style={{
                          backgroundImage: exportSafe ? undefined : "url('/bday_bg.png')",
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                        onClick={() => openCardFor(p)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") openCardFor(p);
                        }}
                      >
                        <div className="absolute top-2 left-2 z-20 flex flex-col gap-1 items-start">
                          {activeTheme.badge && (
                            <div
                              className="inline-flex items-center justify-center rounded-full px-2 py-1 text-xs font-semibold shadow-sm"
                              style={{
                                background: "var(--bday-badge-bg, rgba(255,255,255,0.85))",
                                color: "var(--bday-badge-color, #0f172a)",
                                backdropFilter: "blur(3px)",
                              }}
                            >
                              {activeTheme.badge}
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleInclude(p.id);
                            }}
                            className={cn(
                              "text-[11px] rounded px-2 py-0.5 border shadow-sm backdrop-blur-sm",
                              excluded.has(p.id)
                                ? "bg-white/85 text-red-600 border-red-200"
                                : "bg-white/80 text-emerald-700 border-emerald-200"
                            )}
                            title={excluded.has(p.id) ? "Excluded (click to include)" : "Included (click to exclude)"}
                            data-hide-in-export
                          >
                            {excluded.has(p.id) ? "Excluded" : "Included"}
                          </button>
                        </div>

                        <div className="absolute top-2 right-2 z-20 flex flex-col items-end gap-1">
                          {excluded.has(p.id) && (
                            <div
                              className="rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                              style={{
                                background: "var(--bday-accent-soft, rgba(248,250,252,0.4))",
                                color: accentTextColor,
                                borderColor: "var(--bday-accent, rgba(148,163,184,0.5))",
                                backdropFilter: "blur(4px)",
                              }}
                            >
                              Excluded
                            </div>
                          )}
                          {showDates && (
                            <div
                              className="rounded-md border px-2 py-0.5 text-xs font-semibold shadow-sm backdrop-blur-sm"
                              style={{
                                background: "var(--bday-accent-soft, rgba(255,255,255,0.8))",
                                color: "var(--bday-accent, #1d4ed8)",
                                borderColor: "var(--bday-accent, rgba(148,163,184,0.5))",
                              }}
                            >
                              {fmtMonthDay(d)}
                            </div>
                          )}
                        </div>

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
                            onError={(e) => {
                              try {
                                (e.currentTarget as any).src = "/avatar-placeholder.png";
                              } catch {}
                            }}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80">
                            <span className="text-5xl font-black text-gray-300 select-none">
                              {name.slice(0, 1) || "?"}
                            </span>
                          </div>
                        )}

                        {showWatermark && (
                          <div
                            className="pointer-events-none absolute inset-0 flex items-center justify-center"
                            style={{
                              zIndex: 5,
                              color: "var(--bday-watermark-color, rgba(255,255,255,0.08))",
                              fontFamily: headingFontFamily,
                              fontSize: "clamp(28px, 7vw, 64px)",
                              fontWeight: 800,
                              letterSpacing: "0.4em",
                              opacity: watermarkOpacity,
                              textTransform: "uppercase",
                              transform: "rotate(-18deg)",
                              mixBlendMode: exportSafe ? "multiply" : "screen",
                              textShadow: "0 1px 3px rgba(0,0,0,0.22)",
                            }}
                          >
                            {watermarkText}
                          </div>
                        )}

                        <div className="absolute inset-x-0 bottom-0">
                          <div
                            className="h-14"
                            style={{
                              background:
                                "var(--bday-namebar-bg, linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.85) 100%))",
                            }}
                          />
                          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center px-2 py-2">
                            <span
                              className="uppercase font-black tracking-[0.18em] text-[clamp(14px,2.4vw,20px)]"
                              style={{
                                color: "var(--bday-namebar-text-color, #ffffff)",
                                textShadow:
                                  "var(--bday-namebar-text-shadow, 0 2px 6px rgba(0,0,0,0.65))",
                                fontFamily: headingFontFamily,
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
            <div
              className="py-8 text-center text-sm text-muted-foreground"
              style={{ color: "var(--bday-subheading-color, var(--bday-foreground, inherit))" }}
            >
              No active birthday celebrants for {monthName(month)}.
            </div>
          )}

          {showWatermark && (
            <div
              className="text-[10px] text-center print:hidden"
              style={{ color: "var(--bday-subheading-color, var(--bday-foreground, inherit))", opacity: 0.8 }}
            >
              Auto-generated from HRPS • {new Date().getFullYear()}
            </div>
          )}
        </div>
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
