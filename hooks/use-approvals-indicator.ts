"use client";

import { useApprovalToast } from "./use-approval-toast";


export function useApprovalsIndicator() {
  const { unseenCount, markSeen } = useApprovalToast();
  return {
    hasApprovalDot: unseenCount > 0,
    unseenCount,
    markApprovalsSeen: markSeen,
  };
}
