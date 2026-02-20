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
  {/* HEADER SECTION */}
  <div className="mb-4 flex items-center gap-3 px-2">
    <div className="p-2 bg-blue-500/10 rounded-xl">
      <History className="w-4 h-4 text-blue-600" />
    </div>
    <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">Approvals</h3>
    {unseenCount > 0 && (
      <span className="ml-auto inline-flex items-center justify-center rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-black text-white shadow-lg shadow-blue-500/20">
        {unseenCount} NEW
      </span>
    )}
  </div>

  {/* CONTENT SECTION */}
  {lastEvents.length === 0 ? (
    <div className="py-10 text-center">
       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
         No recent activity
       </p>
    </div>
  ) : (
    <ul className="space-y-3 max-h-80 overflow-y-auto no-scrollbar pr-1">
      {lastEvents.map((e, i) => (
        <li 
          key={`${e.approvalId}-${i}`} 
          className="flex items-center justify-between p-3 bg-white/40 backdrop-blur-sm border border-white/40 rounded-2xl transition-all hover:bg-white/60 group"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="text-sm font-bold text-slate-800 capitalize truncate">
                {e.entity} • {e.type}
              </span>
            </div>
            
            {/* TRUNCATED TITLE */}
            <div className="text-[11px] font-medium text-slate-500 mt-0.5 truncate pl-5">
              {e.title ?? e.targetId}
            </div>
            
            <div className="text-[10px] font-bold text-slate-400 mt-1 pl-5 uppercase tracking-tight">
              {new Date(e.when).toLocaleDateString()} • {new Date(e.when).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="ml-3 shrink-0 h-8 rounded-xl bg-blue-500/10 text-blue-600 font-black text-[10px] uppercase tracking-wider hover:bg-blue-600 hover:text-white transition-all active:scale-95"
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
