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
        creatorName="made with ❤️ by JDN"
        creatorLink="https://hrps.vercel.app/f622687f-79c6-44e8-87c6-301a257582b2/view/employee/8458d76a-3c43-4c5a-bdaf-40af989500d6"
        creatorEffect="sparkle"
        systemLogo={{ src: "/icon-192x192.png", alt: "HRPS Logo", title: "HR Profiling System" }}
        hrLogo={{ src: "/hrmo-logo.png", alt: "HRMO Logo", title: "Human Resource Management Office" }}
        lguLogo={{ src: "/logo.png", alt: "LGU Lingayen Seal", title: "Municipality of Lingayen" }}
        brand={{
          c1: "#cf1337", // HRMO red (lead)
          c2: "#ff8fa3", // warm pink accent
          c3: "#ffd166", // gold pop
        }}
      />


    </div>
  );
}
