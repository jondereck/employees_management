"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AlertTriangle, History, Trash, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";

export default function TimelineDeleteModal({ employeeId, eventId, open, onOpenChange }:{
  employeeId: string;
  eventId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");

  const submit = async () => {
    if (!eventId) return;
    if (reason.trim().length < 5) { toast.error("Please provide a brief reason"); return; }
    setLoading(true);
    try {
     const res = await fetch(`/api/public/employees/${employeeId}/timeline/${eventId}/request-delete`, {
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
    className="w-[calc(100vw-2rem)] sm:max-w-md p-0 border-none bg-white/90 dark:bg-slate-950/95 backdrop-blur-2xl rounded-[40px] shadow-[0_50px_100px_-20px_rgba(225,29,72,0.25)] overflow-hidden"
  >
    {/* Warning Header: Radiating Caution */}
    <div className="relative p-8 text-center">
      {/* Liquid Aura */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-rose-500/20 blur-[60px] rounded-full pointer-events-none" />
      
      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 ring-1 border border-rose-500/20 shadow-[0_0_20px_rgba(244,63,94,0.1)]">
      
          <Trash2 className="h-8 w-8 relative z-10" />
        </div>
        <h3 className="text-xl font-black tracking-tight text-slate-800 dark:text-white">Retract Timeline Entry</h3>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-rose-600 dark:text-rose-400">Archival Removal Request</p>
      </div>
    </div>

    <div className="px-8 pb-8 space-y-6">
      {/* Alert Banner */}
      <div className="group p-4 rounded-2xl bg-rose-500/[0.03] border border-rose-500/10 transition-colors hover:bg-rose-500/[0.05]">
        <div className="flex gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0" />
          <p className="text-[11px] leading-relaxed font-medium text-slate-600 dark:text-slate-400">
          Removal requests are irreversible once approved by HRMO. Please state clearly why this record is no longer valid or should be retracted from your official profile.
          </p>
        </div>
      </div>

      {/* Input Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Justification</label>
          <span className={cn(
            "text-[9px] font-bold px-2 py-0.5 rounded-full border",
            reason.trim().length < 5 
              ? "text-rose-500 border-rose-500/20 bg-rose-500/5" 
              : "text-emerald-500 border-emerald-500/20 bg-emerald-500/5"
          )}>
            {reason.trim().length} / 5 characters min
          </span>
        </div>
        
        <Textarea 
          value={reason} 
          onChange={e => setReason(e.target.value)} 
          placeholder="Describe why this milestone should be struck from the record..." 
          className="min-h-[120px] rounded-[24px] border-white/40 dark:border-white/10 bg-white/50 dark:bg-black/20 backdrop-blur-sm focus:ring-rose-500 transition-all resize-none p-4 text-sm leading-relaxed shadow-inner"
        />
      </div>

      {/* Action Suite */}
      <div className="flex flex-col gap-3 pt-2">
        <Button 
          variant="destructive" 
          className="w-full h-12 rounded-full font-black uppercase tracking-[0.15em] bg-rose-600 hover:bg-rose-700 shadow-xl shadow-rose-500/20 active:scale-[0.98] transition-all disabled:opacity-40"
          onClick={submit} 
          disabled={loading || reason.trim().length < 5}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Processing...
            </span>
          ) : "Confirm Deletion Request"}
        </Button>
        
        <Button 
          variant="ghost" 
          className="w-full h-12 rounded-full font-bold text-slate-400 hover:text-slate-600 dark:hover:bg-white/5 transition-colors" 
          onClick={() => onOpenChange(false)}
        >
          Keep in Timeline
        </Button>
      </div>
    </div>
    
    {/* Decorative Bottom Bezel */}
    <div className="h-1.5 w-full bg-gradient-to-r from-transparent via-rose-500/20 to-transparent" />
  </DialogContent>
</Dialog>
  );
}