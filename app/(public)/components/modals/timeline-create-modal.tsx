"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";

type UiType = "HIRED" | "PROMOTION" | "TRANSFER" | "TRAINING" | "SEPARATION" | "OTHER";

const TYPE_MAP: Record<UiType, string> = {
  HIRED: "HIRED",
  PROMOTION: "PROMOTED",
  TRANSFER: "TRANSFERRED",
  TRAINING: "OTHER",
  SEPARATION: "TERMINATED",
  OTHER: "OTHER",
};
const TYPE_OPTIONS: readonly UiType[] = ["HIRED","PROMOTION","TRANSFER","TRAINING","SEPARATION","OTHER"] as const;

function normalizeUiType(input?: string): UiType {
  if (!input) return "OTHER";
  const up = input.toUpperCase();

  // if it's already a UI label
  if ((TYPE_OPTIONS as readonly string[]).includes(up)) return up as UiType;

  // if it's a backend enum, reverse-map it
  const rev = (Object.entries(TYPE_MAP) as [UiType, string][])
    .find(([, v]) => v === up)?.[0];

  return rev ?? "OTHER";
}

export default function TimelineCreateModal({
  employeeId,
  open,
  onOpenChange,
  initial, // { type?: string; occurredAt?: string; details?: string; note?: string }
}: {
  employeeId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<{ type: string; occurredAt: string; details: string; note: string }>;
}) {
  const [loading, setLoading] = useState(false);

  // --- single source of truth for inputs ---
  const [type, setType] = useState<UiType>("TRAINING");
  const [date, setDate] = useState("");       // yyyy-mm-dd
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [attachment, setAttachment] = useState("");
  const [note, setNote] = useState("");
useEffect(() => {
  if (!open) return;

  // defaults
  const _type = normalizeUiType(initial?.type);
  let _date = "";
  let _title = "";
  let _desc = "";
  let _attachment = "";
  const _note = initial?.note ?? "";

  if (initial?.occurredAt) {
    const d = new Date(initial.occurredAt);
    _date = isNaN(d.getTime())
      ? (/^\d{4}-\d{2}-\d{2}$/.test(initial.occurredAt) ? initial.occurredAt : "")
      : d.toISOString().slice(0, 10);
  }

  if (initial?.details) {
    try {
      const obj = JSON.parse(initial.details);
      if (obj && typeof obj === "object") {
        _title = obj.title ?? "";
        _desc = obj.description ?? "";
        _attachment = obj.attachment ?? "";
      } else {
        _desc = String(initial.details);
      }
    } catch {
      _desc = initial.details;
    }
  }

  setType(_type);
  setDate(_date);
  setTitle(_title);
  setDesc(_desc);
  setAttachment(_attachment);
  setNote(_note);
}, [open, initial]);


  const todayYMD = new Date().toISOString().slice(0, 10);

  const toISO = (raw: string) => {
    const s = (raw || "").trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00.000Z`;
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
      // Optional: tag TRAINING when type is OTHER so reviewers see intent
      ...(type === "TRAINING" ? { tag: "TRAINING" } : {}),
    });

    try {
      setLoading(true);
      const res = await fetch(`/api/public/employees/${employeeId}/timeline/request-create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: TYPE_MAP[type],        // map UI -> backend enum
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
const TITLE_PLACEHOLDERS: Record<UiType, string> = {
  HIRED: "e.g., Initial appointment — Administrative Aide I",
  PROMOTION: "e.g., Promoted to Administrative Aide II (SG 3, Step 1)",
  TRANSFER: "e.g., Transferred to MSWDO — Case Management Unit",
  TRAINING: "e.g., Disaster Preparedness Seminar",
  SEPARATION: "e.g., Retirement effective 2025-06-30",
  OTHER: "e.g., Special assignment: Project Lead",
};

const DESC_PLACEHOLDERS: Record<UiType, string> = {
  HIRED: "Optional details: Plantilla no., item no., memo/order ref., etc.",
  PROMOTION: "Optional details: Memo no., effective date, salary grade/step, basis.",
  TRANSFER: "Optional details: From Office → To Office, effective date, order no.",
  TRAINING: "Optional details: Venue, hours, organizer, certificate URL.",
  SEPARATION: "Optional details: Reason (retirement, resignation), last day, docs.",
  OTHER: "Optional details you want HRMO to see.",
};

  return (
    <Dialog open={open} onOpenChange={(o)=>!loading && onOpenChange(o)}>
       <DialogContent
    className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto p-4 sm:p-6"
    // iOS smooth scrolling
    style={{ WebkitOverflowScrolling: "touch" }}
  >
        <h3 className="text-base font-semibold">Create a custom timeline entry</h3>

        <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v)=>setType(v as UiType)}>
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
            <Input value={title} onChange={(e)=>setTitle(e.target.value)}    placeholder={TITLE_PLACEHOLDERS[type]}/>
          </div>

          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea rows={3} value={desc} onChange={(e)=>setDesc(e.target.value)}    placeholder={DESC_PLACEHOLDERS[type]}  />
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
