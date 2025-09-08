// src/utils/formDraft.ts
export type DraftSerializer = (v: unknown) => string;
export type DraftParser = <T = any>(s: string) => T;

export const serializeDraft: DraftSerializer = (v) =>
  JSON.stringify(v, (_k, val) => {
    // mark Date values so we can revive them later
    if (val instanceof Date) return { __type: "date", value: val.toISOString() };
    return val;
  });

export const parseDraft: DraftParser = (s) =>
  JSON.parse(s, (_k, val) => {
    if (val && val.__type === "date") return new Date(val.value);
    return val;
  });

// Simple debounce to avoid writing on every keystroke
export function debounce<T extends (...args: any[]) => void>(fn: T, ms = 400) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
