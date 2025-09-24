"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type TimelineEvent = { id: string; type: string; occurredAt: string; details?: string | null };

export default function TimelineEditModal({ employeeId, event, open, onOpenChange }:{
  employeeId: string;
  event: TimelineEvent | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ type: "", occurredAt: "", details: "", note: "" });

  useEffect(() => {
    if (event) {
      setForm({ type: event.type, occurredAt: event.occurredAt, details: event.details ?? "", note: "" });
    }
  }, [event]);

  const todayYMD = new Date().toISOString().slice(0, 10);

const toISODate = (raw: string) => {
  const s = (raw || "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + "T00:00:00.000Z").toISOString();
  const m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/); // MM-DD-YYYY or MM/DD/YYYY
  if (m) return new Date(`${m[3]}-${m[1]}-${m[2]}T00:00:00.000Z`).toISOString();
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const notFuture = (iso: string) => {
  const d = new Date(iso);
  const t = new Date();
  d.setHours(0,0,0,0);
  t.setHours(0,0,0,0);
  return d.getTime() <= t.getTime();
};


  const submit = async () => {
    const occurredAtISO = toISODate(form.occurredAt);
if (!occurredAtISO) {
  toast.error("Please enter a valid date");
  return;
}
if (!notFuture(occurredAtISO)) {
  toast.error("Timeline date cannot be in the future");
  return;
}

    if (!event) return;
    setLoading(true);
    try {
      const payload: any = {};
      if (form.type !== event.type) payload.type = form.type;
      if (form.occurredAt !== event.occurredAt) payload.occurredAt = form.occurredAt;
      if ((form.details || undefined) !== (event.details ?? undefined)) payload.details = form.details || null;
      if (form.note.trim()) payload.note = form.note.trim();

      if (Object.keys(payload).length === 0) {
        toast.info("No changes to submit");
        return;
      }

      const res = await fetch(`/api/public/employees/${employeeId}/timeline/${event.id}/request-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed to submit");
      toast.success("Submitted for HRMO approval");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <h3 className="text-base font-semibold">Suggest an edit (Timeline)</h3>
        <p className="text-xs text-muted-foreground">Your changes will be reviewed by HRMO before publication.</p>
        <div className="space-y-3 mt-3">
          <div>
            <label className="text-xs text-muted-foreground">Type</label>
            <Input value={form.type} onChange={e=>setForm(s=>({...s, type: e.target.value}))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Date (ISO)</label>
           <Input
  type="date"
  max={todayYMD}                           // ⛔ prevents picking future dates
  value={form.occurredAt}
  onChange={(e) => setForm(s => ({ ...s, occurredAt: e.target.value }))}
  placeholder="YYYY-MM-DD"
/>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Details (optional)</label>
            <Textarea value={form.details} onChange={e=>setForm(s=>({...s, details: e.target.value}))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Notes to HRMO (optional)</label>
            <Textarea value={form.note} onChange={e=>setForm(s=>({...s, note: e.target.value}))} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={()=>onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading ? "Submitting…" : "Submit for approval"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}