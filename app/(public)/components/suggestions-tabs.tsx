"use client";

import { useEffect, useRef, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowUpRight, MoveRight, RefreshCw, Gift, FileEdit, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import clsx from "clsx";

function useAutoAdvance<T extends string>(values: T[], delayMs = 6000) {
  const [active, setActive] = useState<T>(values[0]);
  const timerRef = useRef<number | null>(null);
  const pausedRef = useRef(false);

  const clear = () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  const pause = () => { pausedRef.current = true; clear(); };
  const resume = () => { pausedRef.current = false; start(); };

  const start = () => {
    clear();
    timerRef.current = window.setInterval(() => {
      if (pausedRef.current) return;
      setActive((cur) => {
        const idx = values.indexOf(cur);
        return values[(idx + 1) % values.length];
      });
    }, delayMs);
  };

  useEffect(() => { start(); return clear; }, [values.join("|"), delayMs]);
  return { active, setActive, pause, resume };
}

export function SuggestionTabs({ onCreate }: { onCreate: () => void }) {
  const tabs = [
    { key: "PROMOTED", title: "Promotion", icon: ArrowUpRight, lines: [
      "Record promotions with new position and salary grade.",
      "Tip: attach memo number in details for faster approval.",
    ]},
    { key: "TRANSFER", title: "Transfer / Reassignment", icon: MoveRight, lines: [
      "Track movements between offices or units.",
      "Specify effective date and new office.",
    ]},
    { key: "CONTRACT", title: "Contract Renewal", icon: RefreshCw, lines: [
      "For COS/JO renewals and new contract periods.",
      "Include coverage dates and reference document.",
    ]},
    { key: "AWARD", title: "Award / Recognition", icon: Gift, lines: [
      "Add commendations, loyalty awards, or citations.",
      "Optional: upload photo of certificate later.",
    ]},
  ] as const;

  type K = typeof tabs[number]["key"];
  const keys = tabs.map(t => t.key) as K[];
  const { active, setActive, pause, resume } = useAutoAdvance<K>(keys, 6000);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // pause/resume on hover/touch
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onEnter = () => pause();
    const onLeave = () => resume();
    const onDown = () => pause();
    const onUp = () => resume();
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("touchstart", onDown, { passive: true });
    el.addEventListener("touchend", onUp);
    return () => {
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("touchstart", onDown);
      el.removeEventListener("touchend", onUp);
    };
  }, [pause, resume]);

  // swipe left/right on content
  useEffect(() => {
    let startX = 0;
    const threshold = 40;
    const el = containerRef.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => { startX = e.touches[0].clientX; };
    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) < threshold) return;
      pause();
      const i = keys.indexOf(active);
      setActive(dx < 0 ? keys[(i + 1) % keys.length] : keys[(i - 1 + keys.length) % keys.length]);
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
    };
  }, [active, keys, pause, setActive]);

  const scrollTabs = (dir: "left" | "right") => {
    const el = listRef.current;
    if (!el) return;
    const delta = dir === "left" ? -160 : 160;
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <div ref={containerRef} className="rounded-xl border border-dashed bg-muted/20 p-4 sm:p-6">
      {/* Header stacks on mobile */}
      <div className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold">What you can add next</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Your hired date is already on your timeline. Add more milestones so HR always has the latest.
          </p>
        </div>
        <div>
          <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={onCreate}>
            <FileEdit className="mr-2 h-4 w-4" />
            Create a custom entry
          </Button>
        </div>
      </div>

      <Tabs value={active} onValueChange={(v) => setActive(v as K)}>
        {/* Mobile tab strip with snap + chevrons */}
        <div className="relative">
          <TabsList
            ref={listRef as any}
            className={clsx(
              "w-full justify-start overflow-x-auto no-scrollbar",
              "snap-x snap-mandatory gap-1 sm:gap-2"
            )}
          >
            {tabs.map(({ key, title }) => (
              <TabsTrigger
                key={key}
                value={key}
                className={clsx(
                  "whitespace-nowrap snap-start",
                  "text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2"
                )}
              >
                {title}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* chevrons appear on mobile only */}
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center sm:hidden">
            <button
              type="button"
              onClick={() => scrollTabs("left")}
              className="pointer-events-auto rounded-full bg-white/80 p-1 shadow"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center sm:hidden">
            <button
              type="button"
              onClick={() => scrollTabs("right")}
              className="pointer-events-auto rounded-full bg-white/80 p-1 shadow"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {tabs.map(({ key, title, icon: Icon, lines }) => (
          <TabsContent key={key} value={key} className="mt-3 sm:mt-4">
            <div className="rounded-md border bg-white p-3 sm:p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-muted sm:h-9 sm:w-9">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{title}</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-muted-foreground sm:text-sm">
                    {lines.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                  <div className="mt-3 text-[11px] text-muted-foreground sm:text-xs">
                    Hint: Use “Create a custom entry” to submit this milestone. HRMO will review and approve.
                  </div>
                </div>
              </div>
            </div>

            {/* manual nav (visible on all, spaced tighter on mobile) */}
            <div className="mt-2 sm:mt-3 flex justify-between">
              <button
                className="text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  pause();
                  const idx = keys.indexOf(active);
                  setActive(keys[(idx - 1 + keys.length) % keys.length]);
                }}
              >
                ← Previous
              </button>
              <button
                className="text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  pause();
                  const idx = keys.indexOf(active);
                  setActive(keys[(idx + 1) % keys.length]);
                }}
              >
                Next →
              </button>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* hide scrollbar utility (scoped) */}
      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
