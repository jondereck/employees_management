"use client";

import { useEffect, useMemo, useState } from "react";
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
   description?: string | null; 
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
  

  const isImageLike = (u?: string | null) => {
  if (!u) return false;
  try {
    const url = new URL(u);
    if (/^lh\d+\.googleusercontent\.com$/i.test(url.hostname)) return true;
    return /\.(png|jpe?g|webp|gif|svg)$/i.test(url.pathname.split("?")[0]);
  } catch {
    return false;
  }
};

const isGooglePhotosShare = (u?: string) =>
  !!u && /^(https?:\/\/)?(photos\.app\.goo\.gl|photos\.google\.com)\//i.test(u);

  const today = useMemo(() => new Date().toISOString().slice(0,10), []);

const [form, setForm] = useState(() => ({
  title: initial?.title ?? "",
  issuer: initial?.issuer ?? "Municipality of Lingayen",
     date: ((initial?.date ?? today)).slice(0, 10),
  description: initial?.description ?? "",        // 🔥 add
  thumbnail: initial?.thumbnail ?? "",
  fileUrl: initial?.fileUrl ?? "",
  tags: (initial?.tags ?? []).join(", "),
}));


  useEffect(() => {
    setForm({
      title: initial?.title ?? "",
      issuer: initial?.issuer ?? "Municipality of Lingayen",
      date: ((initial?.date ?? today)).slice(0, 10),
      description: initial?.description ?? "",
      thumbnail: initial?.thumbnail ?? "",
      fileUrl: initial?.fileUrl ?? "",
      tags: (initial?.tags ?? []).join(", "),
    });
  }, [initial?.id, today]);


const payload = useMemo(() => ({
  title: form.title.trim(),
  issuer: form.issuer?.trim() || null,
    date: form.date.slice(0,10),   // yyyy-mm-dd
  description: form.description?.trim() || null,  // 🔥 add
  thumbnail: form.thumbnail?.trim() || null,
  fileUrl: form.fileUrl?.trim() || null,
  tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
}), [form]);


  async function handleSubmit() {
    if (!payload.title) {
      toast.error("Title is required.");
      return;
    }

        if (payload.date > today) {
      return toast.error("Date cannot be in the future.");
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

     onSaved?.({ ...saved, date: (saved.date ?? form.date).slice(0, 10) });
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
        <div className="sm:col-span-2">
  <label className="text-xs text-muted-foreground">Description</label>
  <Textarea
    rows={3}
    value={form.description ?? ""}
    onChange={(e)=>setForm(s=>({ ...s, description: e.target.value }))}
    placeholder="e.g., For exemplary service during…"
  />
</div>

      </div>

    <div>
  <label className="text-xs text-muted-foreground">Thumbnail URL</label>
  <div className="flex gap-2">
    <Input
      value={form.thumbnail ?? ""}
      onChange={(e)=>setForm(s=>({ ...s, thumbnail: e.target.value }))}
      placeholder="https://… (image url or Google Photos share link)"
    />
    {isGooglePhotosShare(form.thumbnail ?? "") && (
      <Button
        type="button"
        variant="outline"
        onClick={async () => {
          try {
            const r = await fetch(
              `/api/tools/resolve-google-photos?url=${encodeURIComponent(form.thumbnail!)}`
            );
            const j = await r.json();
            if (!r.ok) throw new Error(j?.error || "Failed to resolve");
            setForm(s => ({ ...s, thumbnail: j.url }));
          } catch (e: any) {
            toast.error(e?.message || "Could not extract image URL");
          }
        }}
      >
        Convert
      </Button>
    )}
  </div>
  {/* optional inline hint */}
  {!isImageLike(form.thumbnail) && form.thumbnail && (
    <p className="mt-1 text-xs text-muted-foreground">
      This doesn&apos;t look like a direct image. If it&apos;s a Google Photos link,
      click <span className="font-medium">Convert</span>.
    </p>
  )}
</div>

 <div>
  <label className="text-xs text-muted-foreground">Certificate URL (image/pdf)</label>
  <div className="flex gap-2">
    <Input
      value={form.fileUrl ?? ""}
      onChange={(e)=>setForm(s=>({ ...s, fileUrl: e.target.value }))}
      placeholder="https://… (image or PDF, or Google Photos share link)"
    />
    {isGooglePhotosShare(form.fileUrl ?? "") && (
      <Button
        type="button"
        variant="outline"
        onClick={async () => {
          try {
            const r = await fetch(
              `/api/tools/resolve-google-photos?url=${encodeURIComponent(form.fileUrl!)}`
            );
            if (!r.ok) throw new Error(await r.text());
            const j = await r.json();
            setForm(s => ({ ...s, fileUrl: j.url }));
          } catch (e: any) {
            toast.error(e?.message || "Could not extract image URL");
          }
        }}
      >
        Convert
      </Button>
    )}
  </div>

  {/* gentle hint */}
  {!isImageLike(form.fileUrl) && form.fileUrl && (
    <p className="mt-1 text-xs text-muted-foreground">
      If this is a Google Photos link, click <span className="font-medium">Convert</span>. 
      PDFs and non-image links will open in a new tab.
    </p>
  )}
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
