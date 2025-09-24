"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function AwardCreateModal({ employeeId, open, onOpenChange }:{
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

  const isProbablyUrl = (s?: string) =>
  !!s && /^https?:\/\/[^\s]+$/i.test(s.trim());

const toISODate = (raw: string) => {
  const s = raw.trim();
  if (!s) return null;
  // YYYY-MM-DD -> ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(s + "T00:00:00.000Z").toISOString();
  }
  // MM-DD-YYYY or MM/DD/YYYY -> ISO
  const mmddyyyy = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (mmddyyyy) {
    const [, mm, dd, yyyy] = mmddyyyy;
    return new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`).toISOString();
  }
  // Fallback: try Date()
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return null;
};

const submit = async () => {
  if (!form.title.trim()) {
    toast.error("Title is required");
    return;
  }
  const iso = toISODate(form.givenAt);
  if (!iso) {
    toast.error("Please enter a valid date");
    return;
  }

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

  setLoading(true);
  try {
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
    toast.error(e.message || "Something went wrong");
  } finally {
    setLoading(false);
  }
};
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <h3 className="text-base font-semibold">Suggest a new Award</h3>
        <p className="text-xs text-muted-foreground">Changes require HRMO approval. Visit HRMO to validate if needed.</p>
        <div className="space-y-3 mt-3">
          <div>
            <label className="text-xs text-muted-foreground">Title</label>
            <Input value={form.title} onChange={e=>setForm(s=>({...s, title: e.target.value}))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Issuer</label>
            <Input value={form.issuer} onChange={e=>setForm(s=>({...s, issuer: e.target.value}))} />
          </div>
          <div>
           <label className="text-xs text-muted-foreground">Date Given</label>
<Input
  type="date"
  value={form.givenAt}
  onChange={(e) => setForm((s) => ({ ...s, givenAt: e.target.value }))}
  placeholder="YYYY-MM-DD"
/>
<p className="text-[11px] text-muted-foreground">Use the picker. If you paste, formats like 2000-03-28 or 03/28/2000 both work.</p>

          </div>
          <div>
            <label className="text-xs text-muted-foreground">Certificate URL (image/pdf)</label>
            <Input value={form.fileUrl} onChange={e=>setForm(s=>({...s, fileUrl: e.target.value}))} placeholder="https://…" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Thumbnail URL (optional)</label>
            <Input value={form.thumbnail} onChange={e=>setForm(s=>({...s, thumbnail: e.target.value}))} placeholder="https://…" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tags (comma-separated)</label>
            <Input value={form.tags} onChange={e=>setForm(s=>({...s, tags: e.target.value}))} placeholder="excellence, 2025" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Description (optional)</label>
            <Textarea value={form.description} onChange={e=>setForm(s=>({...s, description: e.target.value}))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Notes to HRMO (optional)</label>
            <Textarea value={form.note} onChange={e=>setForm(s=>({...s, note: e.target.value}))} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={()=>onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading ? "Submitting…" : "Submit for approval"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}