const FAVORITE_KEY = "favoriteOffices";

export function getFavoriteOffices(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(FAVORITE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function toggleFavoriteOffice(id: string) {
  const current = getFavoriteOffices();
  const updated = current.includes(id)
    ? current.filter((fav) => fav !== id)
    : [id, ...current];

  localStorage.setItem(FAVORITE_KEY, JSON.stringify(updated));
}
