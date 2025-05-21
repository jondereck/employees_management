"use client";

import { useEffect, useState } from "react";
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
        const next = text.slice(0, index + 1); // ✅ show correct characters in order
        index++;
        return next;
      });
    }, 40); // type speed

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
    }, 3000); // Change quote every 4 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(100); // optional: small vibration
    }
  }, []);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center space-y-4 animate-pulse",
        className
      )}
    >
      {/* Spinner */}
      <div className="relative">
        <div className="h-16 w-16 rounded-full border-4 border-green-500 border-t-transparent animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center text-green-700 font-bold text-xl">
          <span className="animate-ping">•</span>
        </div>
      </div>

      {/* Animated Text */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Please wait...</p>
        <p className="mt-1 text-green-600 text-xs">
          <LoadingDotsWithTypewriter text="Loading your next screen" />
        </p>
        <p className="mt-2 text-xs text-muted-foreground italic">{quotes[quoteIndex]}</p>
      </div>
    </div>
  );
}





// const LoadingSkeleton = () => {
//   return (
//     <div className="fixed inset-0 z-[9999] bg-white/80 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 space-y-10 animate-pulse">
//       {/* Billboard Skeleton */}
//       <div className="w-full max-w-6xl rounded-xl relative aspect-square md:aspect-[2.4/1] overflow-hidden bg-gray-300" />

//       {/* Title Skeleton */}
//       <div className="h-8 w-48 bg-gray-300 rounded" />

//       {/* Employee Cards Skeleton */}
//       <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 w-full max-w-6xl">
//         {Array.from({ length: 15 }).map((_, i) => (
//           <div key={i} className="h-40 bg-gray-300 rounded-lg" />
//         ))}
//       </div>
//     </div>
//   );
// };

// export default LoadingSkeleton;
