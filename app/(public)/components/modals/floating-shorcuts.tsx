// put this near the top of your file
import React from "react";
import { Button } from "@/components/ui/button";
import { HeartHandshake, PhoneCall } from "lucide-react";

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export function FloatingShortcuts() {
  const aRef = React.useRef<HTMLButtonElement | null>(null);
  const bRef = React.useRef<HTMLButtonElement | null>(null);

  // helper to (re)randomize motion for a given element
  const bump = React.useCallback((el: HTMLElement | null) => {
    if (!el) return;
    el.style.setProperty("--dx", `${rand(-6, 8)}px`);     // x travel
    el.style.setProperty("--dy", `${rand(-10, -4)}px`);   // y travel (mostly upward)
    el.style.setProperty("--dur", `${rand(2600, 4200)}ms`);
    el.style.setProperty("--delay", `${rand(0, 900)}ms`);
  }, []);

  React.useEffect(() => {
    // initial random states
    bump(aRef.current);
    bump(bRef.current);

    // set different intervals so they don't sync
    const tA = setInterval(() => bump(aRef.current), rand(3800, 5200));
    // offset B with a different, longer random cadence
    const tB = setInterval(() => bump(bRef.current), rand(5400, 7600));

    return () => {
      clearInterval(tA);
      clearInterval(tB);
    };
  }, [bump]);

  return (
    <>
      {/* floating container */}
    <div
  className="fixed z-50 flex flex-col items-end gap-3 print:hidden"
  style={{
    right: "calc(1rem + env(safe-area-inset-right))",
    bottom: "calc(5rem + env(safe-area-inset-bottom))",
  }}
>
        {/* Self-Service */}
        <Button
          ref={aRef}
          size="icon"
          className="floater h-12 w-12 rounded-full shadow-lg bg-pink-600 hover:bg-pink-700 text-white will-change-transform"
          onClick={() =>
            document.getElementById("self-service")?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
          aria-label="Open Self-Service"
        >
          <HeartHandshake className="h-5 w-5" />
        </Button>

        {/* Hotline */}
        <Button
          ref={bRef}
          size="icon"
          className="floater h-12 w-12 rounded-full shadow-lg bg-red-600 hover:bg-red-700 text-white will-change-transform"
          onClick={() =>
            document.getElementById("hotlines")?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
          aria-label="Open Hotline Directory"
        >
          <PhoneCall className="h-5 w-5" />
        </Button>
      </div>

      {/* animation styles (scoped) */}
      <style jsx>{`
        @keyframes drift {
          0%   { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(var(--dx, 4px), var(--dy, -6px), 0); }
        }
        .floater {
          animation-name: drift;
          animation-duration: var(--dur, 3200ms);
          animation-delay: var(--delay, 0ms);
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          animation-direction: alternate;
        }
        /* reduce motion respect */
        @media (prefers-reduced-motion: reduce) {
          .floater { animation: none; }
        }
      `}</style>
    </>
  );
}
