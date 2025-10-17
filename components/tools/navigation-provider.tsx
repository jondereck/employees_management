"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import Loading from "@/app/loading";

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
      {isNavigating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-black/80">
          <Loading />
        </div>
      )}
      {children}
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
