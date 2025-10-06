// app/store/use-approval-toast.ts
"use client";
import { ApprovalEvent } from "@/lib/types/realtime";
import { create } from "zustand";

type S = {
  unseenCount: number;
  lastEvents: ApprovalEvent[];
  push: (e: ApprovalEvent) => void;
  clear: () => void;
  markSeen: () => void;
};

export const useApprovalToast = create<S>((set) => ({
  unseenCount: 0,
  lastEvents: [],
  push: (e) =>
    set((s) => ({
      unseenCount: s.unseenCount + 1,
      lastEvents: [e, ...s.lastEvents].slice(0, 20),
    })),
  clear: () => set({ lastEvents: [], unseenCount: 0 }),
  markSeen: () => set({ unseenCount: 0 }),
}));
