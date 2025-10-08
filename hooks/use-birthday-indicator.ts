"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type S = {
  dismissedDate: string | null;          // "YYYY-MM-DD"
  markTodaySeen: () => void;
};

export const useBirthdayIndicator = create<S>()(
  persist(
    (set) => ({
      dismissedDate: null,
      markTodaySeen: () => {
        const today = new Date().toISOString().slice(0, 10);
        set({ dismissedDate: today });
      },
    }),
    { name: "hrps-birthday-indicator" }
  )
);

// helper you can import
export function hasBirthdayDotForToday(hasCelebrantsToday: boolean, dismissedDate: string | null) {
  if (!hasCelebrantsToday) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dismissedDate !== today;
}
