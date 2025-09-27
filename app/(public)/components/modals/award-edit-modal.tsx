"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

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
        givenAt: award.givenAt,
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

  const submit = async () => {
    if (!award) return;
    setLoading(true);
    try {
      const payload: any = {};
      if (form.title !== award.title) payload.title = form.title;
      if ((form.issuer || undefined) !== (award.issuer ?? undefined)) payload.issuer = form.issuer || null;
      if (form.givenAt !== award.givenAt) payload.givenAt = form.givenAt;
      if ((form.description || undefined) !== (award.description ?? undefined)) payload.description = form.description || null;
      if ((form.fileUrl || undefined) !== (award.fileUrl ?? undefined)) payload.fileUrl = form.fileUrl || null;
      if ((form.thumbnail || undefined) !== (award.thumbnail ?? undefined)) payload.thumbnail = form.thumbnail || null;
      const tagsArray = form.tags.trim() ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
      if (JSON.stringify(tagsArray) !== JSON.stringify(award.tags ?? [])) payload.tags = tagsArray;
      if (form.note.trim()) payload.note = form.note.trim();

      if (Object.keys(payload).length === 0) {
        toast.info("No changes to submit");
        return;
      }
      const iso = toISODate(form.givenAt);
      if (!iso || !notFuture(iso)) {
        toast.error("Date given cannot be in the future");
        return;
      }
      payload.givenAt = iso;

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
      toast.error(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

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
          <Button onClick={submit} disabled={loading}>{loading ? "Submitting…" : "Submit for approval"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}