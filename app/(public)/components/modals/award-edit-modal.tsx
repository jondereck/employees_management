"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useRef } from "react";
import PreSubmitAgreement from "../agreements/pre-submit-agreement";



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
        className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto p-4 sm:p-6"
        // iOS smooth scrolling
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <h3 className="text-base font-semibold">Suggest an edit (Award)</h3>
        <p className="text-xs text-muted-foreground">Your changes will be reviewed by HRMO before publication.</p>
        <div className="space-y-3 mt-3">
          <div>
            <label className="text-xs text-muted-foreground">Title</label>
            <Input value={form.title} onChange={e => setForm(s => ({ ...s, title: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Issuer</label>
            <Input value={form.issuer} onChange={e => setForm(s => ({ ...s, issuer: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Date Given (ISO)</label>
            <Input
              type="date"
              max={todayYMD}               // ⛔ prevent picking future dates
              value={form.givenAt}
              onChange={(e) => setForm((s) => ({ ...s, givenAt: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Certificate URL (image/pdf)</label>
            <Input value={form.fileUrl} onChange={e => setForm(s => ({ ...s, fileUrl: e.target.value }))} placeholder="https://…" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Thumbnail URL</label>
            <Input value={form.thumbnail} onChange={e => setForm(s => ({ ...s, thumbnail: e.target.value }))} placeholder="https://…" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tags (comma-separated)</label>
            <Input value={form.tags} onChange={e => setForm(s => ({ ...s, tags: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Notes to HRMO (optional)</label>
            <Textarea value={form.note} onChange={e => setForm(s => ({ ...s, note: e.target.value }))} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmitClick} disabled={loading}>{loading ? "Submitting…" : "Submit for approval"}</Button>
          <PreSubmitAgreement
            actionId="awards.request-edit"
            open={agreeOpen}
            onOpenChange={setAgreeOpen}
            onConfirm={() => {
              if (payloadRef.current) {
                doSubmit(payloadRef.current);
              } else {
                const p = buildPayloadOrToast();
                if (p) doSubmit(p);
              }
            }}
            disabled={loading}
            title="Before you submit these changes"
            confirmLabel="I understand — submit"
          >
            <p>
              HRMO may request supporting documents (e.g., certificate files, letters) to verify authenticity.
              Ensure your updates match official records.
            </p>
            <ul className="list-disc pl-5">
              <li>Provide a clear certificate image or PDF if requested</li>
              <li>Use correct dates, issuer, and titles</li>
              <li>Misrepresentation may lead to rejection</li>
            </ul>
          </PreSubmitAgreement>

        </div>
      </DialogContent>
    </Dialog>
  );
}