"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import PreSubmitAgreement from "../agreements/pre-submit-agreement";

type TimelineEvent = {
  id: string;
  type: string;           // UI label ("PROMOTION", "TRAINING", ...)
  occurredAt: string;     // ISO or YYYY-MM-DD
  title?: string | null;  // if your list passes it
  description?: string | null;
  attachment?: string | null;
  details?: string | null; // fallback (legacy)
};

const TYPE_OPTIONS = ["HIRED", "PROMOTION", "TRANSFER", "TRAINING", "SEPARATION", "OTHER"] as const;

export default function TimelineEditModal({
  employeeId, event, open, onOpenChange,
}: {
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
  const [agreeOpen, setAgreeOpen] = useState(false);
   const payloadRef = useRef<Record<string, any> | null>(null);

  // hydrate form from event (supports both new fields and legacy details string)
  useEffect(() => {
    if (!event) return;
    const d = tryParseDetails(event);
    setType((TYPE_OPTIONS.includes(event.type as any) ? event.type : "PROMOTION") as any);
    setDate((event.occurredAt || "").slice(0, 10));
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
    d.setHours(0, 0, 0, 0); t.setHours(0, 0, 0, 0);
    return d.getTime() <= t.getTime();
  };

  function tryParseDetails(ev: TimelineEvent) {
      const base = {
    title: ev.title ?? "",
    description: ev.description ?? "",
    attachment: ev.attachment ?? "",
    
  };
    // prefer explicit fields from merged timeline feed
    if (ev.title || ev.description || ev.attachment) {
      return { title: ev.title ?? "", description: ev.description ?? "", attachment: ev.attachment ?? "" };
    }
    // fallback: parse JSON stored in details string if any
    const raw = (ev.details ?? "").trim();
    if (!raw) return { title: "", description: "", attachment: "" };
    
    try {
       const obj = JSON.parse(raw);
    const issuer = obj?.issuer ? String(obj.issuer).trim() : "";
    const thumbnail = obj?.thumbnail ? String(obj.thumbnail).trim() : "";
    const tags = obj?.tags ? String(obj.tags).trim() : "";
      return {
        title: (obj?.title ?? "").toString(),
        description: (obj?.description ?? "").toString(),
        attachment: obj?.attachment ? String(obj.attachment) : "",
        issuer,
      thumbnail,
      tags,
      };
    } catch {
      // ultra-legacy: "Title — description"
      const [first, ...rest] = raw.split(" — ");
       return { title: first || base.title, description: rest.join(" — ") || base.description, attachment: base.attachment, issuer: "", thumbnail: "", tags: [] };
    }
  }

  function buildPayloadOrToast() {
    if (!event) return null;

    const occurredAtISO = toISO(date);
    if (!occurredAtISO) { toast.error("Please enter a valid date."); return null; }
    if (!notFuture(occurredAtISO)) { toast.error("Timeline date cannot be in the future."); return null; }

    const original = tryParseDetails(event);
    const payload: Record<string, any> = {};

    if (type !== event.type) payload.type = type;
    if ((date || "") !== (event.occurredAt || "").slice(0, 10)) payload.occurredAt = date;

   function normDetails(x: { title?: any; description?: any; attachment?: any }) {
  const t = (x?.title ?? "").toString().trim();
  const d = (x?.description ?? "").toString().trim();
  const aRaw = x?.attachment ?? "";
  const aStr = (typeof aRaw === "string" ? aRaw : String(aRaw)).trim();
  return {
    title: t,
    description: d,
    attachment: aStr ? aStr : null, // empty -> null on BOTH sides
  };
}

const prev = normDetails(original);
const curr = normDetails({ title, description: desc, attachment });

if (JSON.stringify(curr) !== JSON.stringify(prev)) {
  payload.details = JSON.stringify(curr);
}

  

    if (note.trim()) payload.note = note.trim();

    if (Object.keys(payload).length === 0) {
      toast.info("No changes to submit");
      return null;
    }
    return payload;
  }

  function handleSubmitClick() {
    const payload = buildPayloadOrToast();
    if (!payload) return;                  // invalid or no changes
    payloadRef.current = payload;          // stash for confirm
    setAgreeOpen(true);                    // OPEN AGREEMENT ONLY
  }

  async function doSubmit(payload: Record<string, any>) {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/public/employees/${employeeId}/timeline/${event!.id}/request-edit`,
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
      payloadRef.current = null;
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
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
              <Select value={type} onValueChange={(v) => setType(v as typeof TYPE_OPTIONS[number])}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Date (ISO)</Label>
              <Input type="date" max={todayYMD} value={date} onChange={(e) => setDate(e.target.value)} placeholder="YYYY-MM-DD" />
              <p className="text-[11px] text-muted-foreground">Future dates are not allowed.</p>
            </div>

            <div className="space-y-1">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Disaster Preparedness Seminar" />
            </div>

            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label>Attachment URL (image/pdf)</Label>
              <Input value={attachment} onChange={(e) => setAttachment(e.target.value)} placeholder="https://…" />
            </div>

            <div className="space-y-1">
              <Label>Notes to HRMO (optional)</Label>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            <div className="flex justify-end gap-2 pt-1">
             <Button variant="outline" onClick={()=>onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button onClick={handleSubmitClick} disabled={loading}>
              {loading ? "Submitting…" : "Submit for approval"}
            </Button>
            </div>

          </div>
          {/* 2) Drop-in agreement */}
           <PreSubmitAgreement
        actionId="timeline.request-edit"
        open={agreeOpen}
        onOpenChange={setAgreeOpen}
        onConfirm={() => {
          if (payloadRef.current) {
            doSubmit(payloadRef.current);
          } else {
            // safety: rebuild if something cleared it
            const p = buildPayloadOrToast();
            if (p) doSubmit(p);
          }
        }}
        disabled={loading}
        title="Before you submit your edit"
        confirmLabel="I understand — submit"
      >
        <p>
          Before we approve your timeline edit, HRMO may ask you to submit necessary supporting documents
          to verify authenticity (e.g., training certificates, promotion orders, transfer memos).
        </p>
        <ul className="list-disc pl-5">
          <li>Provide scans or clear photos (PDF or image) if requested</li>
          <li>Dates/titles should match the official documents</li>
          <li>False or misleading submissions may be rejected</li>
        </ul>
      </PreSubmitAgreement>
        </DialogContent>
      </Dialog>
    </>


  );
}
