"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import PreSubmitAgreement from "../agreements/pre-submit-agreement";
import { CheckCircle2, History, Link2 } from "lucide-react";

type UiType = "HIRED" | "AWARD" | "PROMOTION" | "TRANSFER" | "TRAINING" | "SEPARATION" | "OTHER";

const TYPE_MAP: Record<UiType, string> = {
  HIRED: "HIRED",
  AWARD: "AWARD",
  PROMOTION: "PROMOTED",
  TRANSFER: "TRANSFERRED",
  TRAINING: "OTHER",
  SEPARATION: "TERMINATED",
  OTHER: "OTHER",
};
const TYPE_OPTIONS: readonly UiType[] = ["HIRED", "AWARD", "PROMOTION", "TRANSFER", "TRAINING", "SEPARATION", "OTHER"] as const;

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


  const [agreeOpen, setAgreeOpen] = useState(false);
  const payloadRef = useRef<Record<string, any> | null>(null);
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
    d.setHours(0, 0, 0, 0); t.setHours(0, 0, 0, 0);
    return d.getTime() <= t.getTime();
  };

  function buildPayloadOrToast() {
    const occurredAt = toISO(date);
    if (!occurredAt) { toast.error("Please enter a valid date (YYYY-MM-DD)."); return null; }
    if (!notFuture(occurredAt)) { toast.error("Date cannot be in the future."); return null; }

    const details = JSON.stringify({
      title: title.trim(),
      description: desc.trim(),
      attachment: (attachment || "").trim() || null,
      ...(type === "TRAINING" ? { tag: "TRAINING" } : {}),
    });

    return {
      type: TYPE_MAP[type],
      occurredAt,
      details,
      note: note.trim() || undefined,
    };
  }

  function handleSubmitClick() {
    const payload = buildPayloadOrToast();
    if (!payload) return;
    payloadRef.current = payload;
    setAgreeOpen(true); // open agreement (NO POST YET)
  }

  async function doSubmit(payload: Record<string, any>) {
    try {
      setLoading(true);
      const res = await fetch(`/api/public/employees/${employeeId}/timeline/request-create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Submitted for HRMO approval");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to submit");
    } finally {
      setLoading(false);
      payloadRef.current = null;
    }
  }

  const TITLE_PLACEHOLDERS: Record<UiType, string> = {
    HIRED: "e.g., Initial appointment — Administrative Aide I",
    AWARD: "e.g., Certificate of Commendation for Outstanding Service",
    PROMOTION: "e.g., Promoted to Administrative Aide II (SG 3, Step 1)",
    TRANSFER: "e.g., Transferred to MSWDO — Case Management Unit",
    TRAINING: "e.g., Disaster Preparedness Seminar",
    SEPARATION: "e.g., Retirement effective 2025-06-30",
    OTHER: "e.g., Special assignment: Project Lead",
  };

  const DESC_PLACEHOLDERS: Record<UiType, string> = {
    HIRED: "Optional details: Plantilla no., item no., memo/order ref., etc.",
    AWARD: "Optional details: Awarding body, date, reason for award, etc.",
    PROMOTION: "Optional details: Memo no., effective date, salary grade/step, basis.",
    TRANSFER: "Optional details: From Office → To Office, effective date, order no.",
    TRAINING: "Optional details: Venue, hours, organizer, certificate URL.",
    SEPARATION: "Optional details: Reason (retirement, resignation), last day, docs.",
    OTHER: "Optional details you want HRMO to see.",
  };

  return (
<Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
  <DialogContent
    className="w-[calc(100vw-2rem)] sm:max-w-xl max-h-[90vh] overflow-y-auto p-0 border-none bg-white/80 dark:bg-slate-900/90 backdrop-blur-2xl rounded-[40px] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)]"
    style={{ WebkitOverflowScrolling: "touch" }}
  >
    {/* Header: Temporal Aesthetic */}
    <div className="sticky top-0 z-20 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md p-6 border-b border-white/20">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20">
          <History className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-xl font-black tracking-tight text-slate-800 dark:text-white">Timeline Entry</h3>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">Append Career Milestone</p>
        </div>
      </div>
    </div>

    <div className="p-6 space-y-8">
      {/* Group 1: Timing & Category */}
      <section className="relative pl-6 space-y-4">
        {/* The Vertical Timeline String Decoration */}
        <div className="absolute left-0 top-2 bottom-0 w-0.5 bg-gradient-to-b from-amber-500 via-slate-200 dark:via-slate-700 to-transparent rounded-full" />
        
        <div className="flex items-center gap-2 -ml-6">
          <div className="h-3 w-3 rounded-full bg-amber-500 border-2 border-white dark:border-slate-900 z-10" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Event Classification</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="ml-1 text-[11px] font-black uppercase tracking-wider text-slate-500">Entry Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as UiType)}>
              <SelectTrigger className="rounded-2xl border-white/40 dark:border-white/10 bg-white/50 dark:bg-black/20 backdrop-blur-sm h-11">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-white/20 backdrop-blur-xl">
                {TYPE_OPTIONS.map(t => <SelectItem key={t} value={t} className="rounded-lg m-1">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="ml-1 text-[11px] font-black uppercase tracking-wider text-slate-500">Event Date</Label>
            <Input 
              type="date" 
              max={todayYMD} 
              value={date} 
              onChange={e => setDate(e.target.value)} 
              className="rounded-2xl border-white/40 dark:border-white/10 bg-white/50 dark:bg-black/20 h-11"
            />
          </div>
        </div>
      </section>

      {/* Group 2: Narrative Details */}
      <section className="space-y-4 p-6 rounded-[32px] bg-slate-100/50 dark:bg-white/5 border border-white/40 dark:border-white/5 shadow-inner">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="ml-1 text-[11px] font-black uppercase tracking-wider text-slate-500">Milestone Title</Label>
            <Input 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              placeholder={TITLE_PLACEHOLDERS[type]} 
              className="rounded-xl border-white dark:border-white/10 bg-white/80 dark:bg-black/40"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="ml-1 text-[11px] font-black uppercase tracking-wider text-slate-500">Detailed Description</Label>
            <Textarea 
              rows={3} 
              value={desc} 
              onChange={(e) => setDesc(e.target.value)} 
              placeholder={DESC_PLACEHOLDERS[type]} 
              className="rounded-2xl border-white dark:border-white/10 bg-white/80 dark:bg-black/40 resize-none"
            />
          </div>
        </div>
      </section>

      {/* Group 3: Evidence & Notes */}
      <section className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-1.5">
            <Label className="ml-1 text-[11px] font-black uppercase tracking-wider text-slate-500">Attachment URL</Label>
            <div className="relative">
              <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                value={attachment} 
                onChange={(e) => setAttachment(e.target.value)} 
                placeholder="https://cloud-storage.com/proof.pdf" 
                className="pl-11 rounded-2xl border-white/40 dark:border-white/10 bg-white/50 dark:bg-black/20"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="ml-1 text-[11px] font-black uppercase tracking-wider text-slate-500">Internal Notes (HRMO Only)</Label>
            <Textarea 
              rows={2} 
              value={note} 
              onChange={(e) => setNote(e.target.value)} 
              className="rounded-2xl border-white/40 dark:border-white/10 bg-white/50 dark:bg-black/20 resize-none"
            />
          </div>
        </div>
      </section>
    </div>

    {/* Footer Actions */}
    <div className="sticky bottom-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md p-6 border-t border-white/20 flex flex-col sm:flex-row gap-3">
      <Button 
        variant="ghost" 
        className="rounded-full font-bold text-slate-400 hover:text-slate-600 order-2 sm:order-1" 
        onClick={() => onOpenChange(false)}
        disabled={loading}
      >
        Discard
      </Button>
      <Button 
        className="flex-1 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 order-1 sm:order-2 h-12"
        onClick={handleSubmitClick} 
        disabled={loading}
      >
        {loading ? "Archiving..." : "Submit for Approval"}
      </Button>
    </div>

    {/* Agreement Sub-Dialog */}
    <PreSubmitAgreement
      actionId="timeline.request-create"
      open={agreeOpen}
      onOpenChange={setAgreeOpen}
      onConfirm={() => {
        if (payloadRef.current) doSubmit(payloadRef.current);
        else {
          const p = buildPayloadOrToast();
          if (p) doSubmit(p);
        }
      }}
      disabled={loading}
      title="Timeline Verification"
      confirmLabel="Certify Milestone"
    >
      <div className="space-y-4 py-2">
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Career timeline entries serve as a permanent record of your professional growth. 
          By submitting, you certify that:
        </p>
        <ul className="space-y-2">
          {["Dates match official personnel orders.", "Attachments are clear and unaltered.", "Descriptions accurately reflect the event."].map((text, i) => (
            <li key={i} className="flex gap-3 text-xs font-medium text-slate-500">
              <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" />
              {text}
            </li>
          ))}
        </ul>
      </div>
    </PreSubmitAgreement>
  </DialogContent>
</Dialog>
  );
}
