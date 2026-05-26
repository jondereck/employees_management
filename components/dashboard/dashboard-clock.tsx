"use client";

import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";

const TIME_ZONE = "Asia/Manila";

const formatDateTime = (date: Date) => ({
  date: new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date),
  time: new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date),
});

export function DashboardClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const value = now ? formatDateTime(now) : { date: "Asia/Manila", time: "--:--:--" };

  return (
    <div className="inline-flex min-w-[210px] items-center gap-3 rounded-2xl border border-white/30 bg-white/40 px-4 py-3 text-slate-800 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300">
        <Clock3 className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{value.date}</p>
        <p className="font-mono text-lg font-semibold tabular-nums leading-tight">{value.time}</p>
      </div>
    </div>
  );
}
