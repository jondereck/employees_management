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
  systemLogo={{ src: "/icon-192x192.png", alt: "HRPS Logo" }}
  hrLogo={{ src: "/hrmo-logo.png", alt: "HRMO Logo" }}
  lguLogo={{ src: "/logo.png", alt: "LGU Lingayen Seal" }}
  brand={{ c1: "#cf1337", c2: "#ff8fa3", c3: "#ffd166" }}
  creatorMode="image"
    creatorImage={{
    src: "/creator-footer.png",
    alt: "Made by JDN",
    width: 96,
    height: 18,
    href: "https://jdnifas.netlify.app/" // ← opened when tapped/clicked
  }}
  dense={true}                  // compact mobile (default true)
  showYearOnMobile={true}      // hide © on very small screens
  
/>

{/* V1
   <PublicFooter
  systemName="HR Profiling System"
  creatorName="JDN Systems"
  creatorLink="https://hrps.vercel.app/..."
  creatorEffect="sparkle"
  systemLogo={{ src: "/icon-192x192.png", alt: "HRPS Logo", title: "HR Profiling System" }}
  hrLogo={{ src: "/hrmo-logo.png", alt: "HRMO Logo", title: "Human Resource Management Office" }}
  lguLogo={{ src: "/logo.png", alt: "LGU Lingayen Seal", title: "Municipality of Lingayen" }}
   footerImage={{
    src: "/creator-footer.png",
    fit: "contain",
    rounded: true,
    height: 72,
  }}
/> */}





    </div>
  );
}
