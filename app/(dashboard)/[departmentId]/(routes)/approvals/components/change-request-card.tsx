"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function prettyJSON(value: any) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function fieldRows(oldValues?: Record<string, any> | null, newValues?: Record<string, any> | null) {
  const oldV = (oldValues ?? {}) as Record<string, any>;
  const newV = (newValues ?? {}) as Record<string, any>;
  const keys = Array.from(new Set([...Object.keys(oldV), ...Object.keys(newV)]));
  return keys.map((k) => {
    const before = oldV[k];
    const after = newV[k];
    const changed = JSON.stringify(before) !== JSON.stringify(after);
    return { key: k, before, after, changed };
  });
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

  const onApprove = async () => {
    try {
      setLoading("approve");
      const res = await fetch(`/api/admin/${departmentId}/change-requests/${cr.id}/approve`, { method: "POST" });
      if (!res.ok) throw new Error("Approve failed");
      toast.success("Change approved and applied.");
      startTransition(() => router.refresh());
    } catch (e: any) {
      toast.error(e.message || "Error approving change");
    } finally {
      setLoading(null);
    }
  };

  const onReject = async () => {
    try {
      setLoading("reject");
      const res = await fetch(`/api/admin/${departmentId}/change-requests/${cr.id}/reject`, { method: "POST" });
      if (!res.ok) throw new Error("Reject failed");
      toast.success("Change request rejected.");
      startTransition(() => router.refresh());
    } catch (e: any) {
      toast.error(e.message || "Error rejecting change");
    } finally {
      setLoading(null);
    }
  };

  const rows = fieldRows(cr.oldValues as any, cr.newValues as any);
  const isCreate = cr.action === "CREATE";
  const isDelete = cr.action === "DELETE";
  const title = `${cr.entityType} • ${cr.action}`;

  const empName = `${cr.employee?.firstName ?? ""} ${cr.employee?.middleName?.[0] ? cr.employee.middleName[0] + "." : ""} ${cr.employee?.lastName ?? ""} ${cr.employee?.suffix ?? ""}`.replace(/\s+/g, " ").trim();

  return (
    <Card className="border rounded-xl p-4 space-y-3">
<div className="flex items-start justify-between gap-2">
  <div>
    <div className="text-sm text-muted-foreground">
      {empName} • {cr.employee?.offices?.name ?? "—"}
    </div>
    <h3 className="text-base font-semibold">{title}</h3>
    {cr.note && (
      <p className="text-xs text-muted-foreground mt-1">Note: {cr.note}</p>
    )}
    {(cr.submittedName || cr.submittedEmail) && (
      <p className="text-xs text-muted-foreground">
        From: {cr.submittedName ?? "Anonymous"}
        {cr.submittedEmail ? ` • ${cr.submittedEmail}` : ""}
      </p>
    )}
  </div>

  {/* ✅ show real status, not hard-coded */}
  <Badge variant={
    cr.status === "PENDING"   ? "secondary" :
    cr.status === "APPROVED"  ? "default"   :
    /* REJECTED or others */     "destructive"
  }>
    {cr.status}
  </Badge>
</div>

      {/* Diff table */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2 w-40">Field</th>
              <th className="text-left px-3 py-2">Current</th>
              <th className="text-left px-3 py-2">Proposed</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-2 text-muted-foreground" colSpan={3}>
                  {isCreate ? "No fields (unexpected)." : isDelete ? "No proposed fields for DELETE." : "No changes found."}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.key} className={r.changed ? "bg-amber-50/70" : ""}>
                <td className="align-top px-3 py-2 font-medium whitespace-nowrap">{r.key}</td>
                <td className="align-top px-3 py-2 text-xs">
                  <pre className="whitespace-pre-wrap break-words">{prettyJSON(r.before)}</pre>
                </td>
                <td className="align-top px-3 py-2 text-xs">
                  <pre className="whitespace-pre-wrap break-words">{prettyJSON(r.after)}</pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

     <div className="flex justify-end gap-2">
  <Button
    variant="outline"
    onClick={onReject}
    disabled={!!loading || isPending || cr.status !== "PENDING"}
  >
    {loading === "reject" ? "Rejecting…" : "Reject"}
  </Button>
  <Button
    onClick={onApprove}
    disabled={!!loading || isPending || cr.status !== "PENDING"}
  >
    {loading === "approve" ? "Approving…" : "Approve"}
  </Button>
</div>
    </Card>
  );
}