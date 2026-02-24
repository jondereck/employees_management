"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useApprovalToast } from "@/hooks/use-approval-toast";
import { cn } from "@/lib/utils";

function formatValue(key: string, value: any) {
  if (value === null || value === undefined) return "—";

  // Format dates
  if (key === "occurredAt" || key === "givenAt") {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
  }

  // Format enums nicely
  if (key === "type" && typeof value === "string") {
    return value
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // Format JSON details (timeline)
  if (key === "details" && typeof value === "string") {
    try {
      const obj = JSON.parse(value);
      return (
        <div className="space-y-1">
          {obj.title && <div><strong>Title:</strong> {obj.title}</div>}
          {obj.description && <div><strong>Description:</strong> {obj.description}</div>}
          {obj.attachment && (
            <div>
              <strong>Attachment:</strong>{" "}
              <a href={obj.attachment} target="_blank" className="text-indigo-600 underline">
                View File
              </a>
            </div>
          )}
        </div>
      );
    } catch {
      return value;
    }
  }

  return String(value);
}

function fieldRows(
  oldValues?: Record<string, any> | null,
  newValues?: Record<string, any> | null,
  action?: "CREATE" | "UPDATE" | "DELETE",
  entityType?: string
) {
  const oldV = (oldValues ?? {}) as Record<string, any>;
  const newV = (newValues ?? {}) as Record<string, any>;

  // CREATE → show only new fields
if (action === "CREATE") {
  if (entityType === "TIMELINE") {
    const timelineFields = ["type", "details", "occurredAt"];

    return timelineFields.map((k) => ({
      key: k,
      before: undefined,
      after: newV[k] ?? undefined,
      changed: true,
    }));
  }

  // fallback for other entities
  return Object.keys(newV).map((k) => ({
    key: k,
    before: undefined,
    after: newV[k],
    changed: true,
  }));
}

  // DELETE → show everything being deleted
  if (action === "DELETE") {
    return Object.keys(oldV).map((k) => ({
      key: k,
      before: oldV[k],
      after: undefined,
      changed: true,
    }));
  }

  // UPDATE → show only changed fields
  return Object.keys(newV)
    .map((k) => {
      const before = oldV[k];
      const after = newV[k];
      const changed = JSON.stringify(before) !== JSON.stringify(after);

      return changed
        ? { key: k, before, after, changed: true }
        : null;
    })
    .filter(Boolean) as any[];
}

export default function ChangeRequestCard({
  cr,
  departmentId,
}: {
  cr: any;
  departmentId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const { removeByApprovalId } = useApprovalToast();

  const onApprove = async () => {
  const toastId = toast.loading("Approving change...");

  try {
    setLoading("approve");

    const res = await fetch(
      `/api/admin/${departmentId}/change-requests/${cr.id}/approve`,
      { method: "POST" }
    );

    if (!res.ok) throw new Error("Approve failed");

    removeByApprovalId(cr.id);

    startTransition(() => router.refresh());

    toast.success("Change approved and applied.", {
      id: toastId,
    });
  } catch (e: any) {
    toast.error(e.message || "Error approving change", {
      id: toastId,
    });
  } finally {
    setLoading(null);
  }
};

const onReject = async () => {
  const toastId = toast.loading("Rejecting change...");

  try {
    setLoading("reject");

    const res = await fetch(
      `/api/admin/${departmentId}/change-requests/${cr.id}/reject`,
      { method: "POST" }
    );

    if (!res.ok) throw new Error("Reject failed");

    removeByApprovalId(cr.id);

    // Wait a frame before refresh
    await new Promise((resolve) => setTimeout(resolve, 300));

    startTransition(() => {
      router.refresh();
    });

    toast.success("Change request rejected.", { id: toastId });
  } catch (e: any) {
    toast.error(e.message || "Error rejecting change", {
      id: toastId,
    });
  } finally {
    setLoading(null);
  }
};

  const rows = fieldRows(
  cr.oldValues as any,
  cr.newValues as any,
  cr.action,
  cr.entityType
);
  const isCreate = cr.action === "CREATE";
  const isDelete = cr.action === "DELETE";
  const title = `${cr.entityType} • ${cr.action}`;

  const empName = `${cr.employee?.firstName ?? ""} ${cr.employee?.middleName?.[0] ? cr.employee.middleName[0] + "." : ""} ${cr.employee?.lastName ?? ""} ${cr.employee?.suffix ?? ""}`.replace(/\s+/g, " ").trim();

  return (
<Card className="relative overflow-hidden border-white/40 bg-white/30 backdrop-blur-2xl rounded-[2rem] p-6 shadow-2xl transition-all duration-300 hover:shadow-indigo-500/10">
  {/* Header Section */}
  <div className="flex items-start justify-between gap-4 mb-6">
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
        <span className="px-2 py-0.5 rounded-md bg-slate-200/50">{cr.employee?.offices?.name ?? "No Office"}</span>
        <span>•</span>
        <span>{empName}</span>
      </div>
      <h3 className="text-lg font-black text-slate-800 tracking-tight leading-tight">
        {title}
      </h3>
      
      {cr.note && (
        <div className="mt-2 flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 border border-amber-200/50">
          <span className="text-[10px] font-black uppercase text-amber-600 mt-0.5">Note:</span>
          <p className="text-xs font-medium text-amber-700 leading-relaxed">{cr.note}</p>
        </div>
      )}

      {(cr.submittedName || cr.submittedEmail) && (
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-2">
          Request By: <span className="text-slate-600">{cr.submittedName ?? "Anonymous"}</span>
          {cr.submittedEmail && <span className="ml-1 opacity-60">• {cr.submittedEmail}</span>}
        </p>
      )}
    </div>

    <Badge 
      className={cn(
        "rounded-full px-4 py-1 text-[10px] font-black uppercase tracking-widest border-none shadow-sm",
        cr.status === "PENDING"   ? "bg-amber-100 text-amber-700" :
        cr.status === "APPROVED"  ? "bg-emerald-100 text-emerald-700" : 
                                    "bg-rose-100 text-rose-700"
      )}
    >
      {cr.status}
    </Badge>
  </div>

  {/* Comparison UI (Diff Table Replacement) */}
  <div className="rounded-2xl border border-white/60 bg-white/40 overflow-hidden shadow-inner">
    <div className="grid grid-cols-12 bg-slate-900/5 border-b border-white/60 text-[10px] font-black uppercase tracking-widest text-slate-500">
      <div className="col-span-3 px-4 py-2">Field</div>
      <div className="col-span-4 px-4 py-2 border-l border-white/60">Current State</div>
      <div className="col-span-5 px-4 py-2 border-l border-white/60">Proposed Change</div>
    </div>

    <div className="divide-y divide-white/40">
      {rows.length === 0 ? (
        <div className="p-8 text-center text-xs font-medium text-slate-400 italic">
          {isCreate ? "New Record Entry" : isDelete ? "Request for Deletion" : "No changes detected."}
        </div>
      ) : (
        rows.map((r) => (
          <div key={r.key} className={cn(
            "grid grid-cols-12 text-xs transition-colors",
            r.changed ? "bg-indigo-500/5" : "hover:bg-white/40"
          )}>
            {/* Label */}
            <div className="col-span-3 px-4 py-3 font-bold text-slate-700 border-r border-white/40 bg-white/20">
              {r.key}
            </div>
            
            {/* Before */}
            <div className="col-span-4 px-4 py-3 font-mono text-[11px] text-slate-500 break-words line-through decoration-rose-300 decoration-2">
           {formatValue(r.key, r.before)}
            </div>
            
            {/* After */}
            <div className={cn(
              "col-span-5 px-4 py-3 font-mono text-[11px] break-words border-l border-white/40",
              r.changed ? "text-indigo-700 font-bold bg-indigo-500/5" : "text-slate-500"
            )}>
        {formatValue(r.key, r.after)}
              {r.changed && <div className="mt-1 text-[9px] font-black uppercase text-indigo-400">Modified</div>}
            </div>
          </div>
        ))
      )}
    </div>
  </div>

  {/* Action Footer */}
  <div className="mt-6 flex items-center justify-between">
    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
       {cr.status === "PENDING" ? "Requires Admin Review" : `Finalized by HRMO`}
    </div>
    
    <div className="flex gap-2">
      <Button
        variant="ghost"
        size="sm"
        className="rounded-xl px-6 font-black text-[10px] uppercase tracking-widest text-rose-600 hover:bg-rose-50 hover:text-rose-700"
        onClick={onReject}
        disabled={!!loading || cr.status !== "PENDING"}
      >
        {loading === "reject" ? "Rejecting…" : "Reject"}
      </Button>
      
      <Button
        size="sm"
        className="rounded-xl px-8 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-0.5 active:scale-95"
        onClick={onApprove}
        disabled={!!loading || cr.status !== "PENDING"}
      >
        {loading === "approve" ? "Approving…" : "Approve Changes"}
      </Button>
    </div>
  </div>
</Card>
  );
}