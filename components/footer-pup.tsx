"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

export default function FooterPup({
  className = "",
  height = 44,
  speed = 24,
  enabledByDefault = true,
}: {
  className?: string;
  height?: number;
  speed?: number;
  enabledByDefault?: boolean;
}) {
  const [enabled, setEnabled] = useState(enabledByDefault);
  const [reduced, setReduced] = useState(false);
  const [tailWag, setTailWag] = useState(false);
  const [overrideXvw, setOverrideXvw] = useState<number | null>(null);
  const [boneXvw, setBoneXvw] = useState<number | null>(null);
  const [bark, setBark] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    function onGoto(e: Event) {
      const ce = e as CustomEvent<{ x?: number; side?: "left" | "right" }>;
      let x = ce.detail?.x;
      if (x == null && ce.detail?.side) x = ce.detail.side === "left" ? 0.06 : 0.9;
      if (typeof x === "number") {
        const clamped = Math.max(0, Math.min(1, x));
        setOverrideXvw(clamped * 100);
        window.clearTimeout((onGoto as any)._t);
        (onGoto as any)._t = window.setTimeout(() => setOverrideXvw(null), 1600);
      }
    }
    function onWag() {
      setTailWag(true);
      window.setTimeout(() => setTailWag(false), 900);
    }
    function onBone(e: Event) {
      const ce = e as CustomEvent<{ x?: number; side?: "left" | "right" }>;
      let x = ce.detail?.x;
      if (x == null && ce.detail?.side) x = ce.detail.side === "left" ? 0.15 : 0.85;
      if (x == null) x = Math.random() * 0.7 + 0.15;
      const clamped = Math.max(0.05, Math.min(0.95, x));
      setBoneXvw(clamped * 100);
      setOverrideXvw(clamped * 100);
      setTailWag(true);
      window.setTimeout(() => setTailWag(false), 1000);
      window.setTimeout(() => setOverrideXvw(null), 1600);
      window.setTimeout(() => setBoneXvw(null), 2000);
    }
    function onBark() {
      setBark(true);
      window.setTimeout(() => setBark(false), 700);
    }
    document.addEventListener("pup:goto", onGoto as EventListener);
    document.addEventListener("pup:wag", onWag as EventListener);
    document.addEventListener("pup:bone", onBone as EventListener);
    document.addEventListener("pup:bark", onBark as EventListener);
    return () => {
      document.removeEventListener("pup:goto", onGoto as EventListener);
      document.removeEventListener("pup:wag", onWag as EventListener);
      document.removeEventListener("pup:bone", onBone as EventListener);
      document.removeEventListener("pup:bark", onBark as EventListener);
    };
  }, []);

  const svgHeight = height;
  const svgWidth = useMemo(() => (200 / 100) * height, [height]);

  function bonkTail() {
    setTailWag(true);
    setTimeout(() => setTailWag(false), 900);
  }

  const varStyle = { ["--pup-h" as any]: `${svgHeight}px` } as React.CSSProperties;

  return (
    <div className={"relative select-none " + (className || "")} aria-hidden>
      <div className="absolute -top-8 right-2 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setEnabled((v) => !v)}
          className="group inline-flex items-center gap-1 rounded-full border bg-background/80 px-3 py-1 text-xs shadow-sm backdrop-blur-md hover:bg-background"
          aria-label={enabled ? "Turn off footer mascot" : "Turn on footer mascot"}
        >
          <BoneIcon className="h-4 w-4 opacity-80 group-hover:opacity-100 transition-transform group-active:scale-90" />
          <span className="font-medium">{enabled ? "Hide Pup" : "Show Pup"}</span>
        </button>
        <button
          type="button"
          onClick={() => document.dispatchEvent(new CustomEvent("pup:bone"))}
          className="inline-flex items-center gap-1 rounded-full border bg-background/80 px-3 py-1 text-xs shadow-sm backdrop-blur-md hover:bg-background"
          aria-label="Throw bone"
        >
          <BoneIcon className="h-4 w-4" />
          Bone
        </button>
        <button
          type="button"
          onClick={() => document.dispatchEvent(new CustomEvent("pup:bark"))}
          className="inline-flex items-center gap-1 rounded-full border bg-background/80 px-3 py-1 text-xs shadow-sm backdrop-blur-md hover:bg-background"
          aria-label="Bark"
        >
          🗨️ Bark
        </button>
      </div>

      <div
        ref={trackRef}
        className="relative h-[var(--pup-h)] w-full overflow-visible pointer-events-none"
        style={varStyle}
      >
        <div
          className={[
            "absolute bottom-0 left-0 will-change-transform pointer-events-auto",
            enabled && !reduced && overrideXvw == null ? "pup-walk" : "",
          ].join(" ")}
          style={{
            animationDuration: `${speed}s`,
            transform: overrideXvw != null ? `translateX(${overrideXvw}vw)` : undefined,
          }}
        >
          <DogSVG
            width={svgWidth}
            height={svgHeight}
            wag={tailWag}
            idle={!enabled || reduced}
            bark={bark}
            onClick={bonkTail}
          />
          {boneXvw != null ? (
            <div
              className="absolute bottom-[6px] left-0"
              style={{ transform: `translateX(${boneXvw}vw)` }}
            >
              <svg width={height * 0.6} height={height * 0.3} viewBox="0 0 48 24" aria-hidden>
                <path d="M6 6a6 6 0 1 1 8 5h20a6 6 0 1 1 8-5 6 6 0 1 1-8 7H14a6 6 0 1 1-8-7z" fill="#F5D14B"/>
              </svg>
            </div>
          ) : null}
        </div>
      </div>

      <style jsx>{`
        .pup-walk { animation-name: walkAcross; animation-timing-function: linear; animation-iteration-count: infinite; }
        @keyframes walkAcross { 0% { transform: translateX(-20%) } 49.999% { transform: translateX(100vw) scaleX(1); } 50% { transform: translateX(100vw) scaleX(-1); } 100% { transform: translateX(-20%) scaleX(-1); } }
      `}</style>
    </div>
  );
}

function DogSVG({ width, height, wag, idle, bark, onClick }: { width: number; height: number; wag: boolean; idle: boolean; bark?: boolean; onClick?: () => void; }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 100"
      className="drop-shadow-sm cursor-pointer select-none"
      role="img"
      aria-label="Footer mascot dog"
      onClick={onClick}
    >
      <ellipse cx="100" cy="92" rx="34" ry="6" fill="rgba(0,0,0,0.15)" />
      <g>
        <rect x="60" y="45" width="80" height="28" rx="16" fill="#A06B4E" />
        <rect x="64" y="51" width="72" height="16" rx="8" fill="#D7B49E" opacity="0.6" />
        <g>
          <circle cx="52" cy="52" r="17" fill="#A06B4E" />
          <ellipse cx="44" cy="58" rx="10" ry="8" fill="#FFE8D6" />
          <circle cx="38" cy="56" r="2.5" fill="#333" />
          <path d="M41 61 q3 3 6 0" stroke="#333" strokeWidth="1.5" fill="none" />
          <path d="M44 62 q2 3 0 6 q-4 0 -4 -2 q0 -2 4 -4" fill="#FF7DA6" opacity="0.9" />
          <path d="M44 45 q-8 0 -8 10 q6 -2 12 2" fill="#8D5D44" />
          <path d="M60 45 q8 0 8 10 q-6 -2 -12 2" fill="#8D5D44" />
          <g style={{transformOrigin:"48px 52px", animation:"blink 4.2s infinite"}}>
            <circle cx="48" cy="52" r="3.4" fill="#fff" />
            <circle cx="48.6" cy="52.2" r="1.6" fill="#111" />
            <circle cx="49.2" cy="51.6" r="0.6" fill="#fff" />
          </g>
          <g style={{transformOrigin:"56px 52px", animation:"blink 4.2s 0.2s infinite"}}>
            <circle cx="56" cy="52" r="3.4" fill="#fff" />
            <circle cx="56.6" cy="52.2" r="1.6" fill="#111" />
            <circle cx="57.2" cy="51.6" r="0.6" fill="#fff" />
          </g>
          <circle cx="49" cy="60" r="3.2" fill="#FFA8C7" opacity="0.6" />
          <circle cx="59" cy="60" r="3.2" fill="#FFA8C7" opacity="0.6" />
        </g>
        <rect x="66" y="44" width="68" height="6" rx="3" fill="#4F46E5" />
        <circle cx="70" cy="52" r="3" fill="#F5D14B" style={{transformOrigin:"70px 52px", animation: idle ? undefined : "collarJiggle 1.2s ease-in-out infinite"}} />
        <g transform="translate(140,54)">
          <Tail wag={wag} idle={idle} />
        </g>
        <Leg x={78} y={73} delay={0} idle={idle} />
        <Leg x={96} y={73} delay={0.15} idle={idle} />
        <Leg x={114} y={73} delay={0.3} idle={idle} />
        <Leg x={132} y={73} delay={0.45} idle={idle} />
        <g style={{opacity: wag ? 1 : 0, transition: "opacity 200ms", transform: "translate(118px,42px)"}}>
          <g style={{animation: wag ? "floatUp 900ms ease-out" : undefined}}>
            <path d="M8 2 C8 -1 12 -1 12 2 C12 5 8 7 10 10 C8 7 4 5 4 2 C4 -1 8 -1 8 2 Z" fill="#FF6B9A" />
          </g>
        </g>
      </g>
      {bark ? (
        <g style={{ transform: "translate(64px,34px)" }}>
          <rect x="0" y="0" width="36" height="16" rx="8" fill="#fff" stroke="#111" strokeWidth="1" />
          <text x="18" y="11" fontSize="8" textAnchor="middle" fill="#111" fontFamily="ui-sans-serif, system-ui">WOOF!</text>
        </g>
      ) : null}
      <title>Click me to wag my tail 🐶</title>
      <style>{`
        @keyframes step { 0% { transform: translateY(0) } 50% { transform: translateY(-1.5px) } 100% { transform: translateY(0) } }
        @keyframes wag { 0% { transform: rotate(12deg) } 50% { transform: rotate(-18deg) } 100% { transform: rotate(12deg) } }
        @keyframes wiggle { 0% { transform: rotate(0deg) } 25% { transform: rotate(10deg) } 50% { transform: rotate(-10deg) } 75% { transform: rotate(6deg) } 100% { transform: rotate(0deg) } }
        @keyframes blink { 0%, 46%, 100% { transform: scaleY(1); } 48% { transform: scaleY(0.12); } 50% { transform: scaleY(1); } }
        @keyframes floatUp { 0% { transform: translateY(0) scale(0.9); opacity: 0.4 } 60% { opacity: 1 } 100% { transform: translateY(-12px) scale(1.05); opacity: 0 } }
        @keyframes collarJiggle { 0% { transform: rotate(0deg) } 50% { transform: rotate(10deg) } 100% { transform: rotate(0deg) } }
      `}</style>
    </svg>
  );
}

function Tail({ wag, idle }: { wag: boolean; idle: boolean }) {
  return (
    <g
      style={{
        transformOrigin: "0px 0px",
        animation: wag ? "wiggle 0.9s ease-in-out" : idle ? undefined : "wag 0.6s ease-in-out infinite",
      }}
    >
      <path d="M0 0 q20 -6 26 10 q-8 2 -18 -2 q-4 -2 -8 -8" fill="#3b3b3b" />
    </g>
  );
}

function Leg({ x, y, delay, idle }: { x: number; y: number; delay: number; idle: boolean }) {
  return (
    <g
      style={{
        transformBox: "fill-box",
        transformOrigin: "50% 0%",
        animation: idle ? undefined : `step 0.6s ${delay}s ease-in-out infinite`,
      }}
    >
      <rect x={x} y={y - 8} width={6} height={10} rx={2} fill="#2b2b2b" />
      <rect x={x - 2} y={y} width={10} height={4} rx={2} fill="#111" />
    </g>
  );
}

function BoneIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M6 4a2 2 0 0 1 2 2c0 .3-.06.58-.17.84l.33.32h7.68l.33-.32A2 2 0 1 1 18 6a2 2 0 0 1-2-2h-1a2 2 0 0 1-2 2h-2A2 2 0 0 1 9 4H8a2 2 0 0 1-2 2 2 2 0 1 1 0-4Z" fill="currentColor"/>
      <rect x="4" y="9" width="16" height="6" rx="3" fill="currentColor"/>
      <circle cx="6" cy="6" r="2" fill="currentColor"/>
      <circle cx="18" cy="6" r="2" fill="currentColor"/>
    </svg>
  );
}
