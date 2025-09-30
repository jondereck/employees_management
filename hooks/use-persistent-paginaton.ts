// hooks/usePersistentPagination.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type PaginationState = { pageIndex: number; pageSize: number };

type Options = {
  /** localStorage key (per table) */
  storageKey: string;
  /** default pagination */
  initial?: PaginationState;
  /** also sync to URL ? */
  syncToUrl?: boolean;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(n, max));

export function usePersistentPagination({
  storageKey,
  initial = { pageIndex: 0, pageSize: 10 },
  syncToUrl = true,
}: Options) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // 1) pull from localStorage and URL (URL wins if syncToUrl)
  const boot = useMemo<PaginationState>(() => {
    let ls: PaginationState | null = null;
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) ls = JSON.parse(raw);
      } catch {}
    }
    let base = ls ?? initial;

    if (syncToUrl && params) {
      const p = params.get("page");
      const s = params.get("pageSize");
      base = {
        pageIndex: p ? Math.max(0, parseInt(p) - 1 || 0) : base.pageIndex,
        pageSize: s ? Math.max(1, parseInt(s) || base.pageSize) : base.pageSize,
      };
    }
    return base;
  }, [storageKey, initial, syncToUrl, params]);

  const [pagination, setPagination] = useState<PaginationState>(boot);

  // 2) persist to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(storageKey, JSON.stringify(pagination));
  }, [storageKey, pagination]);

  // 3) sync to URL (optional)
  useEffect(() => {
    if (!syncToUrl || !pathname) return;
    const url = new URL(window.location.href);
    url.searchParams.set("page", String(pagination.pageIndex + 1));
    url.searchParams.set("pageSize", String(pagination.pageSize));
    // avoid pushing if unchanged
    if (url.toString() !== window.location.href) {
      router.replace(`${pathname}?${url.searchParams.toString()}`);
    }
  }, [pagination, syncToUrl, pathname, router]);

  // 4) helpers
  const clampTo = (pageCount: number) => {
    setPagination((p) => ({
      ...p,
      pageIndex: clamp(p.pageIndex, 0, Math.max(0, pageCount - 1)),
    }));
  };

  return { pagination, setPagination, clampTo };
}
