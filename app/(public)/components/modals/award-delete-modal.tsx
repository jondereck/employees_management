"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AlertTriangle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
    className="w-[calc(100vw-2rem)] sm:max-w-md p-0 border-none bg-white/90 dark:bg-slate-900/95 backdrop-blur-2xl rounded-[40px] shadow-[0_50px_100px_-20px_rgba(225,29,72,0.2)] overflow-hidden"
  >
    {/* Warning Header: Glow effect */}
    <div className="relative p-6 text-center">
      <div className="absolute inset-0 bg-gradient-to-b from-rose-500/10 to-transparent" />
      
      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 ring-8 ring-rose-500/5 animate-pulse">
          <Trash2 className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-black tracking-tight text-slate-800 dark:text-white">Request Deletion</h3>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-rose-600 dark:text-rose-400">Security Verification Required</p>
      </div>
    </div>

    <div className="px-6 pb-6 space-y-6">
      {/* Informational Warning Box */}
      <div className="p-4 rounded-2xl bg-rose-500/[0.03] border border-rose-500/10 flex gap-3">
        <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0" />
        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          Removal requests are irreversible once approved by HRMO. Please state clearly why this record is no longer valid or should be retracted from your official profile.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between ml-1">
          <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">Reason for Removal</label>
          <span className={cn(
            "text-[10px] font-bold",
            reason.trim().length < 5 ? "text-rose-400" : "text-emerald-500"
          )}>
            {reason.trim().length}/5 min
          </span>
        </div>
        
        <Textarea 
          value={reason} 
          onChange={e => setReason(e.target.value)} 
          placeholder="e.g. Duplicate entry, incorrect achievement, or clerical error..." 
          className="min-h-[120px] rounded-3xl border-white/40 dark:border-white/10 bg-white/50 dark:bg-black/20 backdrop-blur-sm focus:ring-rose-500 transition-all resize-none p-4 text-sm"
        />
      </div>

      {/* Action Suite */}
      <div className="flex flex-col gap-3 pt-2">
        <Button 
          variant="destructive" 
          className="w-full h-12 rounded-full font-black uppercase tracking-widest bg-rose-600 hover:bg-rose-700 shadow-xl shadow-rose-500/20 active:scale-95 transition-all disabled:opacity-50"
          onClick={submit} 
          disabled={loading || reason.trim().length < 5}
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Processing...
            </div>
          ) : "Submit Deletion Request"}
        </Button>
        
        <Button 
          variant="ghost" 
          className="w-full h-12 rounded-full font-bold text-slate-400 hover:text-slate-600 dark:hover:bg-white/5" 
          onClick={() => onOpenChange(false)}
        >
          Nevermind, Keep it
        </Button>
      </div>
    </div>
    
    {/* Subtle footer accent */}
    <div className="h-1.5 w-full bg-gradient-to-r from-transparent via-rose-500/20 to-transparent" />
  </DialogContent>
</Dialog>
  );
}