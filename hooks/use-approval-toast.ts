// app/store/use-approval-toast.ts
"use client";
import { ApprovalEvent } from "@/lib/types/realtime";
import { persist } from "zustand/middleware";
import { create } from "zustand";
type S = {
  unseenCount: number;
  lastEvents: ApprovalEvent[];
  push: (e: ApprovalEvent) => void;
  clear: () => void;
  markSeen: () => void;
  removeByApprovalId: (id: string) => void;   // ⬅ NEW
};

export const useApprovalToast = create<S>()(
  persist(
    (set, get) => ({
      unseenCount: 0,
      lastEvents: [],
      push: (e) =>
        set((s) => ({
          unseenCount: s.unseenCount + 1,
          lastEvents: [e, ...s.lastEvents].slice(0, 50),
        })),
      clear: () => set({ lastEvents: [], unseenCount: 0 }),
      markSeen: () => set((s) => ({ ...s, unseenCount: 0 })),
      removeByApprovalId: (id) =>
        set((s) => {
          const before = s.lastEvents.length;
          const afterList = s.lastEvents.filter((ev) => ev.approvalId !== id);
          const removed = before - afterList.length;
          // best-effort: if we removed something, reduce unseen by 1 (min 0)
          const unseen = Math.max(0, s.unseenCount - (removed > 0 ? 1 : 0));
          return { lastEvents: afterList, unseenCount: unseen };
        }),
    }),
    { name: "approvals-notifications", partialize: (s) => ({ unseenCount: s.unseenCount, lastEvents: s.lastEvents }) }
  )
);
