"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useRef } from "react";
import PreSubmitAgreement from "../agreements/pre-submit-agreement";
import { Link2, PencilLine, ShieldCheck } from "lucide-react";



type Award = {
  id: string;
  title: string;
  issuer?: string | null;
  givenAt: string; // ISO
  thumbnail?: string | null;
  fileUrl?: string | null;
  tags: string[];
  description?: string | null;
};

export default function AwardEditModal({ employeeId, award, open, onOpenChange }: {
  employeeId: string;
  award: Award | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [agreeOpen, setAgreeOpen] = useState(false);
  const payloadRef = useRef<Record<string, any> | null>(null);

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

useEffect(() => {
  if (award) {
    setForm({
      title: award.title,
      issuer: award.issuer ?? "",
      givenAt: (award.givenAt || "").slice(0,10), // <-- normalize to YYYY-MM-DD
      description: award.description ?? "",
      fileUrl: award.fileUrl ?? "",
      thumbnail: award.thumbnail ?? "",
      tags: (award.tags ?? []).join(", "),
      note: "",
    });
  }
}, [award]);


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
  function normalizeISO(isoLike: string | null | undefined) {
    if (!isoLike) return null;
    try {
      const d = new Date(isoLike);
      if (Number.isNaN(d.getTime())) return null;
      // normalize to YYYY-MM-DD for equality checks
      return d.toISOString().slice(0, 10);
    } catch {
      return null;
    }
  }

  function buildPayloadOrToast() {
    if (!award) return null;

    // Validate date first
    const isoFull = toISODate(form.givenAt);
    if (!isoFull) { toast.error("Please enter a valid date (YYYY-MM-DD)."); return null; }
    if (!notFuture(isoFull)) { toast.error("Date given cannot be in the future"); return null; }

    const payload: any = {};
    if (form.title !== award.title) payload.title = form.title;
    if ((form.issuer || undefined) !== (award.issuer ?? undefined)) payload.issuer = form.issuer || null;
    if ((form.description || undefined) !== (award.description ?? undefined)) payload.description = form.description || null;
    if ((form.fileUrl || undefined) !== (award.fileUrl ?? undefined)) payload.fileUrl = form.fileUrl || null;
    if ((form.thumbnail || undefined) !== (award.thumbnail ?? undefined)) payload.thumbnail = form.thumbnail || null;

    // tags diff
    const tagsArray = form.tags.trim() ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
    if (JSON.stringify(tagsArray) !== JSON.stringify(award.tags ?? [])) payload.tags = tagsArray;

    // givenAt diff — compare normalized YYYY-MM-DD so we don’t send when unchanged
    const newYMD = isoFull.slice(0, 10);
    const oldYMD = normalizeISO(award.givenAt);
    if (newYMD !== oldYMD) payload.givenAt = isoFull;

    if (form.note.trim()) payload.note = form.note.trim();

    if (Object.keys(payload).length === 0) {
      toast.info("No changes to submit");
      return null;
    }
    return payload;
  }

  function handleSubmitClick() {
    const payload = buildPayloadOrToast();
    if (!payload) return;             // invalid or no changes
    payloadRef.current = payload;
    setAgreeOpen(true);               // open agreement (no POST yet)
  }

  async function doSubmit(payload: Record<string, any>) {
    if (!award) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/public/employees/${employeeId}/awards/${award.id}/request-edit`, {
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
    {/* Header: Refinement Aesthetic */}
    <div className="sticky top-0 z-20 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md p-6 border-b border-white/20">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20">
          <PencilLine className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-xl font-black tracking-tight text-slate-800 dark:text-white">Update Award</h3>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Modification Request</p>
        </div>
      </div>
    </div>

    <div className="p-6 space-y-8">
      {/* Group: Identity */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-1 w-4 bg-indigo-500 rounded-full" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Identity & Origin</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <label className="ml-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Official Title</label>
            <Input 
              className="rounded-2xl border-white/40 dark:border-white/10 bg-white/50 dark:bg-black/20 focus:ring-indigo-500"
              value={form.title} 
              onChange={e => setForm(s => ({ ...s, title: e.target.value }))} 
            />
          </div>

          <div className="space-y-1.5">
            <label className="ml-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Issuing Body</label>
            <Input 
              className="rounded-2xl border-white/40 dark:border-white/10 bg-white/50 dark:bg-black/20 focus:ring-indigo-500"
              value={form.issuer} 
              onChange={e => setForm(s => ({ ...s, issuer: e.target.value }))} 
            />
          </div>

          <div className="space-y-1.5">
            <label className="ml-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Date Given</label>
            <Input
              type="date"
              max={todayYMD}
              className="rounded-2xl border-white/40 dark:border-white/10 bg-white/50 dark:bg-black/20"
              value={form.givenAt}
              onChange={(e) => setForm((s) => ({ ...s, givenAt: e.target.value }))}
            />
          </div>
        </div>
      </section>

      {/* Group: Media & Discovery */}
      <section className="space-y-4 p-5 rounded-[32px] bg-indigo-500/[0.03] dark:bg-white/[0.02] border border-indigo-500/10 dark:border-white/5">
        <div className="flex items-center gap-2">
          <div className="h-1 w-4 bg-emerald-500 rounded-full" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Media & Tags</span>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="ml-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Certificate Source URL</label>
            <div className="relative">
              <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                className="pl-11 rounded-2xl border-white/40 dark:border-white/10 bg-white dark:bg-black/40" 
                value={form.fileUrl} 
                onChange={e => setForm(s => ({ ...s, fileUrl: e.target.value }))} 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="ml-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Thumbnail Preview</label>
              <Input 
                className="rounded-2xl border-white/40 dark:border-white/10 bg-white dark:bg-black/40" 
                value={form.thumbnail} 
                onChange={e => setForm(s => ({ ...s, thumbnail: e.target.value }))} 
              />
            </div>
            <div className="space-y-1.5">
              <label className="ml-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Category Tags</label>
              <Input 
                className="rounded-2xl border-white/40 dark:border-white/10 bg-white dark:bg-black/40" 
                value={form.tags} 
                onChange={e => setForm(s => ({ ...s, tags: e.target.value }))} 
              />
            </div>
          </div>
        </div>
      </section>

      {/* Group: HRMO Dialogue */}
      <section className="space-y-4">
        <div className="space-y-1.5">
          <label className="ml-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Notes for HRMO Review</label>
          <Textarea 
            placeholder="Explain why these changes are being made..."
            className="rounded-[24px] border-white/40 dark:border-white/10 bg-white/50 dark:bg-black/20 min-h-[100px] resize-none"
            value={form.note} 
            onChange={e => setForm(s => ({ ...s, note: e.target.value }))} 
          />
        </div>
      </section>
    </div>

    {/* Footer Actions */}
    <div className="sticky bottom-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md p-6 border-t border-white/20 flex flex-col sm:flex-row gap-3">
      <Button 
        variant="ghost" 
        className="rounded-full font-bold text-slate-400 hover:text-slate-600 dark:hover:bg-white/5 order-2 sm:order-1" 
        onClick={() => onOpenChange(false)}
      >
        Cancel
      </Button>
      <Button 
        className="flex-1 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 transition-all active:scale-95 order-1 sm:order-2"
        onClick={handleSubmitClick} 
        disabled={loading}
      >
        {loading ? "Processing..." : "Update Record"}
      </Button>
    </div>

    {/* Agreement Sub-Dialog */}
    <PreSubmitAgreement
      actionId="awards.request-edit"
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
      title="Verify Modifications"
      confirmLabel="Apply Changes"
    >
      <div className="space-y-4 py-2">
        <div className="flex gap-4 p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
          <ShieldCheck className="h-6 w-6 text-indigo-500 shrink-0" />
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Updating an existing record requires a higher level of scrutiny. Ensure your links and dates exactly match your physical certificate.
          </p>
        </div>
      </div>
    </PreSubmitAgreement>
  </DialogContent>
</Dialog>
  );
}