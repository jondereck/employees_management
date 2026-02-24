"use client";

import { useCallback, useEffect, useRef } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileCheck } from "lucide-react";

import { pusherClient } from "@/lib/pusher-client";
import { useApprovalToast } from "@/hooks/use-approval-toast";
import { ApprovalEvent, ApprovalResolvedEvent } from "@/lib/types/realtime";

export default function ApprovalsGlobalListener() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { push, removeByApprovalId } = useApprovalToast();

  const departmentId =
    typeof (params as any)?.departmentId === "string"
      ? (params as any).departmentId
      : Array.isArray((params as any)?.departmentId)
      ? (params as any).departmentId[0]
      : pathname?.match(/^\/([^/]+)/)?.[1] ?? "";



  const scheduleApprovalsRefresh = useCallback(() => {
    if (!departmentId) return;
    if (!pathname?.startsWith(`/${departmentId}/approvals`)) return;

    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      router.refresh();
    }, 120);
  }, [departmentId, pathname, router]);
  const onEvent = useCallback(
    (e: ApprovalEvent) => {
      if (!e.type.startsWith("request_")) return;

      push(e);

      const title =
        e.type === "request_created"
          ? `New ${e.entity} request created`
          : e.type === "request_updated"
          ? `${e.entity} request updated`
          : `${e.entity} request deleted`;

      toast(title, {
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

      scheduleApprovalsRefresh();
    },
    [push, scheduleApprovalsRefresh]
  );

  useEffect(() => {
    if (!departmentId) return;

    const channelName = `dept-${departmentId}-approvals`;
    const channel = pusherClient.subscribe(channelName);
    const onResolved = (e: ApprovalResolvedEvent) => {
      removeByApprovalId(e.approvalId);
      scheduleApprovalsRefresh();
    };

    channel.bind("approval:event", onEvent);
    channel.bind("approval:resolved", onResolved);

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      channel.unbind("approval:event", onEvent);
      channel.unbind("approval:resolved", onResolved);
      pusherClient.unsubscribe(channelName);
    };
  }, [departmentId, onEvent, removeByApprovalId, scheduleApprovalsRefresh]);

  return null;
}
