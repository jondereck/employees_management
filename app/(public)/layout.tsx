// app/(public)/layout.tsx
import FooterPup from "@/components/footer-pup";
import PublicFooter from "@/components/public/footer";
import type { ReactNode } from "react";


export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      {/* Content gets extra bottom padding so the fixed footer won't overlap */}
      <main className="pb-24">{children}</main>
  {/* <FooterPup className="mt-4" height={44} speed={24} enabledByDefault /> */}
        <PublicFooter
              systemName="HR Profiling System"
              creatorName="made with ❤️ by Niffy"
              creatorLink="https://www.linkedin.com/in/jdnifas/"
              systemLogo={{ src: "/icon-192x192.png", alt: "HRPS Logo", title: "HR Profiling System" }}
              hrLogo={{ src: "/hrmo-logo.png", alt: "HRMO Logo", title: "Human Resource Management Office" }}
              lguLogo={{ src: "/logo.png", alt: "LGU Lingayen Seal", title: "Municipality of Lingayen" }}
            />

              
    </div>
  );
}
