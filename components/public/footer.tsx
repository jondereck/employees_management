"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

type Logo = { src: string; alt: string; width?: number; height?: number; title?: string };
type CreatorEffect = "shimmer" | "glow" | "underline" | "wave" | "sparkle";
type CreatorMode = "text" | "image";

type PublicFooterProps = {
  className?: string;

  // left-side logos + system name
  systemName?: string;
  systemLogo: Logo;
  hrLogo: Logo;
  lguLogo?: Logo;

  // creator
  creatorMode?: CreatorMode; // "text" | "image"
  creatorEffect?: CreatorEffect;
  creatorName?: string;
  creatorLink?: string;
  creatorImage?: { src: string; alt?: string; width?: number; height?: number; href?: string; };

  // layout + theme
  brand?: { c1?: string; c2?: string; c3?: string };
  position?: "fixed" | "static";

  // NEW: density controls
  dense?: boolean;              // compact mobile layout (defaults to true)
  showYearOnMobile?: boolean;   // show © year on xs (defaults to false)

  creatorDelayEnabled?: boolean;  // default true for image mode
  creatorDelayMs?: number;
   creatorHighlight?:
    | { preset: "ring" | "glow" | "pill"; padding?: number; radius?: number }
    | { imageSrc: string; scale?: number; className?: string }; // custom PNG/JPG behind
};

export default function PublicFooter({
  className = "",
  systemName = "HR Profiling System",
  systemLogo,
  hrLogo,
  lguLogo,

  // by request: default to image creator
  creatorMode = "image",
  creatorEffect = "shimmer",
  creatorName = "JDN Systems",
  creatorLink,
  creatorImage, // e.g. { src: "/creator-footer.png", width: 80, height: 18 }

  brand = { c1: undefined, c2: undefined, c3: undefined },
  position = "fixed",

  dense = true,
  showYearOnMobile = false,
  creatorDelayEnabled = true,
  creatorDelayMs = 3000,
  creatorHighlight
}: PublicFooterProps) {
  const year = new Date().getFullYear();

  const router = useRouter();

  const [creatorOverlay, setCreatorOverlay] = useState<{
    visible: boolean;
    href?: string;
  }>({ visible: false, href: undefined });

  const openCreatorWithDelay = (href?: string) => {
    if (!href) return;
    setCreatorOverlay({ visible: true, href });

    const ms = Math.max(0, creatorDelayMs ?? 3000);

    const timer = setTimeout(() => {
      // Prefer router.push for SPA nav; fallback to location if external
      try {
        if (href.startsWith("/") || href.startsWith(window.location.origin)) {
          router.push(href.replace(window.location.origin, ""));
        } else {
          window.location.href = href;
        }
      } finally {
        setCreatorOverlay({ visible: false, href: undefined });
      }
    }, ms);

    // Allow user to tap overlay to skip the wait
    const skip = () => {
      clearTimeout(timer);
      if (href.startsWith("/") || href.startsWith(window.location.origin)) {
        router.push(href.replace(window.location.origin, ""));
      } else {
        window.location.href = href;
      }
    };

    // attach skip to state for the overlay click
    (openCreatorWithDelay as any)._skip = skip;
  };

  const cssVars = useMemo(
    () => ({
      ...(brand.c1 ? { ["--creator-c1" as any]: brand.c1 } : {}),
      ...(brand.c2 ? { ["--creator-c2" as any]: brand.c2 } : {}),
      ...(brand.c3 ? { ["--creator-c3" as any]: brand.c3 } : {}),
    }),
    [brand]
  );

  const LogoImg = (props: Logo & { small?: boolean }) => {
    const w = props.width ?? (props.small ? 22 : 28);
    const h = props.height ?? (props.small ? 22 : 28);
    return (
      <Image
        src={props.src}
        alt={props.alt}
        width={w}
        height={h}
        sizes="(max-width: 640px) 22px, 28px"
        className="shrink-0 rounded"
        title={props.title}
        priority={false}
        loading="lazy"
      />
    );
  };

  // creator renderer (image-first)
  const renderCreator = () => {
    
  if (creatorMode === "image" && creatorImage?.src) {
  // Base sizes (respect your dense defaults)
  const baseW = creatorImage.width ?? (dense ? 80 : 96);
  const baseH = creatorImage.height ?? (dense ? 16 : 18);

       const imgEl = (
    <Image
      src={creatorImage.src}
      alt={creatorImage.alt ?? "Creator"}
      width={creatorImage.width ?? (dense ? 80 : 96)}
      height={creatorImage.height ?? (dense ? 16 : 18)}
      className="inline-block align-middle"
      priority={false}
      loading="lazy"
    />
  );

   // Build optional highlight wrapper
  const wrapWithHighlight = (inner: React.ReactNode) => {
    if (!creatorHighlight) return inner;

    // PNG/JPG highlight behind (imageSrc)
    if ("imageSrc" in creatorHighlight) {
      const scale = creatorHighlight.scale ?? 1.2;
      const bw = Math.round(baseW * scale);
      const bh = Math.round(baseH * scale);
      return (
        <span className="relative inline-flex items-center justify-center">
          <Image
            src={creatorHighlight.imageSrc}
            alt=""
            aria-hidden
            width={bw}
            height={bh}
            className={cn(
              "absolute",
              // center the bigger image behind
              "-z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
              creatorHighlight.className
            )}
            priority={false}
            loading="lazy"
          />
          {inner}
        </span>
      );
    }

    // CSS presets: ring / glow / pill
    const pad = creatorHighlight.padding ?? 6;        // px
    const rad = creatorHighlight.radius ?? 9999;      // px (fully rounded)
    const preset = creatorHighlight.preset;

    const baseCls =
      "relative inline-flex items-center justify-center";
    const style: React.CSSProperties = {
      padding: pad,
      borderRadius: rad,
    };

    if (preset === "ring") {
      return (
        <span
          className={cn(baseCls, "bg-white/90 ring-1 ring-neutral-200 dark:bg-neutral-900/80 dark:ring-neutral-700 shadow-sm")}
          style={style}
        >
          {inner}
        </span>
      );
    }

    if (preset === "glow") {
      return (
        <span
          className={cn(baseCls, "bg-white/80 dark:bg-neutral-900/70")}
          style={{
            ...style,
            boxShadow:
              "0 0 0 1px rgba(0,0,0,0.05), 0 6px 18px rgba(0,0,0,0.15), 0 0 24px var(--creator-c1, #cf1337)",
          }}
        >
          {inner}
        </span>
      );
    }

    // pill (soft rounded background)
    return (
      <span
        className={cn(baseCls, "bg-neutral-100 dark:bg-neutral-800")}
        style={style}
      >
        {inner}
      </span>
    );
  };


      // Prefer per-image link; fallback to global creatorLink
    
        const link = creatorImage.href ?? creatorLink;
  const highlighted = wrapWithHighlight(imgEl);

  if (!link) return highlighted;

         if (creatorDelayEnabled) {
    return (
      <button
        type="button"
        onClick={() => openCreatorWithDelay(link)}
        className="inline-flex items-center"
        aria-label={creatorImage.alt ?? "Open creator link"}
      >
        {highlighted}
      </button>
    );
  }

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={creatorImage.alt ?? "Open creator link"}
      className="inline-flex items-center"
    >
      {highlighted}
    </a>
      ) 
    }

    // fallback text mode (kept minimal for dense layout)
    const txt = (
      <span className="text-[11px] sm:text-xs text-muted-foreground">
        {creatorName}
      </span>
    );

    return creatorLink ? (
      <a href={creatorLink} target="_blank" rel="noopener noreferrer" className="hover:underline">
        {txt}
      </a>
    ) : (
      txt
    );
  };


  // compact paddings/heights on mobile
  const padY = dense ? "py-2" : "py-3";
  const rowHMobile = dense ? "min-h-[56px]" : "min-h-[64px]";

  return (

    <>
    {/* Creator splash overlay */}
{creatorOverlay.visible ? (
  <div
    className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6"
    onClick={() => (openCreatorWithDelay as any)._skip?.()}
    role="dialog"
    aria-modal="true"
  >
    <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl px-6 py-5 w-full max-w-xs text-center">
      <div className="flex items-center justify-center mb-3">
        <Image
          src={creatorImage?.src ?? "/creator-footer.png"}
          alt={creatorImage?.alt ?? "Creator"}
          width={creatorImage?.width ?? 120}
          height={creatorImage?.height ?? 24}
          className="object-contain"
        />
      </div>
      <p className="text-sm text-muted-foreground mb-3">Opening&hellip;</p>
      {/* simple progress bar animation (3s) */}
      <div className="h-1 w-full rounded bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
        <div
          className="h-full animate-[grow_3s_linear_forwards]"
          style={{ background: "var(--creator-c1, #cf1337)" }}
        />
      </div>
      <style jsx>{`
        @keyframes grow {
          from { width: 0% }
          to { width: 100% }
        }
      `}</style>
    </div>
  </div>
) : null}

    <footer
      className={cn(
        position === "fixed" ? "fixed inset-x-0 bottom-0 z-40" : "",
        "w-full border-t bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:bg-neutral-900/70 dark:supports-[backdrop-filter]:bg-neutral-900/50",
        "pb-[max(0px,env(safe-area-inset-bottom))]",
        className
      )}
      style={cssVars}
    >
      <div className={cn("mx-auto px-2 sm:px-4 lg:px-6", padY)}>
        {/* MOBILE: single row (logos • name • creator) */}
        <div
          className={cn(
            "flex items-center justify-between sm:hidden",
            rowHMobile,
          )}
        >
          {/* Left: logos small */}
          <div className="flex items-center gap-2">
            <LogoImg {...systemLogo} small />
            <LogoImg {...hrLogo} small />
            {lguLogo ? <LogoImg {...lguLogo} small /> : null}
          </div>

          {/* Middle: system name (tiny) */}
          <div className="flex-1 mx-2 text-center truncate">
            {showYearOnMobile ? (
              <span className="ml-1 text-[10px] text-muted-foreground align-middle">© {year} </span>
            ) : null}
            <span className="text-[12px] font-semibold truncate">{systemName}</span>

          </div>

          {/* Right: creator image/text small */}
          <div className="flex items-center justify-end min-w-0">
            {renderCreator()}
          </div>
        </div>

        {/* DESKTOP/TABLET: two-row classic layout */}
        <div className="hidden sm:block">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <LogoImg {...systemLogo} />
              <LogoImg {...hrLogo} />
              {lguLogo ? <LogoImg {...lguLogo} /> : null}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <p className="text-sm font-semibold">{systemName}</p>
              <p className="text-[11px] leading-3 text-muted-foreground">© {year}</p>
            </div>
            <div className="shrink-0">{renderCreator()}</div>
          </div>
        </div>
      </div>
    </footer></>
    
  );
}
