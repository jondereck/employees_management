// app/components/notifications/ApprovalsGlobalListener.tsx
"use client";

import { useEffect, useCallback } from "react";
import { useParams, usePathname } from "next/navigation";
import { pusherClient } from "@/lib/pusher-client";

import { toast } from "sonner";
import { FileCheck } from "lucide-react";
import { useApprovalToast } from "@/hooks/use-approval-toast";
import { ApprovalEvent, ApprovalResolvedEvent } from "@/lib/types/realtime";

export default function ApprovalsGlobalListener() {
  const params = useParams();
  const pathname = usePathname();

  const { push, removeByApprovalId } = useApprovalToast();

  // robust deptId (navbar may be above the segment)
  const departmentId =
    typeof (params as any)?.departmentId === "string"
      ? (params as any).departmentId
      : Array.isArray((params as any)?.departmentId)
      ? (params as any).departmentId[0]
      : pathname?.match(/^\/([^/]+)/)?.[1] ?? "";

  const onEvent = useCallback((e: ApprovalEvent) => {
    // 1) save to store (increments unseen + keeps list)
    push(e);
    // 2) optional toast (you can remove if you only want dot/panel)
    toast(
      e.type === "created"
        ? `New ${e.entity} request created`
        : `${e.entity} request ${e.type}`,
      {
        description: e.title
          ? `${e.title} • ${new Date(e.when).toLocaleString()}`
          : new Date(e.when).toLocaleString(),
        icon: <FileCheck className="w-4 h-4" />,
        duration: 4500,
        action: {
          label: "Open",
          onClick: () => (window.location.href = `/${e.departmentId}/approvals`),
        },
      }
    );
  }, [push]);

  useEffect(() => {
    if (!departmentId) return;
    const chName = `dept-${departmentId}-approvals`;
    const ch = pusherClient.subscribe(chName);
    ch.bind("approval:event", onEvent);

    ch.bind("approval:resolved", (e: ApprovalResolvedEvent) => {
  removeByApprovalId(e.approvalId);
});

    return () => {
      ch.unbind("approval:event", onEvent);
      pusherClient.unsubscribe(chName);
    };
  }, [departmentId, onEvent]);

  return null;
}
