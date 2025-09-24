"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";

export default function TimelineCreateModal({
  employeeId,
  open,
  onOpenChange,
  initial, // ⬅️ new
}: {
  employeeId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<{ type: string; occurredAt: string; details: string; note: string }>;
}) {
  const TYPE_OPTIONS = ["HIRED","PROMOTION","TRANSFER","TRAINING","SEPARATION","OTHER"] as const;

  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<typeof TYPE_OPTIONS[number]>("TRAINING");
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [attachment, setAttachment] = useState("");
  const [note, setNote] = useState("");

  

  useEffect(() => {
    if (open) {
      setType("TRAINING");
      setDate("");
      setTitle("");
      setDesc("");
      setAttachment("");
      setNote("");
    }
  }, [open]);


  const [form, setForm] = useState({
    type: "HIRED",
    occurredAt: "",
    details: "",
    note: "",
  });


    useEffect(() => {
    if (open && initial) {
      setForm((s) => ({
        ...s,
        ...(initial.type ? { type: initial.type } : {}),
        ...(initial.occurredAt ? { occurredAt: initial.occurredAt } : {}),
        ...(initial.details ? { details: initial.details } : {}),
        ...(initial.note ? { note: initial.note } : {}),
      }));
    }
  }, [open, initial]);

  const todayYMD = new Date().toISOString().slice(0, 10);

  const toISO = (raw: string) => {
    const s = (raw || "").trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00.000Z`;
    const m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    if (m) return `${m[3]}-${m[1]}-${m[2]}T00:00:00.000Z`;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };
  const notFuture = (iso: string) => {
    const d = new Date(iso), t = new Date();
    d.setHours(0,0,0,0); t.setHours(0,0,0,0);
    return d.getTime() <= t.getTime();
  };

  async function submit() {
    const occurredAt = toISO(date);
    if (!occurredAt) return toast.error("Please enter a valid date (YYYY-MM-DD).");
    if (!notFuture(occurredAt)) return toast.error("Date cannot be in the future.");

    const details = JSON.stringify({
      title: title.trim(),
      description: desc.trim(),
      attachment: attachment.trim() || null,
    });

    try {
      setLoading(true);
      const res = await fetch(`/api/public/employees/${employeeId}/timeline/request-create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,                // UI label; server maps UI -> Prisma enum
          occurredAt,
          details,
          note: note.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Submitted for HRMO approval");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to submit");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o)=>!loading && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <h3 className="text-base font-semibold">Add Timeline Event</h3>

        <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v)=>setType(v as typeof TYPE_OPTIONS[number])}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Date</Label>
            <Input type="date" max={todayYMD} value={date} onChange={e=>setDate(e.target.value)} placeholder="YYYY-MM-DD" />
            <p className="text-[11px] text-muted-foreground">Future dates are not allowed.</p>
          </div>

          <div className="space-y-1">
            <Label>Title</Label>
            <Input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="e.g., Disaster Preparedness Seminar" />
          </div>

          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea rows={3} value={desc} onChange={(e)=>setDesc(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Attachment URL (image/pdf)</Label>
            <Input value={attachment} onChange={(e)=>setAttachment(e.target.value)} placeholder="https://…" />
          </div>

          <div className="space-y-1">
            <Label>Notes to HRMO (optional)</Label>
            <Textarea rows={2} value={note} onChange={(e)=>setNote(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={()=>onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button onClick={submit} disabled={loading}>{loading ? "Submitting…" : "Submit for approval"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
