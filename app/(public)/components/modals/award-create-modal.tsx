"use client";

import { useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import PreSubmitAgreement from "../agreements/pre-submit-agreement";
import { CheckCircle2, Link2Icon, Trophy } from "lucide-react";

export default function AwardCreateModal({ employeeId, open, onOpenChange }: {
  employeeId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    issuer: "",
    givenAt: "",
    description: "",
    fileUrl: "",
    thumbnail: "",
    tags: "",
    note: "",
  });

  const [agreeOpen, setAgreeOpen] = useState(false);
  const payloadRef = useRef<Record<string, any> | null>(null);

  const isProbablyUrl = (s?: string) =>
    !!s && /^https?:\/\/[^\s]+$/i.test(s.trim());

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
    const d = new Date(iso), t = new Date();
    d.setHours(0, 0, 0, 0); t.setHours(0, 0, 0, 0);
    return d.getTime() <= t.getTime();
  };



  function buildPayloadOrToast() {
    if (!form.title.trim()) { toast.error("Title is required"); return null; }

    const iso = toISODate(form.givenAt);
    if (!iso) { toast.error("Please enter a valid date (YYYY-MM-DD)."); return null; }
    if (!notFuture(iso)) { toast.error("Date given cannot be in the future"); return null; }

    const payload: any = {
      title: form.title.trim(),
      givenAt: iso,
    };

    if (form.issuer.trim()) payload.issuer = form.issuer.trim();
    if (form.description.trim()) payload.description = form.description.trim();

    // Only send real URLs, skip placeholders like "https://..."
    if (isProbablyUrl(form.fileUrl)) payload.fileUrl = form.fileUrl.trim();
    if (isProbablyUrl(form.thumbnail)) payload.thumbnail = form.thumbnail.trim();

    if (form.tags.trim()) {
      payload.tags = form.tags.split(",").map(t => t.trim()).filter(Boolean);
    }

    if (form.note.trim()) payload.note = form.note.trim();
    return payload;
  }

  function handleSubmitClick() {
    const payload = buildPayloadOrToast();
    if (!payload) return;            // invalid, already toasted
    payloadRef.current = payload;    // stash for confirm
    setAgreeOpen(true);              // OPEN AGREEMENT (no POST yet)
  }

  async function doSubmit(payload: Record<string, any>) {
    try {
      setLoading(true);
      const res = await fetch(`/api/public/employees/${employeeId}/awards/request-create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
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
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent
    className="w-[calc(100vw-2rem)] sm:max-w-xl max-h-[90vh] overflow-y-auto p-0 border-none bg-white/80 dark:bg-slate-900/90 backdrop-blur-2xl rounded-[40px] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)]"
    style={{ WebkitOverflowScrolling: "touch" }}
  >
    {/* Header: Visual Branding */}
    <div className="sticky top-0 z-20 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md p-6 border-b border-white/20">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#DA1677] to-[#b0125f] text-white shadow-lg">
          <Trophy className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-black tracking-tight text-slate-800 dark:text-white">Suggest Award</h3>
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Authentication Required</p>
        </div>
      </div>
    </div>

    <div className="p-6 space-y-8">
      {/* Group 1: Core Details */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-1 w-4 bg-[#DA1677] rounded-full" />
          <span className="text-[10px] font-black uppercase tracking-tighter text-slate-400">Primary Information</span>
        </div>
        
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <label className="ml-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Award Title</label>
            <Input 
              className="rounded-2xl border-white/40 dark:border-white/10 bg-white/50 dark:bg-black/20 backdrop-blur-sm focus:ring-[#DA1677] transition-all"
              placeholder="e.g. Employee of the Month"
              value={form.title} 
              onChange={e => setForm(s => ({ ...s, title: e.target.value }))} 
            />
          </div>

          <div className="space-y-1.5">
            <label className="ml-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Issuer</label>
            <Input 
              className="rounded-2xl border-white/40 dark:border-white/10 bg-white/50 dark:bg-black/20 focus:ring-[#DA1677]"
              placeholder="Organization name"
              value={form.issuer} 
              onChange={e => setForm(s => ({ ...s, issuer: e.target.value }))} 
            />
          </div>

          <div className="space-y-1.5">
            <label className="ml-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Date Given</label>
            <Input
              type="date"
              max={todayYMD}
              className="rounded-2xl border-white/40 dark:border-white/10 bg-white/50 dark:bg-black/20 appearance-none"
              value={form.givenAt}
              onChange={(e) => setForm((s) => ({ ...s, givenAt: e.target.value }))}
            />
          </div>
        </div>
      </section>
  <section className="space-y-4 p-5 rounded-[32px] bg-indigo-500/[0.03] dark:bg-white/[0.02] border border-indigo-500/10 dark:border-white/5">
    <div className="flex items-center gap-2">
      <div className="h-1 w-4 bg-emerald-500 rounded-full" />
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        Media & Tags
      </span>
    </div>

    <div className="space-y-4">

      {/* Certificate URL */}
      <div className="space-y-1.5">
        <label className="ml-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Certificate Source URL
        </label>
        <div className="relative">
          <Link2Icon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            className="pl-11 rounded-2xl border-white/40 dark:border-white/10 bg-white dark:bg-black/40"
            value={form.fileUrl}
            onChange={(e) =>
              setForm((s) => ({ ...s, fileUrl: e.target.value }))
            }
          />
        </div>
      </div>

      {/* Thumbnail + Tags */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="ml-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Thumbnail Preview
          </label>
          <Input
            className="rounded-2xl border-white/40 dark:border-white/10 bg-white dark:bg-black/40"
            value={form.thumbnail}
            onChange={(e) =>
              setForm((s) => ({ ...s, thumbnail: e.target.value }))
            }
            placeholder="https://image-url.com/thumb.jpg"
          />
        </div>

        <div className="space-y-1.5">
          <label className="ml-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Category Tags
          </label>
          <Input
            className="rounded-2xl border-white/40 dark:border-white/10 bg-white dark:bg-black/40"
            value={form.tags}
            onChange={(e) =>
              setForm((s) => ({ ...s, tags: e.target.value }))
            }
            placeholder="Excellence, 2026, Leadership"
          />
        </div>
      </div>
    </div>
  </section>
      {/* Group 2: Evidence / Files */}
     

      {/* Group 3: Narration */}
      <section className="space-y-4">
        <div className="space-y-1.5">
          <label className="ml-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Description & Notes</label>
          <Textarea 
            placeholder="Describe the significance of this award..."
            className="rounded-[24px] border-white/40 dark:border-white/10 bg-white/50 dark:bg-black/20 min-h-[100px]"
            value={form.description} 
            onChange={e => setForm(s => ({ ...s, description: e.target.value }))} 
          />
        </div>
      </section>

      <div className="rounded-2xl bg-amber-500/5 border border-amber-500/10 p-4">
        <p className="text-[11px] text-amber-700 dark:text-amber-400 italic">
          <strong>Note:</strong> Changes will only appear on your public profile after the HRMO team verifies the certificate authenticity.
        </p>
      </div>
    </div>

    {/* Sticky Footer Actions */}
    <div className="sticky bottom-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md p-6 border-t border-white/20 flex flex-col sm:flex-row gap-3">
      <Button 
        variant="ghost" 
        className="rounded-full font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 order-2 sm:order-1" 
        onClick={() => onOpenChange(false)}
      >
        Discard
      </Button>
      <Button 
        className="flex-1 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all order-1 sm:order-2"
        onClick={handleSubmitClick} 
        disabled={loading}
      >
        {loading ? (
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Processing...
          </div>
        ) : "Submit for Approval"}
      </Button>
    </div>

    <PreSubmitAgreement
      actionId="awards.request-create"
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
      title="Authenticity Declaration"
      confirmLabel="I Certify & Submit"
    >
      <div className="space-y-4 text-sm leading-relaxed">
        <p className="font-medium">By submitting this award, you agree that:</p>
        <ul className="space-y-2">
          <li className="flex gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            The information matches your official government-issued certificates.
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            You will present the physical copy to HRMO if requested for manual audit.
          </li>
        </ul>
      </div>
    </PreSubmitAgreement>
  </DialogContent>
</Dialog>
  );
}