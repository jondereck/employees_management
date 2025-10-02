"use client";

import Image from "next/image";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

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
  creatorImage?: { src: string; alt?: string; width?: number; height?: number };

  // layout + theme
  brand?: { c1?: string; c2?: string; c3?: string };
  position?: "fixed" | "static";

  // NEW: density controls
  dense?: boolean;              // compact mobile layout (defaults to true)
  showYearOnMobile?: boolean;   // show © year on xs (defaults to false)
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
}: PublicFooterProps) {
  const year = new Date().getFullYear();

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
      const img = (
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
      return creatorLink ? (
        <a
          href={creatorLink}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open creator link"
          className="inline-flex items-center"
        >
          {img}
        </a>
      ) : (
        img
      );
    }

    // fallback text mode (kept minimal)
    const txt = (
      <span className="text-[11px] sm:text-xs text-muted-foreground">
        {creatorName}
      </span>
    );
    return creatorLink ? (
      <a
        href={creatorLink}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:underline"
      >
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
            <span className="text-[12px] font-semibold truncate">{systemName}</span>
            {showYearOnMobile ? (
              <span className="ml-1 text-[10px] text-muted-foreground align-middle">© {year}</span>
            ) : null}
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
    </footer>
  );
}
