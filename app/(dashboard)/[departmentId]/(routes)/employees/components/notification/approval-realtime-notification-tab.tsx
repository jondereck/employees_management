"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle, History } from "lucide-react";
import { useApprovalToast } from "@/hooks/use-approval-toast";

type Props = {
  departmentId: string;
};

export default function ApprovalsRealtimeTab({ departmentId: _departmentId }: Props) {
  const { unseenCount, lastEvents } = useApprovalToast();

  return (
    <div className="p-2">
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

                <div className="text-[11px] font-medium text-slate-500 mt-0.5 truncate pl-5">
                  {e.title ?? e.targetId}
                </div>

                <div className="text-[10px] font-bold text-slate-400 mt-1 pl-5 uppercase tracking-tight">
                  {new Date(e.when).toLocaleDateString()} • {new Date(e.when).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="ml-3 shrink-0 h-8 rounded-xl bg-blue-500/10 text-blue-600 font-black text-[10px] uppercase tracking-wider hover:bg-blue-600 hover:text-white transition-all active:scale-95"
                onClick={() => {
                  window.location.href = `/${e.departmentId}/approvals`;
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
