"use client";

import { useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, History, FileCheck } from "lucide-react";
import { toast } from "sonner";
import { useApprovalsRealtime } from "@/hooks/use-approvals-realtime";
import { useApprovalToast } from "@/hooks/use-approval-toast";
import { ApprovalEvent } from "@/lib/types/realtime";

type Props = {
  departmentId: string;
  onNavigate?: (href: string) => void; // optional custom nav, defaults to window.location
};

export default function ApprovalsRealtimeTab({ departmentId, onNavigate }: Props) {
  const { push, unseenCount, lastEvents } = useApprovalToast();

  const onApprovalEvent = useCallback((e: ApprovalEvent) => {
    push(e);
    toast(
      e.type === "created"
        ? `New ${e.entity} approval created`
        : `${e.entity} approval ${e.type}`,
      {
        description: e.title
          ? `${e.title} • ${new Date(e.when).toLocaleString()}`
          : new Date(e.when).toLocaleString(),
        icon: <FileCheck className="w-4 h-4" />,
        action: {
          label: "Open",
          onClick: () => {
            const href = `/${e.departmentId}/approvals`;
            if (onNavigate) onNavigate(href);
            else window.location.href = href;
          },
        },
        duration: 5000,
      }
    );
  }, [onNavigate, push]);

  useApprovalsRealtime(departmentId || "", onApprovalEvent);

  return (
    <div className="p-2">
      <div className="mb-2 flex items-center gap-2">
        <History className="w-5 h-5" />
        <h3 className="font-semibold">Approvals</h3>
        {unseenCount > 0 && (
          <span className="ml-auto inline-flex items-center justify-center rounded-full bg-primary/10 px-2 py-0.5 text-xs">
            {unseenCount} new
          </span>
        )}
      </div>

      {lastEvents.length === 0 ? (
        <p className="text-sm text-gray-500 text-center">No recent approval activity</p>
      ) : (
        <ul className="space-y-2 max-h-72 overflow-y-auto">
          {lastEvents.map((e, i) => (
            <li key={`${e.approvalId}-${i}`} className="flex items-start justify-between rounded-md border p-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium capitalize">
                    {e.entity} • {e.type}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1 truncate">
                  {e.title ?? e.targetId}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {new Date(e.when).toLocaleString()}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="ml-2 shrink-0"
                onClick={() => {
                  const href = `/${e.departmentId}/approvals`;
                  if (onNavigate) onNavigate(href);
                  else window.location.href = href;
                }}
              >
                View
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
