"use client";
import Image from "next/image";
import { useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type Logo = { src: string; alt: string; width?: number; height?: number; title?: string };

type CreatorEffect = "shimmer" | "glow" | "underline" | "wave" | "sparkle";

export default function PublicFooter({
  className = "",
  creatorName = "JDN Systems",
  creatorLink,
  systemName = "HR Profiling System",
  systemLogo,
  hrLogo,
  lguLogo,
  creatorEffect = "shimmer",
  brand = { c1: undefined, c2: undefined, c3: undefined }, // pass hex to override
}: {
  className?: string;
  creatorName?: string;
  creatorLink?: string;
  systemName?: string;
  systemLogo: Logo;
  hrLogo: Logo;
  lguLogo?: Logo;
  creatorEffect?: CreatorEffect;
  brand?: { c1?: string; c2?: string; c3?: string };
}) {
  const year = new Date().getFullYear();

  // cursor tracker for sparkle-follow
  const [cursor, setCursor] = useState<{ x: number; y: number }>({ x: 50, y: 50 });

  // transient click bursts
  const [bursts, setBursts] = useState<Array<{ id: number; x: number; y: number; offsets: Array<{ tx: string; ty: string }> }>>([]);

  const onMouseMove = useCallback<React.MouseEventHandler<HTMLSpanElement>>((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setCursor({ x, y });
  }, []);

  const onClickBurst = useCallback<React.MouseEventHandler<HTMLSpanElement>>((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // 6 tiny shards flying out in small random directions
    const offsets = Array.from({ length: 6 }).map(() => {
      const dx = (Math.random() * 30 - 15); // px
      const dy = (Math.random() * 30 - 15); // px
      return { tx: `calc(-50% + ${dx}px)`, ty: `calc(-50% + ${dy}px)` };
    });

    const id = Date.now() + Math.random();
    setBursts((prev) => [...prev, { id, x, y, offsets }]);

    // clean them after animation
    setTimeout(() => {
      setBursts((prev) => prev.filter(b => b.id !== id));
    }, 750);
  }, []);
  const cssVars = useMemo(() => ({
    ...(brand.c1 ? { ["--creator-c1" as any]: brand.c1 } : {}),
    ...(brand.c2 ? { ["--creator-c2" as any]: brand.c2 } : {}),
    ...(brand.c3 ? { ["--creator-c3" as any]: brand.c3 } : {}),
  }), [brand]);

  // positions for sparkles around the text (percent of the text box)
  const SPARKLES = [
    { x: "0%", y: "50%", d: "0s" },
    { x: "100%", y: "20%", d: ".25s" },
    { x: "50%", y: "0%", d: ".5s" },
    { x: "15%", y: "90%", d: ".75s" },
    { x: "85%", y: "80%", d: "1s" },
  ];


  const LogoImg = (props: Logo) => (
    <Image
      src={props.src}
      alt={props.alt}
      width={props.width ?? 28}
      height={props.height ?? 28}
      sizes="(max-width: 640px) 24px, 28px"
      className="shrink-0 rounded"
      title={props.title}
      priority={false}
      loading="lazy"
    />
  );

  const renderCreator = () => {
    if (creatorEffect === "sparkle") {
      return (
        <span
          className="creator-fast creator-sparkle-wrap"
          style={cssVars}
          onMouseMove={onMouseMove}
          onClick={onClickBurst}
        >
          {/* The shimmering text */}
          <span className="creator-sparkle-text">{creatorName}</span>

          {/* Ambient sparkles */}
          {SPARKLES.map((s, i) => (
            <span
              key={`ambient-${i}`}
              className="sparkle-dot"
              style={{ ["--x" as any]: s.x, ["--y" as any]: s.y, ["--delay" as any]: s.d }}
              aria-hidden
            />
          ))}

          {/* Cursor-follow sparkle */}
          <span
            className="sparkle-dot sparkle-follow"
            style={{ ["--x" as any]: `${cursor.x}%`, ["--y" as any]: `${cursor.y}%` }}
            aria-hidden
          />

          {/* Click bursts */}
          {bursts.map((b) =>
            b.offsets.map((o, i) => (
              <span
                key={`${b.id}-${i}`}
                className="sparkle-burst"
                style={{
                  ["--x" as any]: `${b.x}%`,
                  ["--y" as any]: `${b.y}%`,
                  ["--tx" as any]: o.tx,
                  ["--ty" as any]: o.ty,
                  left: `var(--x)`,
                  top: `var(--y)`,
                }}
                aria-hidden
              />
            ))
          )}
        </span>
      );
    }



    if (creatorEffect === "underline") {
      return (
        <span className={cn("creator-base creator-underline-hover")} style={cssVars}>
          <span className="creator-underline">{creatorName}</span>
        </span>
      );
    }

    if (creatorEffect === "glow") {
      return (
        <span className="creator-base creator-glow" style={cssVars}>
          {creatorName}
        </span>
      );
    }

    // default: shimmer
    return (
      <span className="creator-base creator-shimmer" style={cssVars}>
        {creatorName}
      </span>
    );
  };

  return (
    <footer
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 w-full border-t bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:bg-neutral-900/70 dark:supports-[backdrop-filter]:bg-neutral-900/50",
        "pb-[max(0px,env(safe-area-inset-bottom))]",
        className
      )}
      style={cssVars}
    >
      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: system + logos */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2">
              <LogoImg {...systemLogo} />
              <LogoImg {...hrLogo} />
              {lguLogo ? <LogoImg {...lguLogo} /> : null}
            </div>

            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{systemName}</p>
              <p className="text-[11px] leading-3 text-muted-foreground truncate">
                © {year}{" "}
                {creatorLink ? (
                  <a
                    href={creatorLink}
                    className={cn(
                      "group inline-flex items-center creator-fast hover:underline"
                    )}
                    aria-label={`Visit ${creatorName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {renderCreator()}
                    {creatorEffect !== "wave" && (
                      <span aria-hidden className="creator-sparkle">✨</span>
                    )}
                  </a>
                ) : (
                  renderCreator()
                )}
              </p>
            </div>
          </div>

          {/* Right slot (optional) */}
          <div className="text-xs text-muted-foreground">
            {/* Add anything here (version tag, build hash, status dot, etc.) */}
          </div>
        </div>
      </div>
    </footer>
  );
}
