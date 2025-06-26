"use client";
import { useEffect, useState } from "react";

const quotes = [
  "Good things take time...",
  "Hang tight, magic is loading...",
  "Almost there...",
  "Fetching greatness...",
  "Just a moment more...",
];

function LoadingDotsWithTypewriter({ text }: { text: string }) {
  const [visibleText, setVisibleText] = useState("");
  const [dots, setDots] = useState("");

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index <= text.length) {
        setVisibleText(text.slice(0, index));
        index++;
      }
    }, 40);
    return () => clearInterval(interval);
  }, [text]);

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

export default function LoadingState({ progress = 0 }: { progress?: number }) {
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % quotes.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center space-y-4 animate-pulse">
      <div className="relative">
        <div className="h-20 w-20 rounded-full border-4 border-green-500 border-t-transparent animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center text-green-700 font-bold text-xl">
          {progress}%
        </div>
      </div>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">Please wait...</p>
        <p className="mt-1 text-green-600 text-xs tracking-wide uppercase">
          <LoadingDotsWithTypewriter text="Loading your next screen" />
        </p>
        <p className="mt-2 text-xs text-muted-foreground italic">
          {quotes[quoteIndex]}
        </p>
      </div>
    </div>
  );
}
