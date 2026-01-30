"use client";

import { useEffect, useState } from "react";
import { GENIO_COMMANDS } from "./genio-chat";
import clsx from "clsx";

const THOUGHTS = GENIO_COMMANDS
  .filter((c) => c.quickChip)
  .map((c) => c.template);

export function IdleThinkingBubbles() {
  const [thought, setThought] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const random = THOUGHTS[Math.floor(Math.random() * THOUGHTS.length)];
      setThought(random);
      setIsVisible(true);

      setTimeout(() => setIsVisible(false), 10000);
      setTimeout(() => setThought(null), 11000); // Slightly longer to allow fade-out
    }, 12000);

    return () => clearInterval(interval);
  }, []);

  if (!thought) return null;

  return (
    <div className="absolute -top-20 right-4 flex flex-col items-end gap-1.5 pointer-events-none">
      
      {/* 3. THE BIG BUBBLE (Fixed Size) */}
      <div
        className={clsx(
          // Set fixed width and height here
          "w-[160px] h-[70px] flex items-center justify-center px-4 rounded-[24px]",
          "bg-white/95 backdrop-blur-xl border border-white shadow-2xl transition-all duration-500 ease-out",
          "text-center", 
          isVisible 
            ? "opacity-100 scale-100 translate-y-0 delay-[400ms] animate-bounce-subtle" 
            : "opacity-0 scale-50 translate-y-4"
        )}
      >
        <span className="text-black text-[12px] font-semibold leading-tight whitespace-normal">
          {thought}
        </span>
      </div>

      {/* 2. MEDIUM BUBBLE */}
      <div 
        className={clsx(
          "w-4 h-4 rounded-full bg-white/80 backdrop-blur-md border border-white shadow-lg transition-all duration-500 ease-out",
          isVisible 
            ? "opacity-100 scale-100 translate-y-0 delay-[200ms]" 
            : "opacity-0 scale-0 translate-y-2"
        )}
      />

      {/* 1. SMALL BUBBLE */}
      <div 
        className={clsx(
          "w-2 h-2 rounded-full bg-white/70 backdrop-blur-sm border border-white shadow-md transition-all duration-500 ease-out",
          isVisible 
            ? "opacity-100 scale-100 translate-y-0 delay-0" 
            : "opacity-0 scale-0 translate-y-1"
        )}
      />

      <style jsx>{`
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}