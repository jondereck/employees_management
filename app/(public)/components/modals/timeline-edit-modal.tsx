"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";

type TimelineEvent = {
  id: string;
  type: string;           // UI label ("PROMOTION", "TRAINING", ...)
  occurredAt: string;     // ISO or YYYY-MM-DD
  title?: string | null;  // if your list passes it
  description?: string | null;
  attachment?: string | null;
  details?: string | null; // fallback (legacy)
};

const TYPE_OPTIONS = ["HIRED","PROMOTION","TRANSFER","TRAINING","SEPARATION","OTHER"] as const;

export default function TimelineEditModal({
  employeeId, event, open, onOpenChange,
}:{
  employeeId: string;
  event: TimelineEvent | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<typeof TYPE_OPTIONS[number]>("PROMOTION");
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [attachment, setAttachment] = useState("");
  const [note, setNote] = useState("");

  // hydrate form from event (supports both new fields and legacy details string)
  useEffect(() => {
    if (!event) return;
    const d = tryParseDetails(event);
    setType((TYPE_OPTIONS.includes(event.type as any) ? event.type : "PROMOTION") as any);
    setDate((event.occurredAt || "").slice(0,10));
    setTitle(d.title || "");
    setDesc(d.description || "");
    setAttachment(d.attachment || "");
    setNote("");
  }, [event]);

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

  function tryParseDetails(ev: TimelineEvent) {
    // prefer explicit fields from merged timeline feed
    if (ev.title || ev.description || ev.attachment) {
      return { title: ev.title ?? "", description: ev.description ?? "", attachment: ev.attachment ?? "" };
    }
    // fallback: parse JSON stored in details string if any
    const raw = (ev.details ?? "").trim();
    if (!raw) return { title: "", description: "", attachment: "" };
    try {
      const obj = JSON.parse(raw);
      return {
        title: (obj?.title ?? "").toString(),
        description: (obj?.description ?? "").toString(),
        attachment: obj?.attachment ? String(obj.attachment) : "",
      };
    } catch {
      // ultra-legacy: "Title — description"
      const [first, ...rest] = raw.split(" — ");
      return { title: first || "", description: rest.join(" — "), attachment: "" };
    }
  }

  async function submit() {
    if (!event) return;

    const occurredAt = toISO(date);
    if (!occurredAt) return toast.error("Please enter a valid date.");
    if (!notFuture(occurredAt)) return toast.error("Timeline date cannot be in the future.");

    // Build payload with only changes
    const original = tryParseDetails(event);
    const payload: Record<string, any> = {};
    if (type !== event.type) payload.type = type;
    if ((date || "") !== (event.occurredAt || "").slice(0,10)) payload.occurredAt = date;

    const nextDetails = JSON.stringify({
      title: title.trim(),
      description: (desc || "").trim(),
      attachment: (attachment || "").trim() || null,
    });
    const origDetails = JSON.stringify({
      title: original.title || "",
      description: original.description || "",
      attachment: original.attachment || "",
    });
    if (nextDetails !== origDetails) payload.details = nextDetails;

    if (note.trim()) payload.note = note.trim();

    if (Object.keys(payload).length === 0) {
      toast.info("No changes to submit");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(
        `/api/public/employees/${employeeId}/timeline/${event.id}/request-edit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed to submit");
      toast.success("Submitted for HRMO approval");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o)=>!loading && onOpenChange(o)}>
        <DialogContent
    className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto p-4 sm:p-6"
    // iOS smooth scrolling
    style={{ WebkitOverflowScrolling: "touch" }}
  >
        <h3 className="text-base font-semibold">Suggest an edit (Timeline)</h3>
        <p className="text-xs text-muted-foreground">Your changes will be reviewed by HRMO before publication.</p>

        <div className="space-y-3 mt-3">
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
            <Label>Date (ISO)</Label>
            <Input type="date" max={todayYMD} value={date} onChange={(e)=>setDate(e.target.value)} placeholder="YYYY-MM-DD" />
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

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={()=>onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button onClick={submit} disabled={loading}>{loading ? "Submitting…" : "Submit for approval"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
