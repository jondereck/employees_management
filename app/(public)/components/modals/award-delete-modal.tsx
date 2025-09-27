"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function AwardDeleteModal({ employeeId, awardId, open, onOpenChange }:{
  employeeId: string;
  awardId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");

  

  const submit = async () => {
    if (!awardId) return;
    if (reason.trim().length < 5) {
      toast.error("Please provide a brief reason");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/public/employees/${employeeId}/awards/${awardId}/request-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed to submit");
      toast.success("Deletion request submitted for HRMO approval");
      onOpenChange(false);
      setReason("");
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
    className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto p-4 sm:p-6"
    // iOS smooth scrolling
    style={{ WebkitOverflowScrolling: "touch" }}
  >
        <h3 className="text-base font-semibold">Request deletion (Award)</h3>
        <p className="text-xs text-muted-foreground">Your request will be reviewed by HRMO.</p>
        <div className="mt-3">
          <label className="text-xs text-muted-foreground">Reason</label>
          <Textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Why should this be removed?" />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={()=>onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={loading || reason.trim().length < 5}>{loading ? "Submitting…" : "Submit request"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}