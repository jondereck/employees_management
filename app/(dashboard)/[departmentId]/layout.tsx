import { Navbar } from "@/components/navbar";

import prismadb from "@/lib/prismadb";
import { auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import ModalProvider from "./(routes)/(frontend)/providers/modal-provider";
import { Toaster } from "@/components/ui/toaster";
import { AskGenio } from "@/components/ai/ask-genio";
import PublicFooter from "@/components/public/footer";

export default async function DashboardLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { departmentId: string }
}) {
  const { userId } = auth();

  if (!userId) {
    redirect('/sign-in')
  }

  const department = await prismadb.department.findFirst({
    where: {
      id: params.departmentId,
      userId
    }
  });

  if (!department) {
    redirect('/');
  }

  return (
    <>
      <div>
        <ModalProvider />
        <Navbar />
       <AskGenio departmentId={params.departmentId}    />
        {children}
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
        <Toaster />
      </div>
    </>
  )
}