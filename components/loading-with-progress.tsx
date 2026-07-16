"use client";

import { useEffect, useState } from "react";

import LoadingState from "@/components/loading-state";
import { cn } from "@/lib/utils";

type Props = {
  /** When true, progress animates toward 95%. When false, jumps to 100%. */
  active?: boolean;
  className?: string;
};

/** Shared progress wrapper around the app-wide LoadingState (same look as route/billboard loaders). */
export default function LoadingWithProgress({ active = true, className }: Props) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    if (active) {
      setProgress(0);
      let current = 0;
      interval = setInterval(() => {
        current += 5;
        setProgress(Math.min(current, 95));
        if (current >= 95 && interval) clearInterval(interval);
      }, 100);
    } else {
      setProgress(100);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [active]);

  return (
    <div className={cn("flex items-center justify-center py-10", className)}>
      <LoadingState progress={progress} />
    </div>
  );
}
