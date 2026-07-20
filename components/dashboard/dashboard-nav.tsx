"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import Loading from "@/app/loading";
import { cn } from "@/lib/utils";

type DashboardNavContextValue = {
  navigate: (href: string) => void;
};

const DashboardNavContext = createContext<DashboardNavContextValue | null>(null);

export function DashboardNavProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(false);
  }, [pathname]);

  const navigate = useCallback(
    (href: string) => {
      const pathOnly = href.split("?")[0] ?? href;
      if (pathOnly !== pathname) {
        setLoading(true);
        router.push(href);
      } else if (href.includes("?")) {
        // Same path, possibly different query (e.g. birthdays month)
        const currentSearch =
          typeof window !== "undefined" ? window.location.search : "";
        const nextSearch = href.slice(href.indexOf("?"));
        if (nextSearch !== currentSearch) {
          setLoading(true);
          router.push(href);
        }
      }
    },
    [pathname, router],
  );

  const value = useMemo(() => ({ navigate }), [navigate]);

  return (
    <DashboardNavContext.Provider value={value}>
      {loading ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/40 backdrop-blur-md">
          <div className="animate-pulse rounded-full border border-white/30 bg-white/20 p-8 shadow-2xl">
            <Loading />
          </div>
        </div>
      ) : null}
      {children}
    </DashboardNavContext.Provider>
  );
}

function useDashboardNav() {
  const ctx = useContext(DashboardNavContext);
  if (!ctx) {
    throw new Error("DashboardNavLink must be used within DashboardNavProvider");
  }
  return ctx;
}

type DashboardNavLinkProps = {
  href: string;
  className?: string;
  children: React.ReactNode;
};

export function DashboardNavLink({ href, className, children }: DashboardNavLinkProps) {
  const { navigate } = useDashboardNav();

  return (
    <button
      type="button"
      onClick={() => navigate(href)}
      className={cn("text-left", className)}
    >
      {children}
    </button>
  );
}
