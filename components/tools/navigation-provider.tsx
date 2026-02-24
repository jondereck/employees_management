"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import Loading from "@/app/loading";
import { cn } from "@/lib/utils";

interface ToolsNavigationContextValue {
  navigate: (href: string) => void;
}

const ToolsNavigationContext = React.createContext<ToolsNavigationContextValue | null>(null);

export function ToolsNavigationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = React.useState(false);

  const navigate = React.useCallback(
    (href: string) => {
      if (!href || href === pathname) {
        return;
      }

      setIsNavigating(true);
      router.push(href);
    },
    [pathname, router]
  );

  React.useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  return (
  <ToolsNavigationContext.Provider value={{ navigate }}>
  {/* Modern Frost Loading Overlay */}
  {isNavigating && (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/40 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative flex flex-col items-center gap-6">
        {/* Decorative background glow for the loader */}
        <div className="absolute -inset-10 bg-indigo-500/10 blur-3xl rounded-full animate-pulse" />
        
        {/* The Loader Component */}
        <div className="relative">
          <Loading />
        </div>

        <div className="flex flex-col items-center gap-1">
          <p className="relative text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600">
            Switching Tools
          </p>
          <div className="h-[2px] w-12 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full w-full origin-left bg-indigo-600 animate-progress" />
          </div>
        </div>
      </div>
    </div>
  )}

  {/* Page Content */}
  <div className={cn("transition-all duration-500", isNavigating && "scale-[0.99] opacity-50 blur-[2px] pointer-events-none")}>
    {children}
  </div>
</ToolsNavigationContext.Provider>
  );
}

export function useToolsNavigation() {
  const context = React.useContext(ToolsNavigationContext);
  if (!context) {
    throw new Error("useToolsNavigation must be used within a ToolsNavigationProvider");
  }

  return context;
}
