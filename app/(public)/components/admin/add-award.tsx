"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export type AwardRecord = {
  id: string;
  title: string;
  issuer?: string | null;
  date: string;          // "yyyy-mm-dd"
  thumbnail?: string | null;
  fileUrl?: string | null;
  tags: string[];
};

type Props = {
  employeeId: string;
  /** If provided => edit mode, else create mode */
  initial?: AwardRecord | null;
  /** Notify parent to refresh/patch local state */
  onSaved?: (saved: AwardRecord) => void;
  onDeleted?: (deletedId: string) => void;
  /** Optional: hide header title if you render your own */
  hideHeader?: boolean;
};

export default function AddAward({
  employeeId,
  initial = null,
  onSaved,
  onDeleted,
  hideHeader,
}: Props) {
  const isEdit = !!initial?.id;
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState(() => ({
    title: initial?.title ?? "",
    issuer: initial?.issuer ?? "Municipality of Lingayen",
    date: (initial?.date ?? new Date().toISOString().slice(0, 10)),
    thumbnail: initial?.thumbnail ?? "",
    fileUrl: initial?.fileUrl ?? "",
    tags: (initial?.tags ?? []).join(", "),
  }));

  const payload = useMemo(() => ({
    title: form.title.trim(),
    issuer: form.issuer?.trim() || null,
    date: form.date, // must be yyyy-mm-dd
    thumbnail: form.thumbnail?.trim() || null,
    fileUrl: form.fileUrl?.trim() || null,
    tags: form.tags
      .split(",")
      .map(t => t.trim())
      .filter(Boolean),
  }), [form]);

  async function handleSubmit() {
    if (!payload.title) {
      toast.error("Title is required.");
      return;
    }
    try {
      setLoading(true);
      const url = isEdit
        ? `/api/admin/employees/${employeeId}/awards/${initial!.id}`
        : `/api/admin/employees/${employeeId}/awards`;

      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());

      // expect the API to return the saved record
      const saved: AwardRecord = await res.json();
      toast.success(isEdit ? "Award updated" : "Award created");

      onSaved?.(saved);
      if (!isEdit) {
        // reset only on create
        setForm(f => ({ ...f, title: "", thumbnail: "", fileUrl: "", tags: "" }));
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to save award");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!isEdit) return;
    if (!confirm("Delete this award?")) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/admin/employees/${employeeId}/awards/${initial!.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Award deleted");
      onDeleted?.(initial!.id);
    } catch (e: any) {
      toast.error(e.message || "Failed to delete award");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      {!hideHeader && (
        <div className="font-medium">{isEdit ? "Edit Award / Recognition" : "Add Award / Recognition"}</div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Title</label>
          <Input value={form.title} onChange={e=>setForm(s=>({ ...s, title: e.target.value }))} placeholder="Commendation for Public Service"/>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Issuer</label>
          <Input value={form.issuer ?? ""} onChange={e=>setForm(s=>({ ...s, issuer: e.target.value }))}/>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Date</label>
          <Input type="date" value={form.date} onChange={e=>setForm(s=>({ ...s, date: e.target.value }))}/>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Tags (comma-sep)</label>
          <Input value={form.tags} onChange={e=>setForm(s=>({ ...s, tags: e.target.value }))} placeholder="Service, Safety"/>
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Thumbnail URL</label>
        <Input value={form.thumbnail ?? ""} onChange={e=>setForm(s=>({ ...s, thumbnail: e.target.value }))} placeholder="https://…/thumb.jpg"/>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Certificate URL (image/pdf)</label>
        <Input value={form.fileUrl ?? ""} onChange={e=>setForm(s=>({ ...s, fileUrl: e.target.value }))} placeholder="https://…/full.jpg"/>
      </div>

      <div className="flex items-center justify-end gap-2">
        {isEdit && (
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={loading}>
            Delete
          </Button>
        )}
        <Button type="button" onClick={handleSubmit} disabled={loading || !payload.title}>
          {isEdit ? "Update" : "Save"}
        </Button>
      </div>
    </div>
  );
}
