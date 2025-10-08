"use client";

import { useEffect } from "react";
import { useRouter, useParams, usePathname } from "next/navigation";
import { pusherClient } from "@/lib/pusher-client";
import { ApprovalEvent } from "@/lib/types/realtime";


export default function ApprovalsRealtime() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();

  const departmentId =
    typeof (params as any)?.departmentId === "string"
      ? (params as any).departmentId
      : Array.isArray((params as any)?.departmentId)
      ? (params as any).departmentId[0]
      : (() => {
          const m = pathname?.match(/^\/([^/]+)/);
          return m?.[1] ?? "";
        })();

  useEffect(() => {
    if (!departmentId) return;

    const chName = `dept-${departmentId}-approvals`;
    const ch = pusherClient.subscribe(chName);

    const handler = (_e: ApprovalEvent) => {
      // Re-fetch the server component page list
      router.refresh();
    };

    ch.bind("approval:event", handler);

    return () => {
      ch.unbind("approval:event", handler);
      pusherClient.unsubscribe(chName);
    };
  }, [departmentId, router]);

  return null;
}
