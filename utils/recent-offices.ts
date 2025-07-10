// utils/recentOffices.ts
const RECENT_KEY = "recentOffices";

export function getRecentOffices(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const all = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return all.slice(0, 3); // ✅ Limit to 3
  } catch {
    return [];
  }
}

export function updateRecentOffices(id: string) {
  if (typeof window === "undefined") return;
  const current = getRecentOffices();
  const updated = [id, ...current.filter((x) => x !== id)].slice(0, 5); // keep max 5
  localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
}
