// app/components/Loading.tsx
"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const quotes = [
  "Good things take time...",
  "Hang tight, magic is loading...",
  "Almost there...",
  "Fetching greatness...",
  "Just a moment more...",
  "Powering up the awesomeness...",
];

function LoadingDotsWithTypewriter({ text }: { text: string }) {
  const [visibleText, setVisibleText] = useState("");

  useEffect(() => {
    let index = 0;
    const typeInterval = setInterval(() => {
      setVisibleText((prev) => {
        if (index >= text.length) {
          clearInterval(typeInterval);
          return prev;
        }
        const next = text.slice(0, index + 1);
        index++;
        return next;
      });
    }, 40);

    return () => clearInterval(typeInterval);
  }, [text]);

  const [dots, setDots] = useState("");

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots((prev) => (prev.length < 3 ? prev + "." : ""));
    }, 400);
    return () => clearInterval(dotInterval);
  }, []);

  return (
    <span className="tracking-wide uppercase animate-pulse">
      {visibleText}
      {dots}
    </span>
  );
}

export default function Loading({ className }: { className?: string }) {
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % quotes.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);



  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center space-y-4 animate-pulse",
        className
      )}
    >
      <div className="relative">
        <div className="h-16 w-16 rounded-full border-4 border-green-500 border-t-transparent animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center text-green-700 font-bold text-xl">
          <span className="animate-ping">•</span>
        </div>
      </div>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">Please wait...</p>
        <p className="mt-1 text-green-600 text-xs animate-pulse tracking-wide uppercase">
          <LoadingDotsWithTypewriter text="Loading your next screen" />
        </p>
        <p className="mt-2 text-xs text-muted-foreground italic">{quotes[quoteIndex]}</p>
      </div>
    </div>
  );
}
