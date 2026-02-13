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
import { Info, Link2, PencilLine } from "lucide-react";

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
    className="w-[calc(100vw-2rem)] sm:max-w-xl max-h-[90vh] overflow-y-auto p-0 border-none bg-white/80 dark:bg-slate-900/90 backdrop-blur-3xl rounded-[40px] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)]"
    style={{ WebkitOverflowScrolling: "touch" }}
  >
    {/* Header: Modification Focus */}
    <div className="sticky top-0 z-20 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md p-6 border-b border-white/20">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-500/20">
          <PencilLine className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-xl font-black tracking-tight text-slate-800 dark:text-white">Suggest Timeline Edit</h3>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Chronological Information</p>
        </div>
      </div>
    </div>

    <div className="p-6 space-y-8">
      {/* Group: Time & Classification */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-1 w-4 bg-indigo-500 rounded-full" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Classification</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="ml-1 text-[11px] font-black uppercase tracking-wider text-slate-500">Milestone Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof TYPE_OPTIONS[number])}>
              <SelectTrigger className="rounded-2xl border-white/40 dark:border-white/10 bg-white/50 dark:bg-black/20 backdrop-blur-sm h-11">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-white/20 backdrop-blur-xl">
                {TYPE_OPTIONS.map(t => <SelectItem key={t} value={t} className="rounded-lg m-1">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="ml-1 text-[11px] font-black uppercase tracking-wider text-slate-500">Date</Label>
            <Input 
              type="date" 
              max={todayYMD} 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              className="rounded-2xl border-white/40 dark:border-white/10 bg-white/50 dark:bg-black/20 h-11"
            />
          </div>
        </div>
      </section>

      {/* Group: Content Refinement */}
      <section className="space-y-4 p-6 rounded-[32px] bg-indigo-500/[0.03] dark:bg-white/[0.02] border border-indigo-500/10 dark:border-white/5 shadow-inner">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="ml-1 text-[11px] font-black uppercase tracking-wider text-slate-500">Updated Title</Label>
            <Input 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              placeholder="e.g., Disaster Preparedness Seminar" 
              className="rounded-xl border-white dark:border-white/10 bg-white/80 dark:bg-black/40"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="ml-1 text-[11px] font-black uppercase tracking-wider text-slate-500">Revised Description</Label>
            <Textarea 
              rows={3} 
              value={desc} 
              onChange={(e) => setDesc(e.target.value)} 
              className="rounded-2xl border-white dark:border-white/10 bg-white/80 dark:bg-black/40 resize-none"
            />
          </div>
        </div>
      </section>

      {/* Group: Verification Data */}
      <section className="space-y-4">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="ml-1 text-[11px] font-black uppercase tracking-wider text-slate-500">Supporting Attachment URL</Label>
            <div className="relative">
              <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                value={attachment} 
                onChange={(e) => setAttachment(e.target.value)} 
                placeholder="https://…" 
                className="pl-11 rounded-2xl border-white/40 dark:border-white/10 bg-white/50 dark:bg-black/20 h-11"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="ml-1 text-[11px] font-black uppercase tracking-wider text-slate-500">Notes to HRMO (Rationale)</Label>
            <Textarea 
              rows={2} 
              value={note} 
              onChange={(e) => setNote(e.target.value)} 
              placeholder="Explain why this adjustment is necessary..."
              className="rounded-2xl border-white/40 dark:border-white/10 bg-white/50 dark:bg-black/20 resize-none"
            />
          </div>
        </div>
      </section>
    </div>

    {/* Actions: Liquid Footer */}
    <div className="sticky bottom-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md p-6 border-t border-white/20 flex flex-col sm:flex-row gap-3">
      <Button 
        variant="ghost" 
        className="rounded-full font-bold text-slate-400 hover:text-slate-600 order-2 sm:order-1" 
        onClick={() => onOpenChange(false)}
        disabled={loading}
      >
        Cancel
      </Button>
      <Button 
        className="flex-1 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 transition-all active:scale-95 order-1 sm:order-2 h-12"
        onClick={handleSubmitClick} 
        disabled={loading}
      >
        {loading ? "Processing..." : "Submit for Review"}
      </Button>
    </div>

    {/* Agreement Drop-in */}
    <PreSubmitAgreement
      actionId="timeline.request-edit"
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
      title="Verify Timeline Adjustment"
      confirmLabel="Apply Edits"
    >
      <div className="space-y-4 py-2">
        <div className="flex gap-4 p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
          <Info className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Changes to existing records require verification. HRMO may cross-reference this with your 201 file.
          </p>
        </div>
        <ul className="space-y-2">
          {["Documents must be legible", "Titles must match official memos", "Intentional errors may result in flags"].map((text, i) => (
            <li key={i} className="flex items-center gap-3 text-xs font-semibold text-slate-500">
              <div className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
              {text}
            </li>
          ))}
        </ul>
      </div>
    </PreSubmitAgreement>
  </DialogContent>
</Dialog>
    </>


  );
}
