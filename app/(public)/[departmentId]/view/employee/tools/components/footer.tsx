"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type CreatorImage = {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  href: string;               // destination to open after preview
  highlightSrc?: string;      // optional PNG border/glow behind the image
};

type FooterProps = {
  className?: string;
  compact?: boolean;          // tighter padding on small screens
  // left-side content (e.g., logos or text)
  left?: React.ReactNode;
  // right-side quick links (text links)
  links?: Array<{ label: string; href: string; external?: boolean }>;

  // Creator region
  creatorMode?: "image" | "text" | "none";
  creatorText?: string;
  creatorImage?: CreatorImage;

  // Preview behavior
  previewDelayMs?: number;     // default 3000ms
};

export default function AppFooter({
  className,
  compact,
  left,
  links = [],
  creatorMode = "none",
  creatorText,
  creatorImage,
  previewDelayMs = 3000,
}: FooterProps) {
  const router = useRouter();
  const [showPreview, setShowPreview] = useState(false);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCreatorClick: React.MouseEventHandler<HTMLAnchorElement | HTMLButtonElement> = (e) => {
    if (creatorMode !== "image" || !creatorImage?.href) return;
    // intercept to show preview first
    e.preventDefault();
    setShowPreview(true);

    // schedule navigation
    pendingTimer.current = setTimeout(() => {
      // internal vs external
      const isExternal = /^https?:\/\//i.test(creatorImage.href);
      if (isExternal) {
        window.location.href = creatorImage.href;
      } else {
        router.push(creatorImage.href);
      }
    }, Math.max(0, previewDelayMs));
  };

  const cancelPreview = () => {
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    pendingTimer.current = null;
    setShowPreview(false);
  };

  const goNow = () => {
    if (!creatorImage?.href) return;
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    const isExternal = /^https?:\/\//i.test(creatorImage.href);
    if (isExternal) {
      window.location.href = creatorImage.href;
    } else {
      router.push(creatorImage.href);
    }
  };

  useEffect(() => {
    return () => {
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
    };
  }, []);

  return (
    <>
      <footer
        className={cn(
          "w-full border-t bg-background/70 backdrop-blur",
          compact ? "py-3" : "py-4",
          className
        )}
      >
        <div className={cn("mx-auto flex max-w-6xl items-center justify-between gap-4 px-4")}>
          {/* Left side slot (logo/text) */}
          <div className="min-w-0 flex-1">{left}</div>

          {/* Right-side links (optional) */}
          {!!links?.length && (
            <nav className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
              {links.map((l) =>
                l.external ? (
                  <a
                    key={l.href + l.label}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground underline-offset-4 hover:underline"
                  >
                    {l.label}
                  </a>
                ) : (
                  <Link
                    key={l.href + l.label}
                    href={l.href}
                    className="hover:text-foreground underline-offset-4 hover:underline"
                  >
                    {l.label}
                  </Link>
                )
              )}
            </nav>
          )}

          {/* Creator region */}
          <div className="flex items-center">
            {creatorMode === "text" && creatorText && (
              <span className="text-xs text-muted-foreground">{creatorText}</span>
            )}

            {creatorMode === "image" && creatorImage && (
              <a
                href={creatorImage.href}
                onClick={handleCreatorClick}
                className="relative inline-flex items-center justify-center"
                aria-label={creatorImage.alt ?? "Creator"}
              >
                {/* Optional highlight PNG behind the image */}
                {creatorImage.highlightSrc && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 grid place-items-center"
                  >
                    <Image
                      src={creatorImage.highlightSrc}
                      alt=""
                      width={(creatorImage.width ?? 96) * 1.6}
                      height={(creatorImage.height ?? 18) * 1.6}
                      className="select-none opacity-90"
                    />
                  </span>
                )}

                <Image
                  src={creatorImage.src}
                  alt={creatorImage.alt ?? "Creator"}
                  width={creatorImage.width ?? 96}
                  height={creatorImage.height ?? 18}
                  className="transition-transform hover:scale-[1.03] active:scale-[0.97]"
                  priority={false}
                />
              </a>
            )}
          </div>
        </div>
      </footer>

      {/* Preview overlay before navigation */}
      {showPreview && creatorMode === "image" && creatorImage && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-6"
          role="dialog"
          aria-modal="true"
          onClick={cancelPreview}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl bg-background p-6 shadow-xl ring-1 ring-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative mx-auto flex items-center justify-center">
              {/* Optional highlight behind */}
              {creatorImage.highlightSrc && (
                <Image
                  src={creatorImage.highlightSrc}
                  alt=""
                  width={(creatorImage.width ?? 96) * 3}
                  height={(creatorImage.height ?? 18) * 3}
                  className="pointer-events-none absolute -z-10 opacity-90"
                />
              )}
              {/* Creator image enlarged */}
              <Image
                src={creatorImage.src}
                alt={creatorImage.alt ?? "Creator"}
                width={(creatorImage.width ?? 96) * 2.4}
                height={(creatorImage.height ?? 18) * 2.4}
                className="select-none"
                priority
              />
            </div>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              Opening creator page…
            </p>

            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                onClick={goNow}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                Go now
              </button>
              <button
                onClick={cancelPreview}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
