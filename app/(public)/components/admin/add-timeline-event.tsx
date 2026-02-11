"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { AlignLeft, Calendar, History, LinkIcon, RefreshCcw, Save, Tag, Trash2, Type } from "lucide-react";

export type TimelineRecord = {
  id: string;
  type: "HIRED" | "PROMOTION" | "TRANSFER" | "TRAINING" | "AWARD" | "RECOGNITION" | "SEPARATION";
  title: string;
  description?: string | null;
  date: string;          // "yyyy-mm-dd"
  attachment?: string | null;
};

type Props = {
  employeeId: string;
  initial?: TimelineRecord | null;
  onSaved?: (saved: TimelineRecord) => void;
  onDeleted?: (deletedId: string) => void;
  hideHeader?: boolean;
};

const TYPES: TimelineRecord["type"][] = 
  ["HIRED", "PROMOTION", "TRANSFER", "TRAINING", "AWARD", "RECOGNITION", "SEPARATION"];

export default function AddTimelineEvent({
  employeeId,
  initial = null,
  onSaved,
  onDeleted,
  hideHeader,

}: Props) {
  const isEdit = !!initial?.id;
  const [loading, setLoading] = useState(false);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [form, setForm] = useState(() => ({
    type: initial?.type ?? "TRAINING",
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    date: ((initial?.date ?? today)).slice(0, 10),
    attachment: initial?.attachment ?? "",
  }));

  useEffect(() => {
    setForm({
      type: initial?.type ?? "TRAINING",
      title: initial?.title ?? "",
      description: initial?.description ?? "",
      date: ((initial?.date ?? today)).slice(0, 10),
      attachment: initial?.attachment ?? "",
    });
  }, [initial?.id])

  const payload = useMemo(() => ({
    type: form.type as TimelineRecord["type"],
    title: form.title.trim(),
    description: form.description?.trim() || null,
    date: form.date.slice(0, 10), // 🔒 YYYY-MM-DD
    attachment: form.attachment?.trim() || null,
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
        ? `/api/admin/employees/${employeeId}/timeline/${initial!.id}`
        : `/api/admin/employees/${employeeId}/timeline`;

      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });


      if (!res.ok) throw new Error(await res.text());

      const saved: TimelineRecord = await res.json();
      onSaved?.({ ...saved, date: (saved.date ?? form.date).slice(0, 10) });
      toast.success(isEdit ? "Event updated" : "Event added");


      if (!isEdit) {
        setForm(f => ({ ...f, title: "", description: "", attachment: "" }));
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to save event");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!isEdit) return;
    if (!confirm("Delete this event?")) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/admin/employees/${employeeId}/timeline/${initial!.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Event deleted");
      onDeleted?.(initial!.id);
    } catch (e: any) {
      toast.error(e.message || "Failed to delete event");
    } finally {
      setLoading(false);
    }
  }

  return (
<div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
      {!hideHeader && (
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <History className="h-4 w-4 text-indigo-600" />
          </div>
          <h3 className="text-lg font-bold tracking-tight text-slate-800">
            {isEdit ? "Edit Timeline Event" : "Add Timeline Event"}
          </h3>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-indigo-500 flex items-center gap-1.5">
            <Tag className="h-3 w-3" /> Event Type
          </label>
          <Select value={form.type} onValueChange={(v) => setForm(s => ({ ...s, type: v as TimelineRecord["type"] }))}>
            <SelectTrigger className="bg-slate-50/50 border-slate-200 rounded-xl focus:ring-indigo-500">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-indigo-500 flex items-center gap-1.5">
            <Calendar className="h-3 w-3" /> Event Date
          </label>
          <Input 
            type="date" 
            className="bg-slate-50/50 border-slate-200 rounded-xl focus:ring-indigo-500"
            value={form.date} 
            onChange={e => setForm(s => ({ ...s, date: e.target.value }))} 
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <Type className="h-3 w-3" /> Event Title
        </label>
        <Input 
          className="bg-slate-50/50 border-slate-200 rounded-xl focus:ring-indigo-500 font-medium"
          value={form.title} 
          onChange={e => setForm(s => ({ ...s, title: e.target.value }))} 
          placeholder="e.g., Promotion to Senior Developer" 
        />
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
        />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <LinkIcon className="h-3 w-3" /> Evidence / Attachment URL
        </label>
        <Input 
          className="bg-slate-50/50 border-slate-200 rounded-xl focus:ring-indigo-500 text-xs"
          value={form.attachment ?? ""} 
          onChange={e => setForm(s => ({ ...s, attachment: e.target.value }))} 
          placeholder="https://storage.cloud.com/certificate.pdf" 
        />
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
              <Trash2 className="h-4 w-4" /> Delete Event
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
  {loading 
    ? <RefreshCcw className="h-4 w-4 animate-spin" /> 
    : <Save className="h-4 w-4" />
  }
  {isEdit ? "Update Event" : "Save Event"}
</Button>

        </div>
      </div>
    </div>
  );
}
