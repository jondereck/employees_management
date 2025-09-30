"use client";

import React from "react";
import { cn } from "@/lib/utils";

type Props = {
  label?: React.ReactNode;
  /** 0..100 for determinate; omit/undefined for indeterminate */
  value?: number;
  /** width in px (or any CSS length) */
  width?: number | string;
  /** height in px (or any CSS length) */
  height?: number | string;
  /** tailwind classes to tweak colors etc. */
  className?: string;
  /** show % text when determinate */
  showPercent?: boolean;
};

export default function LinearLoader({
  label,
  value,
  width = 280,
  height = 8,
  className,
  showPercent = true,
}: Props) {
  const determinate = Number.isFinite(value);
  const pct = Math.max(0, Math.min(100, Number(value ?? 0)));

  return (
    <div className={cn("w-full", className)} style={{ width }}>
      {label ? (
        <div className="text-sm font-medium mb-1">{label}</div>
      ) : null}

      <div
        className="relative rounded bg-neutral-200/90 overflow-hidden"
        style={{ height }}
      >
        {/* Determinate bar */}
        {determinate ? (
          <div
            className="h-full bg-pink-600 transition-[width] duration-200 ease-out will-change-[width]"
            style={{ width: `${pct}%` }}
          />
        ) : (
          // Indeterminate sweep
          <div className="absolute inset-0">
            <div className="absolute h-full bg-pink-600/90 rounded-[inherit] animate-loader-sweep" />
          </div>
        )}
      </div>

      {determinate && showPercent ? (
        <div className="mt-1 text-xs text-muted-foreground">{Math.round(pct)}%</div>
      ) : null}

      {/* Local keyframes (no global CSS needed) */}
      <style jsx>{`
        @keyframes loader-sweep {
          0% {
            left: -40%;
            width: 40%;
          }
          50% {
            left: 20%;
            width: 60%;
          }
          100% {
            left: 100%;
            width: 40%;
          }
        }
        .animate-loader-sweep {
          animation: loader-sweep 1.1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
