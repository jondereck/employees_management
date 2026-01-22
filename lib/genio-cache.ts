export const GENIO_CACHE_KEY = "genio-session-v1";

export function loadGenioCache() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(GENIO_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveGenioCache(data: any) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GENIO_CACHE_KEY, JSON.stringify(data));
  } catch {}
}

export function clearGenioCache() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GENIO_CACHE_KEY);
}
