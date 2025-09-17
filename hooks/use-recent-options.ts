// hooks/useRecentOptions.ts
"use client";

import { useEffect, useMemo, useState } from "react";

export type Opt = { value: string; label: string };

const KEY = (fieldKey: string) => `recent:${fieldKey}`;

export function useRecentOptions(fieldKey: string, allOptions: Opt[], max = 3) {
  const [recents, setRecents] = useState<Opt[]>([]);

  // load on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY(fieldKey));
      if (!raw) return;
      const saved: Opt[] = JSON.parse(raw) || [];
      setRecents(saved.slice(0, max));
    } catch {}
  }, [fieldKey, max]);

  // keep only recents that still exist in the current options
  const filtered = useMemo(() => {
    const allowed = new Set(allOptions.map(o => o.value));
    const uniq: Opt[] = [];
    const seen = new Set<string>();
    for (const r of recents) {
      if (allowed.has(r.value) && !seen.has(r.value)) {
        uniq.push(r);
        seen.add(r.value);
      }
      if (uniq.length >= max) break;
    }
    return uniq;
  }, [recents, allOptions, max]);

  function pushRecent(opt: Opt) {
    try {
      const raw = localStorage.getItem(KEY(fieldKey));
      const list: Opt[] = raw ? JSON.parse(raw) : [];
      const next = [opt, ...list.filter(x => x.value !== opt.value)].slice(0, max);
      localStorage.setItem(KEY(fieldKey), JSON.stringify(next));
      setRecents(next);
    } catch {}
  }

  return { recentOptions: filtered, pushRecent };
}
