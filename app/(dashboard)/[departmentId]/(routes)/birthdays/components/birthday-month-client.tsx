"use client";

import { useMemo, useRef, useState, useCallback, useEffect, CSSProperties } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import NextImage from "next/image";
import * as htmlToImage from "html-to-image";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getMonthDayInTimeZone } from "@/lib/birthday";
import { toast } from "sonner";
import { toastProgress } from "@/lib/linear-progress";
import { Bold, Copy, Download, Calendar, Settings2, Share2, EyeOff, ImageIcon, FileImage, ExternalLink, Italic, Wand2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

import BirthdayGreetingCard from "./birthday-greetting-card";
import {
  birthdayThemeOrder,
  birthdayThemes,
  BirthdayThemeMode,
  BirthdayThemeId,
  BirthdayTheme,
  getAutoTheme,
} from "@/themes/birthdays";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";




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
  officeName?: string | null;
  isHead: boolean;
};

const SHOW_DATES_STORAGE_KEY = "birthdays.showDates";
const THEME_MODE_STORAGE_KEY = "birthdays.themeMode";
const EXPORT_SAFE_STORAGE_KEY = "birthdays.exportSafe";
const FACEBOOK_BUSINESS_POSTS_URL = "https://business.facebook.com/latest/posts/";
const BOLD_UPPER_START = 0x1d400;
const BOLD_LOWER_START = 0x1d41a;
const BOLD_DIGIT_START = 0x1d7ce;
const ITALIC_UPPER_START = 0x1d434;
const ITALIC_LOWER_START = 0x1d44e;

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

function titleCaseMonth(m: number) {
  return new Date(2000, m).toLocaleDateString(undefined, { month: "long" });
}

function clampMonthIndex(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(11, Math.max(0, Math.trunc(parsed)));
}

function isHrmoOfficeName(value?: string | null) {
  const normalized = (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return [
    "human resource management office",
    "human resources management office",
    "hrmo",
    "human resource office",
  ].some((key) => normalized.includes(key));
}

function isSpecialCelebrant(person: Person) {
  return person.isHead || isHrmoOfficeName(person.officeName);
}

async function copyText(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  document.body.removeChild(textArea);
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.rel = "noopener";
  link.style.position = "fixed";
  link.style.top = "-9999px";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function styleChar(char: string, style: "bold" | "italic") {
  const code = char.codePointAt(0);
  if (code == null) return char;

  if (code >= 65 && code <= 90) {
    return String.fromCodePoint((style === "bold" ? BOLD_UPPER_START : ITALIC_UPPER_START) + code - 65);
  }

  if (code >= 97 && code <= 122) {
    return String.fromCodePoint((style === "bold" ? BOLD_LOWER_START : ITALIC_LOWER_START) + code - 97);
  }

  if (style === "bold" && code >= 48 && code <= 57) {
    return String.fromCodePoint(BOLD_DIGIT_START + code - 48);
  }

  return char;
}

function styleText(value: string, style: "bold" | "italic") {
  return Array.from(value).map((char) => styleChar(char, style)).join("");
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

function isThemeId(value: string): value is BirthdayThemeId {
  return value in birthdayThemes;
}

function ornamentStyle(ornament: string): CSSProperties {
  switch (ornament) {
    case "confetti":
      return {
        backgroundImage: [
          "radial-gradient(circle at 10% 20%, var(--bday-accent) 0 8%, transparent 12%)",
          "radial-gradient(circle at 70% 15%, var(--bday-accent-2) 0 9%, transparent 14%)",
          "radial-gradient(circle at 30% 70%, var(--bday-ornament-color) 0 10%, transparent 15%)",
          "radial-gradient(circle at 80% 60%, var(--bday-ornament-alt) 0 8%, transparent 12%)",
        ].join(","),
        backgroundSize: "180px 180px, 200px 200px, 220px 220px, 200px 200px",
        backgroundRepeat: "repeat",
        opacity: 0.18,
      };
    case "snow":
      return {
        backgroundImage: [
          "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.85) 0 6px, transparent 8px)",
          "radial-gradient(circle at 70% 10%, rgba(255,255,255,0.7) 0 5px, transparent 8px)",
          "radial-gradient(circle at 40% 80%, rgba(255,255,255,0.6) 0 4px, transparent 7px)",
        ].join(","),
        backgroundSize: "160px 160px, 200px 200px, 180px 180px",
        backgroundRepeat: "repeat",
        opacity: 0.18,
      };
    case "stars":
      return {
        backgroundImage: [
          "radial-gradient(circle at 15% 25%, var(--bday-ornament-color) 0 4px, transparent 6px)",
          "radial-gradient(circle at 60% 12%, var(--bday-ornament-alt) 0 3px, transparent 5px)",
          "radial-gradient(circle at 85% 65%, rgba(255,255,255,0.3) 0 2px, transparent 4px)",
        ].join(","),
        backgroundSize: "200px 200px, 220px 220px, 240px 240px",
        backgroundRepeat: "repeat",
        opacity: 0.22,
      };
    case "leaves":
      return {
        backgroundImage: [
          "radial-gradient(ellipse at 20% 20%, var(--bday-ornament-color) 0 12px, transparent 14px)",
          "radial-gradient(ellipse at 70% 40%, var(--bday-ornament-alt) 0 10px, transparent 12px)",
        ].join(","),
        backgroundSize: "220px 220px, 260px 260px",
        backgroundRepeat: "repeat",
        opacity: 0.18,
      };
    case "bats":
      return {
        backgroundImage: [
          "radial-gradient(circle at 20% 30%, rgba(15,23,42,0.5) 0 8px, transparent 10px)",
          "radial-gradient(circle at 70% 60%, rgba(88,28,135,0.45) 0 9px, transparent 12px)",
          "radial-gradient(circle at 40% 80%, rgba(15,23,42,0.35) 0 6px, transparent 9px)",
        ].join(","),
        backgroundSize: "220px 220px, 260px 260px, 240px 240px",
        backgroundRepeat: "repeat",
        opacity: 0.22,
      };
    case "bunting":
      return {
        backgroundImage: `linear-gradient(135deg, transparent 0 45%, var(--bday-accent) 45% 55%, transparent 55%)`,
        backgroundRepeat: "repeat-x",
        backgroundSize: "120px 120px",
        opacity: 0.28,
        transform: "translateY(-10px)",
      };
    case "raindrops":
      return {
        backgroundImage: "radial-gradient(circle at 10% 10%, rgba(255,255,255,0.25) 0 3px, transparent 4px)",
        backgroundSize: "120px 160px",
        backgroundRepeat: "repeat",
        opacity: 0.22,
      };
    default:
      return {};
  }
}

const OrnamentLayer = ({ ornament, exportSafe }: { ornament: string; exportSafe: boolean }) => {
  if (exportSafe || ornament === "none") return null;
  if (ornament === "bunting") {
    return (
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-24"
        aria-hidden
        style={{
          ...ornamentStyle(ornament),
          backgroundPosition: "center top",
          mixBlendMode: "screen",
        }}
      />
    );
  }
  return (
    <div
      className="pointer-events-none absolute inset-0"
      aria-hidden
      style={{
        ...ornamentStyle(ornament),
        mixBlendMode: ornament === "bats" ? "screen" : "overlay",
      }}
    />
  );
};

async function waitTwoFrames() {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

export default function BirthdayMonthClient({
  departmentId,
  initialMonth,
  currentYear,
  people,
}: {
  departmentId: string;
  initialMonth: number;
  currentYear: number;
  people: Person[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const themeParam = searchParams.get("theme");
  const exportSafeParam = searchParams.get("exportSafe");

  const [themeMode, setThemeMode] = useState<BirthdayThemeMode>(() => {
    if (typeof window === "undefined") return "auto";
    if (themeParam && themeParam !== "auto" && !isThemeId(themeParam)) {
      return "auto";
    }
    if (themeParam === "auto") return "auto";
    if (themeParam && isThemeId(themeParam)) return themeParam;
    const stored = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);
    if (stored && stored === "auto") return "auto";
    if (stored && isThemeId(stored)) return stored;
    return "auto";
  });

  const initialAutoTheme = useMemo(() => getAutoTheme(initialMonth), [initialMonth]);
  const [exportSafe, setExportSafeState] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      const initialTheme = birthdayThemes[initialAutoTheme] as BirthdayTheme | undefined;
      return initialTheme?.exportSafeDefaults ?? false;
    }
    if (exportSafeParam === "1") return true;
    if (exportSafeParam === "0") return false;
    const stored = window.localStorage.getItem(EXPORT_SAFE_STORAGE_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;
    const targetThemeId = themeParam && isThemeId(themeParam) ? themeParam : initialAutoTheme;
    const targetTheme = birthdayThemes[targetThemeId as BirthdayThemeId] as BirthdayTheme | undefined;
    return targetTheme?.exportSafeDefaults ?? false;
  });

  const [showDates, setShowDates] = useState<boolean>(false);
  const [showHeader, setShowHeader] = useState<boolean>(true);
  const [showWatermark, setShowWatermark] = useState<boolean>(true);
  const [density, setDensity] = useState<number>(3); // 1..5 -> bigger..smaller cards
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [monthlyPostOpen, setMonthlyPostOpen] = useState(false);
  const [monthlyCaption, setMonthlyCaption] = useState("");
  const [monthlyPreparedImageUrl, setMonthlyPreparedImageUrl] = useState<string | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);
  const monthlyCaptionRef = useRef<HTMLTextAreaElement>(null);
  const monthParam = searchParams.get("month");
  const month = clampMonthIndex(monthParam, initialMonth);
  const headsParam = searchParams.get("heads");
  const headsFilter: HeadsFilter = headsParam === "heads-only" ? "heads-only" : "all";

  const updateSearchParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const setThemeModePersist = useCallback(
    (mode: BirthdayThemeMode) => {
      setThemeMode(mode);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
      }
      updateSearchParam("theme", mode);
    },
    [updateSearchParam]
  );

  const setExportSafe = useCallback(
    (value: boolean, options?: { persist?: boolean }) => {
      setExportSafeState(value);
      if (options?.persist === false) return;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(EXPORT_SAFE_STORAGE_KEY, value ? "true" : "false");
      }
      updateSearchParam("exportSafe", value ? "1" : null);
    },
    [updateSearchParam]
  );

  useEffect(() => {
    const param = searchParams.get("theme");
    const normalized = param ?? "auto";
    if (normalized !== "auto" && !isThemeId(normalized)) {
      return;
    }
    if (normalized !== themeMode) {
      setThemeMode(normalized as BirthdayThemeMode);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(THEME_MODE_STORAGE_KEY, normalized);
      }
    }
  }, [searchParams, themeMode]);

  useEffect(() => {
    const param = searchParams.get("exportSafe");
    if (param === null) return;
    const next = param === "1";
    if (next !== exportSafe) {
      setExportSafeState(next);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(EXPORT_SAFE_STORAGE_KEY, next ? "true" : "false");
      }
    }
  }, [searchParams, exportSafe]);

  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [showExcluded, setShowExcluded] = useState(false);
  const excludedPeople = useMemo(
    () => people.filter(p => excluded.has(p.id)),
    [people, excluded]
  );

  const resolvedThemeId = themeMode === "auto" ? getAutoTheme(month) : themeMode;
  const resolvedTheme = birthdayThemes[resolvedThemeId as BirthdayThemeId] ?? birthdayThemes[initialAutoTheme];
  const themeCssVariables = useMemo(() => {
    const style: CSSProperties = {};
    const entries = Object.entries(resolvedTheme?.cssVars ?? {}) as Array<[
      string,
      string,
    ]>;
    entries.forEach(([key, value]) => {
      (style as Record<string, string>)[key] = value;
    });
    return style;
  }, [resolvedTheme]);
  const baseBackground = exportSafe
    ? resolvedTheme?.cssVars["--bday-bg-safe"] ?? resolvedTheme?.cssVars["--bday-bg"]
    : resolvedTheme?.cssVars["--bday-bg"];
  const overlayBackground = exportSafe
    ? resolvedTheme?.cssVars["--bday-backdrop-safe"] ?? resolvedTheme?.cssVars["--bday-backdrop"]
    : resolvedTheme?.cssVars["--bday-backdrop"];
  const boardBackground = useMemo(() => {
    const fallback = "var(--bday-bg, linear-gradient(135deg,#111827,#1f2937))";
    const layers: string[] = [];
    if (overlayBackground) {
      layers.push(overlayBackground);
    }
    layers.push(baseBackground ?? fallback);
    return layers.join(",");
  }, [baseBackground, overlayBackground]);
  const headerPrimaryStyle = useMemo(() => {
    if (!resolvedTheme) return {};
    if (resolvedTheme.headerStyle === "solid") {
      return {
        color: resolvedTheme.cssVars["--bday-header-solid"] ?? resolvedTheme.cssVars["--bday-accent"],
        textShadow: "0 1px 0 rgba(0,0,0,0.25)",
      } as CSSProperties;
    }
    return {
      backgroundImage: resolvedTheme.cssVars["--bday-header-gradient"],
      WebkitBackgroundClip: "text",
      color: "transparent",
      textShadow: "0 1px 0 rgba(255,255,255,0.2)",
    } as CSSProperties;
  }, [resolvedTheme]);
  const headerFontFamily = resolvedTheme?.fontFamily;
  const themeOptions = useMemo(() => {
    return birthdayThemeOrder.map((id) => {
      if (id === "auto") {
        const autoThemeId = getAutoTheme(month);
        const autoTheme = birthdayThemes[autoThemeId];
        return {
          id: "auto" as BirthdayThemeMode,
          label: "Auto (By Month)",
          description: autoTheme ? `Matches ${autoTheme.label}` : "Choose the preset for the current month",
          preview: autoTheme?.cssVars["--bday-bg"],
        };
      }
      const theme = birthdayThemes[id];
      return {
        id,
        label: theme.label,
        description: theme.description,
        preview: theme.cssVars["--bday-bg"],
      };
    });
  }, [month]);

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

  const celebrants = useMemo(() => {
    const targetMonth = month + 1;

    return people
      .filter((p) => {
        const monthDay = getMonthDayInTimeZone(p.birthday);
        return monthDay?.month === targetMonth;
      })
      .filter((p) => (headsFilter === "all" ? true : isSpecialCelebrant(p)))
      .sort((a, b) => {
        const aMonthDay = getMonthDayInTimeZone(a.birthday);
        const bMonthDay = getMonthDayInTimeZone(b.birthday);
        if (!aMonthDay || !bMonthDay) return 0;
        return aMonthDay.day - bMonthDay.day;
      });
  }, [people, month, headsFilter]);

  const visibleCelebrants = useMemo(
    () => celebrants.filter((person) => !excluded.has(person.id)),
    [celebrants, excluded]
  );

  useEffect(() => {
    setMonthlyCaption("");
    setMonthlyPreparedImageUrl(null);
  }, [currentYear, headsFilter, month]);

  const onHeadsFilterChange = useCallback((value: HeadsFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("heads");
    } else {
      params.set("heads", "heads-only");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [router, pathname, searchParams]);

  const captureBoardShareImage = useCallback(async () => {
    if (!boardRef.current) {
      toast.error("Unable to locate the birthday board.");
      return null;
    }

    const node = boardRef.current;
    const hidden: HTMLElement[] = [];
    let restoreSwaps: (() => void) | null = null;
    const previousExportSafe = exportSafe;

    try {
      if (!previousExportSafe) {
        setExportSafe(true, { persist: false });
        await waitTwoFrames();
      }

      node.querySelectorAll<HTMLElement>("[data-hide-in-export]").forEach((el) => {
        if (getComputedStyle(el).visibility !== "hidden") {
          el.style.visibility = "hidden";
          hidden.push(el);
        }
      });

      if ((document as any).fonts?.ready) {
        await (document as any).fonts.ready;
      }

      const capture = async () =>
        htmlToImage.toJpeg(node, {
          pixelRatio: 1.4,
          quality: 0.86,
          backgroundColor: "#ffffff",
          cacheBust: true,
          imagePlaceholder: transparentPx,
          style: {
            width: getComputedStyle(node).width,
            height: getComputedStyle(node).height,
          } as Partial<CSSStyleDeclaration>,
          filter: (n: any) => n?.dataset?.hideInExport === undefined,
        });

      try {
        return await capture();
      } catch (error) {
        restoreSwaps = swapUninlineableImages(node);
        return await capture();
      }
    } catch (error) {
      console.error("Failed to prepare share preview", error);
      toast.error("Unable to prepare the birthday board image for sharing.");
      return null;
    } finally {
      hidden.forEach((el) => {
        el.style.visibility = "";
      });
      if (restoreSwaps) {
        restoreSwaps();
      }
      if (!previousExportSafe) {
        setExportSafe(previousExportSafe, { persist: false });
      }
    }
  }, [boardRef, exportSafe, setExportSafe]);

  const handleShareToFacebook = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (visibleCelebrants.length === 0) {
      toast.error("No visible celebrants are available for posting.");
      return;
    }

    setMonthlyPostOpen(true);
  }, [visibleCelebrants.length]);

  const generateMonthlyCaption = useCallback(async () => {
    if (visibleCelebrants.length === 0 || sharing) return;

    try {
      setSharing(true);
      const response = await fetch(`/api/${departmentId}/birthdays/facebook-post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "monthly",
          month,
          year: currentYear,
          theme: resolvedThemeId,
          exportSafe,
          headsFilter,
          excludedIds: Array.from(excluded),
          prepareOnly: true,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(payload?.error || "Unable to prepare the monthly Facebook post.");
        return;
      }

      if (typeof payload?.caption === "string" && payload.caption.trim()) {
        setMonthlyCaption(payload.caption.trim());
        toast.success("Monthly caption generated.");
      } else {
        toast.error("Unable to generate the monthly caption.");
      }
    } catch (error) {
      console.error("Failed to prepare monthly Facebook post", error);
      toast.error("Unable to prepare the monthly Facebook post.");
    } finally {
      setSharing(false);
    }
  }, [
    currentYear,
    departmentId,
    excluded,
    exportSafe,
    headsFilter,
    month,
    resolvedThemeId,
    sharing,
    visibleCelebrants.length,
  ]);

  const copyMonthlyCaption = useCallback(async () => {
    if (!monthlyCaption.trim()) {
      toast.error("Generate or type a monthly caption first.");
      return;
    }

    await copyText(monthlyCaption);
    toast.success("Monthly caption copied.");
  }, [monthlyCaption]);

  const openMonthlyFacebookPost = useCallback(async () => {
    if (!monthlyCaption.trim()) {
      toast.error("Generate or type a monthly caption first.");
      return;
    }

    await copyText(monthlyCaption);
    window.open(FACEBOOK_BUSINESS_POSTS_URL, "_blank", "noopener,noreferrer");
    toast.success("Monthly caption copied. Attach the board image in Business Manager when ready.");
  }, [monthlyCaption]);

  const downloadMonthlyPostImage = useCallback(async () => {
    if (monthlyPreparedImageUrl) {
      downloadDataUrl(monthlyPreparedImageUrl, `${monthName(month)}_${currentYear}_Birthday_Celebrators_Facebook.jpg`);
      return;
    }

    setSharing(true);
    try {
      const shareDataUrl = await captureBoardShareImage();
      if (!shareDataUrl) return;
      setMonthlyPreparedImageUrl(shareDataUrl);
      downloadDataUrl(shareDataUrl, `${monthName(month)}_${currentYear}_Birthday_Celebrators_Facebook.jpg`);
    } finally {
      setSharing(false);
    }
  }, [captureBoardShareImage, currentYear, month, monthlyPreparedImageUrl]);

  const applyMonthlyCaptionStyle = useCallback(
    (style: "bold" | "italic") => {
      const textarea = monthlyCaptionRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      if (start === end) return;

      const selected = monthlyCaption.slice(start, end);
      const replacement = styleText(selected, style);
      const nextCaption = `${monthlyCaption.slice(0, start)}${replacement}${monthlyCaption.slice(end)}`;
      setMonthlyCaption(nextCaption);

      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(start, start + replacement.length);
      });
    },
    [monthlyCaption]
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
      const filename = `${monthName(month)}_${currentYear}_Birthday_Celebrants.${isPng ? "png" : "jpg"}`;
      let pixelRatio = isPng ? 2 : 1.25; // faster & lighter for JPEG
      const jpegQuality = 0.85;

      const previousExportSafe = exportSafe;
      try {
        if (!previousExportSafe) {
          setExportSafe(true, { persist: false });
          await waitTwoFrames();
        }
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
        setExportSafe(previousExportSafe, { persist: false });
        setExporting(false);
      }
    },
    [currentYear, exportSafe, exporting, month, setExportSafe]
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between bg-card p-4 rounded-xl border shadow-sm">
  {/* Left Section: Context & Core Filters */}
  <div className="flex flex-wrap items-center gap-3">
    <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-lg border">
      <Calendar className="h-4 w-4 text-indigo-500" />
      <Select value={String(month)} onValueChange={onChangeMonth}>
        <SelectTrigger className="w-[140px] border-none bg-transparent focus:ring-0 h-7 shadow-none p-0">
          <SelectValue placeholder="Select month" />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 12 }, (_, i) => (
            <SelectItem key={i} value={String(i)}>{monthName(i)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    <div className="h-6 w-[1px] bg-border hidden sm:block" />

    <div className="flex items-center gap-2">
      <Badge variant="secondary" className="px-2 py-1 rounded-md font-medium">
        {celebrants.length} {celebrants.length === 1 ? "Celebrant" : "Celebrants"}
      </Badge>
      
      {excludedPeople.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowExcluded(true)}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
          data-hide-in-export
        >
          <EyeOff className="h-3.5 w-3.5 mr-1.5" />
          Excluded ({excludedPeople.length})
        </Button>
      )}
    </div>
  </div>

  {/* Right Section: Actions & Settings */}
  <div className="flex flex-wrap items-center gap-2" data-hide-in-export>
    {/* Filter Group */}
    <div className="flex items-center bg-muted/50 rounded-lg p-1 border">
      <Button 
        variant={headsFilter === 'all' ? 'secondary' : 'ghost'} 
        size="sm" 
        className="h-7 px-3 text-xs"
        onClick={() => onHeadsFilterChange('all')}
      >
        All
      </Button>
      <Button 
        variant={headsFilter === 'heads-only' ? 'secondary' : 'ghost'} 
        size="sm" 
        className="h-7 px-3 text-xs"
        onClick={() => onHeadsFilterChange('heads-only')}
      >
        Special
      </Button>
    </div>

    {/* Configuration Popover */}
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="shadow-sm">
          <Settings2 className="mr-2 h-4 w-4 text-muted-foreground" />
          Customize
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 shadow-xl border-muted">
        <div className="p-4 border-b bg-muted/30">
          <h4 className="font-semibold text-sm">Board Settings</h4>
          <p className="text-xs text-muted-foreground">Adjust the look and feel of the birthday board.</p>
        </div>
        
        <div className="p-4 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Theme Grid */}
          <div>
            <label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-3 block">Visual Theme</label>
            <div className="grid grid-cols-1 gap-2">
              {themeOptions.map((option) => {
                const isActive = themeMode === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => setThemeModePersist(option.id as BirthdayThemeMode)}
                    className={cn(
                      "group relative flex items-center gap-3 p-2 rounded-lg border transition-all text-left",
                      isActive ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10" : "hover:border-muted-foreground/30"
                    )}
                  >
                    <div 
                      className="h-8 w-8 rounded-md border shadow-sm flex-shrink-0" 
                      style={{ background: option.preview || 'var(--muted)', backgroundSize: 'cover' }}
                    />
                    <div className="flex-1 overflow-hidden">
                      <div className="text-sm font-medium leading-none mb-1">{option.label}</div>
                      <div className="text-xs text-muted-foreground truncate">{option.description}</div>
                    </div>
                    {isActive && <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Export-safe (Print)</label>
              <Switch checked={exportSafe} onCheckedChange={setExportSafe} />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Display Dates</label>
              <Switch checked={showDates} onCheckedChange={handleToggleShowDates} />
            </div>
          </div>

          {/* Density Slider */}
          <div className="pt-2">
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium">Grid Density</label>
              <span className="text-xs text-indigo-600 font-bold uppercase">
                {density === 1 ? "Large" : density === 5 ? "Compact" : "Standard"}
              </span>
            </div>
            <Slider
              value={[density]}
              onValueChange={(v) => setDensity(v[0] ?? 3)}
              min={1}
              max={5}
              step={1}
              className="py-2"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>

    <div className="h-6 w-[1px] bg-border mx-1 hidden sm:block" />

    {/* Export Actions */}
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="default" size="sm" className="bg-indigo-600 hover:bg-indigo-700 shadow-md">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => doExport("fast-jpeg")} disabled={exporting}>
          <ImageIcon className="mr-2 h-4 w-4" /> Fast JPEG
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => doExport("high-png")} disabled={exporting}>
          <FileImage className="mr-2 h-4 w-4" /> High-Res PNG
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleShareToFacebook} disabled={visibleCelebrants.length === 0}>
          <Share2 className="mr-2 h-4 w-4" /> Monthly Facebook Caption
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</div>
      </div>

      {/* Board */}
      <div
        ref={boardRef}
        className={cn(
          "relative rounded-2xl border shadow-lg p-3 sm:p-5 overflow-hidden transition-all",
          exportSafe ? "bg-white/95" : "bg-white/20"
        )}
        style={{
          ...themeCssVariables,
          backgroundImage: boardBackground,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <OrnamentLayer ornament={resolvedTheme?.ornament ?? "none"} exportSafe={exportSafe} />
        <div className="relative z-10">
          {/* Header */}
          {showHeader && (
            <div className="text-center space-y-1.5 sm:space-y-2 mb-4 sm:mb-6">
              <div
                className={cn("text-7xl md:text-8xl lg:text-9xl font-black tracking-wide leading-none")}
                style={{
                  letterSpacing: "0.06em",
                  ...headerPrimaryStyle,
                  fontFamily: headerFontFamily,
                }}
              >
                {monthName(month)}
              </div>
              <div
                className="text-3xl md:text-4xl lg:text-5xl font-extrabold uppercase"
                style={{
                  letterSpacing: "0.045em",
                  color: resolvedTheme?.cssVars["--bday-accent"] ?? "currentColor",
                  fontFamily: headerFontFamily,
                }}
              >
                Birthday CELEBRATORS
              </div>
              <div
                className="text-sm sm:text-base font-semibold uppercase tracking-[0.35em]"
                style={{
                  color: resolvedTheme?.cssVars["--bday-accent-2"] ?? "currentColor",
                  fontFamily: headerFontFamily,
                }}
              >
                {currentYear}
              </div>
            </div>
          )}

          {/* Grid */}
          {celebrants.length > 0 ? (
            <div className={gridClass}>
            {visibleCelebrants.map((p) => {
                const d = safeDate(p.birthday)!;
                const name = displayName(p);

                return (
                  <div
                    key={p.id}
                    className="relative rounded-xl border overflow-hidden hover:shadow-lg transition"
                    style={{
                      backgroundColor: exportSafe
                        ? "rgba(255,255,255,0.95)"
                        : resolvedTheme?.cssVars["--bday-card-bg"] ?? "rgba(255,255,255,0.85)",
                      borderColor: resolvedTheme?.cssVars["--bday-card-border"] ?? "rgba(255,255,255,0.35)",
                    }}
                  >
                    {showWatermark && (
                      <div
                        className="pointer-events-none absolute inset-0"
                        style={{
                          backgroundImage:
                            "repeating-linear-gradient(135deg, var(--bday-watermark-color, rgba(255,255,255,0.04)) 0 18px, transparent 18px 36px)",
                          opacity: exportSafe ? 0.03 : 0.06,
                        }}
                      />
                    )}
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
                            "bg-white/90",
                            excluded.has(p.id)
                              ? "text-red-600 border-red-200"
                              : "border-transparent"
                          )}
                          style={
                            excluded.has(p.id)
                              ? undefined
                              : {
                                  color: resolvedTheme?.cssVars["--bday-accent"] ?? "#047857",
                                  borderColor: resolvedTheme?.cssVars["--bday-card-border"] ?? "rgba(16, 185, 129, 0.35)",
                                }
                          }
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
                          <div
                            className="rounded-md border px-2 py-0.5 text-xs font-extrabold shadow-sm"
                            style={{
                              backgroundColor: exportSafe ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.85)",
                              color: resolvedTheme?.cssVars["--bday-accent-2"] ?? "#be185d",
                              borderColor: resolvedTheme?.cssVars["--bday-card-border"] ?? "rgba(244,114,182,0.35)",
                            }}
                          >
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
                              fontFamily: headerFontFamily,
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
              Auto-generated from HRPS • {currentYear}
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

      <Dialog open={monthlyPostOpen} onOpenChange={setMonthlyPostOpen}>
        <DialogContent className="max-w-[860px]">
          <DialogHeader>
            <DialogTitle>{titleCaseMonth(month)} birthday celebrators post</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
              <div className="text-sm text-muted-foreground">
                {visibleCelebrants.length} visible celebrant{visibleCelebrants.length === 1 ? "" : "s"} for {titleCaseMonth(month)} {currentYear}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={generateMonthlyCaption} disabled={sharing}>
                <Wand2 className="mr-2 h-4 w-4" />
                {sharing ? "Generating..." : monthlyCaption ? "Generate Again" : "Generate Caption"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => applyMonthlyCaptionStyle("bold")}
                title="Bold (Ctrl+B)"
                aria-label="Bold selected text"
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => applyMonthlyCaptionStyle("italic")}
                title="Italic (Ctrl+I)"
                aria-label="Italic selected text"
              >
                <Italic className="h-4 w-4" />
              </Button>
            </div>

            <Textarea
              ref={monthlyCaptionRef}
              value={monthlyCaption}
              onChange={(event) => setMonthlyCaption(event.target.value)}
              onKeyDown={(event) => {
                if (!(event.ctrlKey || event.metaKey)) return;
                const key = event.key.toLowerCase();
                if (key === "b") {
                  event.preventDefault();
                  applyMonthlyCaptionStyle("bold");
                }
                if (key === "i") {
                  event.preventDefault();
                  applyMonthlyCaptionStyle("italic");
                }
              }}
              placeholder="Click Generate Caption or type the monthly Facebook caption here..."
              className="min-h-[360px] resize-none whitespace-pre-wrap text-sm leading-6"
            />

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button type="button" variant="outline" onClick={copyMonthlyCaption}>
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
              <Button type="button" variant="outline" onClick={openMonthlyFacebookPost}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Open
              </Button>
              <Button type="button" onClick={downloadMonthlyPostImage} disabled={sharing}>
                <Download className="mr-2 h-4 w-4" />
                Image
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cardPerson} onOpenChange={(o) => !o && closeCard()}>
        <DialogContent className="max-w-[1120px]">
          {cardPerson && (
            <div className="w-full flex justify-center">
              <BirthdayGreetingCard
                departmentId={departmentId}
                month={month}
                year={currentYear}
                person={{
                  id: cardPerson.id,
                  firstName: cardPerson.firstName,
                  lastName: cardPerson.lastName,
                  nickname: cardPerson.nickname,
                  imageUrl: cardPerson.imageUrl,
                  middleName: cardPerson.middleName,
                  suffix: cardPerson.suffix,
                  prefix: cardPerson.prefix,
                  officeName: cardPerson.officeName,
                  birthday: cardPerson.birthday,
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
