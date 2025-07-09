"use client";
import { useEffect, useState } from "react";

const quotes = [
  "Initializing......",
  "Fetching user data......",
  "Loading settings...",
  "Almost done...",
  "Done!",
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
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className="relative">
        <div className="relative w-20 h-20">
          <svg className="w-full h-full" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" stroke="#e5e7eb" strokeWidth="10" fill="none" />
            <g transform="rotate(-90 50 50)">
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="#16a34a"
                strokeWidth="10"
                fill="none"
                strokeDasharray={2 * Math.PI * 45}
                strokeDashoffset={2 * Math.PI * 45 * (1 - progress / 100)}
                strokeLinecap="round"
              />
            </g>
          </svg>

          {/* ✅ Add logo and percentage overlay here */}
          <div className="absolute inset-0 flex items-center justify-center">
            <img
              src="/icon-192x192.png"
              alt="Logo"
              className="w-10 h-10 opacity-20 absolute"
            />
            <span
              className="relative z-10 text-green-700 font-bold text-md "
              style={{
                WebkitTextStroke: "0.2px green", // outline effect
              }}
            >
              {progress}%
            </span>
          </div>
        </div>

      </div>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">Please wait...</p>
        <p className="mt-1 text-green-600 text-xs tracking-wide uppercase">
          <LoadingDotsWithTypewriter text="Loading your next screen" />
        </p>
        <p className="mt-2 text-xs text-muted-foreground italic">
          {progress < 20 && "Initializing..."}
          {progress >= 20 && progress < 40 && "Loading resources..."}
          {progress >= 40 && progress < 70 && "Fetching employee data..."}
          {progress >= 70 && progress < 90 && "Almost done..."}
          {progress >= 90 && progress < 100 && "Finalizing..."}
          {progress === 100 && "Ready!"}
        </p>


        {progress >= 98 && (
          <p className="mt-4 text-xs text-red-400">
            Taking longer than usual...{" "}
            <button
              onClick={() => window.location.reload()}
              className="underline"
            >
              Reload
            </button>
          </p>
        )}

      </div>

    </div>

  );
}
