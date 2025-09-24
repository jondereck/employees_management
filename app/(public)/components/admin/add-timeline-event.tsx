"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";

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

  const [form, setForm] = useState(() => ({
    type: initial?.type ?? "TRAINING",
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    date: (initial?.date ?? new Date().toISOString().slice(0, 10)).slice(0, 10),
    attachment: initial?.attachment ?? "",
  }));

  useEffect(() => {
    setForm({
      type: initial?.type ?? "TRAINING",
      title: initial?.title ?? "",
      description: initial?.description ?? "",
      date: (initial?.date ?? new Date().toISOString().slice(0, 10)).slice(0, 10),
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
    <div className="rounded-lg border p-4 space-y-3">
      {!hideHeader && (
        <div className="font-medium">{isEdit ? "Edit Timeline Event" : "Add Timeline Event"}</div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Type</label>
          <Select value={form.type} onValueChange={(v) => setForm(s => ({ ...s, type: v as TimelineRecord["type"] }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Date</label>
          <Input type="date" value={form.date} onChange={e => setForm(s => ({ ...s, date: e.target.value }))} />
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Title</label>
        <Input value={form.title} onChange={e => setForm(s => ({ ...s, title: e.target.value }))} placeholder="e.g., Disaster Preparedness Seminar" />
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Description</label>
        <Textarea rows={3} value={form.description ?? ""} onChange={e => setForm(s => ({ ...s, description: e.target.value }))} />
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Attachment URL (image/pdf)</label>
        <Input value={form.attachment ?? ""} onChange={e => setForm(s => ({ ...s, attachment: e.target.value }))} placeholder="https://…" />
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
