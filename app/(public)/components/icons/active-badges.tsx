// components/icons/ActiveBadge.tsx
import * as React from "react";

function starPoints(
  cx = 12,
  cy = 12,
  spikes = 12,
  rOuter = 9.5,
  rInner = 7.6
) {
  const pts: string[] = [];
  const step = Math.PI / spikes;   // outer → inner every half-step
  let angle = -Math.PI / 2;        // start at top

  for (let i = 0; i < spikes; i++) {
    // outer vertex
    pts.push(`${cx + Math.cos(angle) * rOuter},${cy + Math.sin(angle) * rOuter}`);
    angle += step;
    // inner vertex
    pts.push(`${cx + Math.cos(angle) * rInner},${cy + Math.sin(angle) * rInner}`);
    angle += step;
  }
  return pts.join(" ");
}

export function ActiveBadge({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      role="img"
    >
      <defs>
        <linearGradient id="abg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#FF75C3" />
          <stop offset="1" stopColor="#FF2D8A" />
        </linearGradient>
      </defs>

      {/* Starburst (perfectly symmetric) */}
      <polygon
        points={starPoints(12, 12, 12, 9.5, 7.6)}
        fill="url(#abg)"
        shapeRendering="geometricPrecision"
      />

      {/* Check */}
      <path
        d="M16.6 9.4a1 1 0 0 0-1.41 0l-3.18 3.18-1.2-1.2a1 1 0 1 0-1.41 1.41l1.91 1.91c.39.39 1.02.39 1.41 0l3.88-3.88a1 1 0 0 0 0-1.41z"
        fill="#fff"
      />
    </svg>
  );
}
