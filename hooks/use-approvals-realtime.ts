"use client";
import { useEffect } from "react";
import { pusherClient } from "@/lib/pusher-client";
import { ApprovalEvent } from "@/lib/types/realtime";

export function useApprovalsRealtime(
  departmentId: string,
  onEvent: (e: ApprovalEvent) => void
) {
  useEffect(() => {
    if (!departmentId) return;

    const channel = pusherClient.subscribe(`dept-${departmentId}-approvals`);
    const handler = (e: ApprovalEvent) => onEvent(e);

    channel.bind("approval:event", handler);

    return () => {
      channel.unbind("approval:event", handler);
      pusherClient.unsubscribe(`dept-${departmentId}-approvals`);
    };
  }, [departmentId, onEvent]);
}
