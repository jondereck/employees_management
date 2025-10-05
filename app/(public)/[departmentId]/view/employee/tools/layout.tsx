// app/(public)/layout.tsx
import type { ReactNode } from "react";
import AppFooter from "./components/footer";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">{children}</main>

      <AppFooter
        compact
        className="py-2"  // tighter than compact’s default
        left={<span className="text-xs text-muted-foreground">Submitted by Jon Dereck D. Nifas for ADS</span>}
        creatorMode="image"
        creatorImage={{
          src: "/creator-footer.png",
          alt: "Made by JDN",
          width: 80,   // shrink a bit
          height: 15,  // shrink a bit
          href: "https://www.facebook.com/share/1Auh25cDg4/",
          // highlightSrc: "/creator-footer-highlight.png",
        }}
        previewDelayMs={3000}
      />
    </div>
  );
}
