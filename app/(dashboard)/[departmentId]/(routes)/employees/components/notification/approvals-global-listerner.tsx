"use client";

import { useEffect, useCallback } from "react";
import { useParams, usePathname } from "next/navigation";
import { pusherClient } from "@/lib/pusher-client";
import { toast } from "sonner";
import { FileCheck } from "lucide-react";
import { useApprovalToast } from "@/hooks/use-approval-toast";
import { ApprovalEvent, ApprovalResolvedEvent } from "@/lib/types/realtime";

const REQUEST_TYPES = ["request_created", "request_updated", "request_deleted"] as const;

export default function ApprovalsGlobalListener() {
  const params = useParams();
  const pathname = usePathname();
  const { push, removeByApprovalId } = useApprovalToast();

  const departmentId =
    typeof (params as any)?.departmentId === "string"
      ? (params as any).departmentId
      : Array.isArray((params as any)?.departmentId)
      ? (params as any).departmentId[0]
      : pathname?.match(/^\/([^/]+)/)?.[1] ?? "";

  const onEvent = useCallback(
    (e: ApprovalEvent) => {
      if (!REQUEST_TYPES.includes(e.type as (typeof REQUEST_TYPES)[number])) return;

      push(e);
      const label = e.type.replace("request_", "").replace("_", " ");
      toast(`${e.entity} request ${label}`, {
        description: e.title
          ? `${e.title} • ${new Date(e.when).toLocaleString()}`
          : new Date(e.when).toLocaleString(),
        icon: <FileCheck className="w-4 h-4" />,
        duration: 4500,
        action: {
          label: "Open",
          onClick: () => (window.location.href = `/${e.departmentId}/approvals`),
        },
      });
    },
    [push]
  );

  const onResolved = useCallback((e: ApprovalResolvedEvent) => {
    removeByApprovalId(e.approvalId);
  }, [removeByApprovalId]);

  useEffect(() => {
    if (!departmentId) return;

    const chName = `dept-${departmentId}-approvals`;
    const ch = pusherClient.subscribe(chName);

    ch.bind("approval:event", onEvent);
    ch.bind("approval:resolved", onResolved);

    return () => {
      ch.unbind("approval:event", onEvent);
      ch.unbind("approval:resolved", onResolved);
      pusherClient.unsubscribe(chName);
    };
  }, [departmentId, onEvent, onResolved]);

  return null;
}
