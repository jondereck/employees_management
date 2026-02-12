"use client";

import { useEffect, useRef, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowUpRight, MoveRight, RefreshCw, Gift, FileEdit, ChevronLeft, ChevronRight, Sparkles, CheckCircle2, Info } from "lucide-react";
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
  <div
  ref={containerRef}
  className="relative w-full overflow-hidden rounded-3xl border border-emerald-500/20 bg-emerald-500/5 backdrop-blur-md px-4 py-6 sm:p-8 transition-all duration-500 hover:shadow-[0_20px_50px_rgba(16,185,129,0.1)]"
>
  {/* Liquid Glow */}
  <div className="pointer-events-none absolute -top-24 -left-24 h-48 w-48 rounded-full bg-emerald-500/10 blur-[70px] opacity-70" />

  {/* Header */}
  <div className="relative z-10 mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="space-y-1">
      <h3 className="flex items-center gap-2 text-base sm:text-lg font-black tracking-tight text-slate-800 dark:text-white">
        <Sparkles className="h-5 w-5 text-emerald-500 shrink-0" />
        Growth Milestones
      </h3>

      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-md">
        Your journey is evolving. Add new achievements to keep your official profile synchronized with your career.
      </p>
    </div>

    <Button
      size="lg"
      onClick={onCreate}
      className="group w-full sm:w-auto rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold px-6 shadow-xl transition-all hover:scale-105 active:scale-95"
    >
      <FileEdit className="mr-2 h-4 w-4 transition-transform group-hover:rotate-12" />
      Submit Milestone
    </Button>
  </div>

  <Tabs
    value={active}
    onValueChange={(v) => setActive(v as K)}
    className="relative z-10"
  >
    {/* Tabs */}
    <div className="relative mb-6">
      <TabsList
        ref={listRef as any}
        className="flex w-full justify-start overflow-x-auto no-scrollbar gap-2 snap-x snap-mandatory bg-transparent p-0"
      >
        {tabs.map(({ key, title }) => (
          <TabsTrigger
            key={key}
            value={key}
            className={clsx(
              "snap-start whitespace-nowrap rounded-full px-4 sm:px-5 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all",
              "data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-500/30",
              "data-[state=inactive]:bg-white/60 dark:data-[state=inactive]:bg-white/5 data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:bg-white/80"
            )}
          >
            {title}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* Mobile Arrows */}
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center sm:hidden">
        <button
          type="button"
          onClick={() => scrollTabs("left")}
          className="pointer-events-auto rounded-full bg-white/90 dark:bg-slate-800/90 p-2 shadow-xl border border-white/20 backdrop-blur-md"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center sm:hidden">
        <button
          type="button"
          onClick={() => scrollTabs("right")}
          className="pointer-events-auto rounded-full bg-white/90 dark:bg-slate-800/90 p-2 shadow-xl border border-white/20 backdrop-blur-md"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>

    {tabs.map(({ key, title, icon: Icon, lines }) => (
      <TabsContent key={key} value={key} className="mt-0 outline-none">
        <div className="group rounded-[28px] sm:rounded-[32px] border border-white/40 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-xl p-5 sm:p-6 transition-all duration-500 hover:bg-white/80 dark:hover:bg-white/[0.08]">

          <div className="flex flex-col sm:flex-row items-start gap-5 sm:gap-6">

            {/* Icon */}
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/20 transition-transform group-hover:rotate-6">
              <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>

            <div className="flex-1 space-y-4 w-full">

              <div>
                <div className="text-base sm:text-lg font-black text-slate-800 dark:text-white leading-tight">
                  {title}
                </div>
                <div className="mt-2 h-1 w-10 sm:w-12 bg-emerald-500 rounded-full" />
              </div>

              {/* Grid */}
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {lines.map((t, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm font-medium text-slate-600 dark:text-slate-400"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    {t}
                  </li>
                ))}
              </ul>

              {/* Quick Tip */}
              <div className="rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/10 p-4 border border-emerald-500/10">
                <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-tight text-emerald-700 dark:text-emerald-400">
                  <Info className="h-3.5 w-3.5" />
                  Quick Tip
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Use the{" "}
                  <span className="font-bold italic text-slate-900 dark:text-white">
                    “Submit Milestone”
                  </span>{" "}
                  button above to upload certificates or proof for this category.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between px-1 sm:px-2">

          <button
            className="group flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-400 hover:text-emerald-500 transition-colors"
            onClick={() => {
              pause();
              const idx = keys.indexOf(active);
              setActive(keys[(idx - 1 + keys.length) % keys.length]);
            }}
          >
            <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Previous
          </button>

          <div className="flex gap-1.5">
            {keys.map((k) => (
              <div
                key={k}
                className={clsx(
                  "h-1.5 rounded-full transition-all duration-300",
                  k === active
                    ? "w-8 bg-emerald-500"
                    : "w-1.5 bg-slate-300 dark:bg-slate-700"
                )}
              />
            ))}
          </div>

          <button
            className="group flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-400 hover:text-emerald-500 transition-colors"
            onClick={() => {
              pause();
              const idx = keys.indexOf(active);
              setActive(keys[(idx + 1) % keys.length]);
            }}
          >
            Next
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </TabsContent>
    ))}
  </Tabs>

  <style jsx>{`
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  `}</style>
</div>

  );
}
