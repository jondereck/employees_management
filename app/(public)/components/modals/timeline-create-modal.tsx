"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"

export default function TimelineCreateModal({ employeeId, open, onOpenChange }: {
  employeeId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ type: "HIRED", occurredAt: "", details: "", note: "" });

  const TYPE_OPTIONS = [
    "HIRED",
    "PROMOTED",
    "TRANSFERRED",
    "TRAINING",
    "REASSIGNED",
    "AWARDED",
    "CONTRACT_RENEWAL",
    "TERMINATED",
    "OTHER",
  ] as const;
  
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

const res = await fetch(`/api/public/employees/${employeeId}/timeline/request-create`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    type: form.type,               // keep your enum string as-is
    occurredAt: occurredAtISO,     // ✅ validated ISO
    details: form.details?.trim() || undefined,
    note: form.note?.trim() || undefined,
  }),
});

    const j = await res.json();
    if (!res.ok) {
      toast.error(j?.error || "Failed to submit");
      return;
    }
    toast.success("Submitted for HRMO approval");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <h3 className="text-base font-semibold">Suggest a new Timeline entry</h3>
        <p className="text-xs text-muted-foreground">Changes require HRMO approval.</p>
        <div className="space-y-3 mt-3">
          <div>
            <label className="text-xs text-muted-foreground">Type (EmploymentEventType)</label>
            <Select
              value={form.type}
              onValueChange={(v) => setForm((s) => ({ ...s, type: v }))}
              disabled={loading}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v.replace(/_/g, " ")}
                  </SelectItem>
                ))}

              </SelectContent>
            </Select>
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
            <Textarea value={form.details} onChange={e => setForm(s => ({ ...s, details: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Notes to HRMO (optional)</label>
            <Textarea value={form.note} onChange={e => setForm(s => ({ ...s, note: e.target.value }))} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading ? "Submitting…" : "Submit for approval"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}