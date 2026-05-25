"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import clsx from "clsx";
import { IdleThinkingBubbles } from "./idle-thinking-bubble";
import { useIsScrolling } from "@/hooks/use-is-scrolling";

type AnchorSide = "left" | "right";

const EDGE_OFFSET_REM = 1.5;
const DRAG_THRESHOLD_PX = 8;
const TOP_GAP_PX = 16;
const NAVBAR_GAP_PX = 8;
const FOOTER_GAP_PX = 8;
const GENIO_ANCHOR_TOP_KEY = "genio.anchorTop";

export function GenioFloatingButton({
  anchorSide,
  isThinking,
  onAnchorSideChange,
  onClick,
  onSelectThought,
}: {
  anchorSide: AnchorSide;
  isThinking: boolean;
  onAnchorSideChange: (side: AnchorSide) => void;
  onClick: () => void;
  onSelectThought?: (template: string) => void;
}) {
  const isScrolling = useIsScrolling();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const dragDeltaXRef = useRef(0);
  const dragDeltaYRef = useRef(0);
  const suppressClickRef = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [top, setTop] = useState<number | null>(null);

  const canThink = isThinking && !isScrolling;
  const getFooterTop = () => {
    const footer = document.querySelector("footer");
    if (!footer) return window.innerHeight;
    return footer.getBoundingClientRect().top;
  };

  const getNavbarBottom = () => {
    const navbar =
      document.querySelector("header.sticky.top-0") ??
      document.querySelector('nav[aria-label="Top navigation"]')?.parentElement;
    if (!navbar) return 0;
    return navbar.getBoundingClientRect().bottom;
  };

  const clampTop = (nextTop: number) => {
    const height = rootRef.current?.offsetHeight ?? 72;
    const minTop = Math.max(TOP_GAP_PX, getNavbarBottom() + NAVBAR_GAP_PX);
    const maxTop = Math.max(minTop, getFooterTop() - height - FOOTER_GAP_PX);
    return Math.min(Math.max(nextTop, minTop), maxTop);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fallbackTop = window.innerHeight - EDGE_OFFSET_REM * 16 - 64;
    const raw = window.localStorage.getItem(GENIO_ANCHOR_TOP_KEY);
    const parsed = raw ? Number(raw) : Number.NaN;
    const candidate = Number.isFinite(parsed) ? parsed : fallbackTop;
    setTop(clampTop(candidate));
  }, []);

  useEffect(() => {
    const onResize = () => {
      setTop((current) => {
        if (typeof current !== "number") return current;
        return clampTop(current);
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const anchorClass = anchorSide === "left" ? "left-6" : "right-6";
  const dragStyle = useMemo(
    () => ({
      top: top ?? "auto",
      bottom: top === null ? "1.5rem" : "auto",
      transform: `translate(${translate.x}px, ${translate.y}px)`,
      transition: isDragging ? "none" : "transform 140ms ease-out",
      touchAction: "none" as const,
      userSelect: "none" as const,
    }),
    [isDragging, top, translate.x, translate.y]
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartXRef.current = event.clientX;
    dragStartYRef.current = event.clientY;
    dragDeltaXRef.current = 0;
    dragDeltaYRef.current = 0;
    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!isDraggingRef.current) return;
      dragDeltaXRef.current = moveEvent.clientX - dragStartXRef.current;
      dragDeltaYRef.current = moveEvent.clientY - dragStartYRef.current;
      setTranslate({ x: dragDeltaXRef.current, y: dragDeltaYRef.current });
    };

    const handlePointerEnd = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);

      const movedEnough =
        Math.abs(dragDeltaXRef.current) > DRAG_THRESHOLD_PX ||
        Math.abs(dragDeltaYRef.current) > DRAG_THRESHOLD_PX;
      suppressClickRef.current = movedEnough;

      if (!movedEnough) {
        setTranslate({ x: 0, y: 0 });
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerEnd);
        window.removeEventListener("pointercancel", handlePointerEnd);
        return;
      }

      const rootRect = rootRef.current?.getBoundingClientRect();
      if (!rootRect) {
        setTranslate({ x: 0, y: 0 });
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerEnd);
        window.removeEventListener("pointercancel", handlePointerEnd);
        return;
      }

      const buttonRect = buttonRef.current?.getBoundingClientRect();
      const buttonCenterX = buttonRect
        ? buttonRect.left + buttonRect.width / 2
        : rootRect.left + rootRect.width / 2;
      const nextSide: AnchorSide =
        buttonCenterX < window.innerWidth / 2 ? "left" : "right";

      onAnchorSideChange(nextSide);
      const nextTop = clampTop(rootRect.top);
      setTop(nextTop);
      window.localStorage.setItem(GENIO_ANCHOR_TOP_KEY, String(nextTop));
      setTranslate({ x: 0, y: 0 });

      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);
  };

  const handleButtonClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onClick();
  };

  return (
    <div
      ref={rootRef}
      className={clsx(
        "fixed z-50 flex flex-col items-center gap-2",
        anchorClass
      )}
      style={dragStyle}
    >
      <div className="relative h-2 w-full flex justify-center">
        {canThink && onSelectThought && (
          <IdleThinkingBubbles
            anchorSide={anchorSide}
            onSelect={onSelectThought}
          />
        )}
      </div>

      <div className="relative group">
        <div
          className={clsx(
            "absolute -inset-0.5 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-75 blur-md transition duration-1000 group-hover:opacity-100 group-hover:duration-200",
            isThinking ? "animate-pulse" : "animate-none"
          )}
        />

        <Button
          ref={buttonRef}
          variant="ghost"
          onClick={handleButtonClick}
          onPointerDown={handlePointerDown}
          className={clsx(
            "relative h-16 w-16 rounded-full p-0 overflow-hidden border-white/20 shadow-2xl transition-transform active:scale-90 hover:scale-110 cursor-grab active:cursor-grabbing",
            isThinking && "animate-genio-breath"
          )}
        >
          <Image
            src="/genio/genio-avatar.png"
            alt="Genio AI"
            draggable={false}
            fill
            priority
          />
        </Button>
      </div>
    </div>
  );
}
