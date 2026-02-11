"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AlignLeft, Building2, Calendar, FileCheck, ImageIcon, RefreshCcw, RefreshCw, Save, Tags, Trash2, Trophy } from "lucide-react";

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
  const [resolvingThumbnail, setResolvingThumbnail] = useState(false);
  const [resolvingFile, setResolvingFile] = useState(false);

  const isImageLike = (u?: string | null) => {
    if (!u) return false;
    try {
      const url = new URL(u);
      if (/^lh\d+\.googleusercontent\.com$/i.test(url.hostname)) return true;
      return /\.(png|jpe?g|webp|gif|svg)$/i.test(url.pathname.split("?")[0]);
    } catch { return false; }
  };

  const isGooglePhotosShare = (u?: string) =>
    !!u && /^(https?:\/\/)?(photos\.app\.goo\.gl|photos\.google\.com)\//i.test(u);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [form, setForm] = useState(() => ({
    title: initial?.title ?? "",
    issuer: initial?.issuer ?? "Municipality of Lingayen",
    date: ((initial?.date ?? today)).slice(0, 10),
    description: initial?.description ?? "",
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
    date: form.date.slice(0, 10),
    description: form.description?.trim() || null,
    thumbnail: form.thumbnail?.trim() || null,
    fileUrl: form.fileUrl?.trim() || null,
    tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
  }), [form]);

  async function resolveUrl(field: 'thumbnail' | 'fileUrl') {
    const url = form[field];
    if (!url) return;
    try {
      if (field === 'thumbnail') setResolvingThumbnail(true);
      else setResolvingFile(true);

      const r = await fetch(`/api/tools/resolve-google-photos?url=${encodeURIComponent(url)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to resolve");
      setForm(s => ({ ...s, [field]: j.url }));
      toast.success("URL resolved to direct image");
    } catch (e: any) {
      toast.error(e?.message || "Could not extract image URL");
    } finally {
      setResolvingThumbnail(false);
      setResolvingFile(false);
    }
  }
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
   <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
      {!hideHeader && (
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <div className="p-2 bg-yellow-50 rounded-lg">
            <Trophy className="h-4 w-4 text-yellow-600" />
          </div>
          <h3 className="text-lg font-bold tracking-tight text-slate-800">
            {isEdit ? "Edit Recognition" : "Add Recognition"}
          </h3>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-indigo-500 flex items-center gap-1.5">
            <Trophy className="h-3 w-3" /> Award Title
          </label>
          <Input 
            className="bg-slate-50/50 border-slate-200 rounded-xl focus:ring-indigo-500 font-medium"
            value={form.title} 
            onChange={e => setForm(s => ({ ...s, title: e.target.value }))} 
            placeholder="e.g., Outstanding Service Award" 
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-indigo-500 flex items-center gap-1.5">
            <Building2 className="h-3 w-3" /> Issuer
          </label>
          <Input 
            className="bg-slate-50/50 border-slate-200 rounded-xl focus:ring-indigo-500"
            value={form.issuer ?? ""} 
            onChange={e => setForm(s => ({ ...s, issuer: e.target.value }))} 
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <Calendar className="h-3 w-3" /> Date Received
          </label>
          <Input 
            type="date" 
            className="bg-slate-50/50 border-slate-200 rounded-xl focus:ring-indigo-500"
            value={form.date} 
            onChange={e => setForm(s => ({ ...s, date: e.target.value }))} 
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <Tags className="h-3 w-3" /> Tags
          </label>
          <Input 
            className="bg-slate-50/50 border-slate-200 rounded-xl focus:ring-indigo-500"
            value={form.tags} 
            onChange={e => setForm(s => ({ ...s, tags: e.target.value }))} 
            placeholder="Service, Leadership..." 
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <AlignLeft className="h-3 w-3" /> Description
        </label>
        <Textarea 
          rows={3} 
          className="bg-slate-50/50 border-slate-200 rounded-xl focus:ring-indigo-500 resize-none"
          value={form.description ?? ""} 
          onChange={e => setForm(s => ({ ...s, description: e.target.value }))} 
          placeholder="Describe the achievement..."
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        {/* Thumbnail Section with Preview */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <ImageIcon className="h-3 w-3" /> Thumbnail URL
          </label>
          <div className="flex gap-2">
            <Input
              className="bg-slate-50/50 border-slate-200 rounded-xl text-xs"
              value={form.thumbnail ?? ""}
              onChange={(e) => setForm(s => ({ ...s, thumbnail: e.target.value }))}
              placeholder="Google Photos or Image URL"
            />
            {isGooglePhotosShare(form.thumbnail) && (
              <Button 
                type="button" 
                variant="outline" 
                className="rounded-xl border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                onClick={() => resolveUrl('thumbnail')}
                disabled={resolvingThumbnail}
              >
                {resolvingThumbnail ? <RefreshCcw className="h-3 w-3 animate-spin" /> : "Convert"}
              </Button>
            )}
          </div>
          {isImageLike(form.thumbnail) && (
            <div className="mt-2 relative h-20 w-32 rounded-lg border overflow-hidden bg-slate-50">
               {/* eslint-disable-next-line @next/next/no-img-element */}
               <img src={form.thumbnail!} alt="Preview" className="h-full w-full object-cover" />
            </div>
          )}
        </div>

        {/* Certificate Section */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <FileCheck className="h-3 w-3" /> Certificate / Evidence URL
          </label>
          <div className="flex gap-2">
            <Input
              className="bg-slate-50/50 border-slate-200 rounded-xl text-xs"
              value={form.fileUrl ?? ""}
              onChange={(e) => setForm(s => ({ ...s, fileUrl: e.target.value }))}
              placeholder="Link to PDF or full image"
            />
            {isGooglePhotosShare(form.fileUrl) && (
              <Button 
                type="button" 
                variant="outline" 
                className="rounded-xl border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                onClick={() => resolveUrl('fileUrl')}
                disabled={resolvingFile}
              >
                {resolvingFile ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Convert"}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
        <div>
          {isEdit && (
            <Button 
              type="button" 
              variant="ghost" 
              className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-bold gap-2 rounded-xl"
              onClick={handleDelete} 
              disabled={loading}
            >
              <Trash2 className="h-4 w-4" /> Delete Award
            </Button>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            type="button" 
            onClick={handleSubmit} 
            disabled={loading || !payload.title}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 rounded-xl shadow-lg shadow-indigo-100 gap-2"
          >
            {loading ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEdit ? "Update Recognition" : "Save Recognition"}
          </Button>
        </div>
      </div>
    </div>
  );
}
