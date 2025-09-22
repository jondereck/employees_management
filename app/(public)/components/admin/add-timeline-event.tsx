"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";

export default function AddTimelineEvent({ employeeId }: { employeeId: string }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    type: "TRAINING",
    title: "",
    description: "",
    date: new Date().toISOString().slice(0,10), // yyyy-mm-dd
    attachment: "",
  });

  async function onSubmit() {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/employees/${employeeId}/timeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Timeline event added");
      setForm(f => ({ ...f, title: "", description: "", attachment: "" }));
    } catch (e: any) {
      toast.error(e.message || "Failed to add event");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="font-medium">Add Timeline Event</div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Type</label>
          <Select value={form.type} onValueChange={(v)=>setForm(s=>({ ...s, type: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["HIRED","PROMOTION","TRANSFER","TRAINING","AWARD","RECOGNITION","SEPARATION"].map(t =>
                <SelectItem key={t} value={t}>{t}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Date</label>
          <Input type="date" value={form.date} onChange={e=>setForm(s=>({ ...s, date: e.target.value }))}/>
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Title</label>
        <Input value={form.title} onChange={e=>setForm(s=>({ ...s, title: e.target.value }))} placeholder="e.g., Disaster Preparedness Seminar"/>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Description</label>
        <Textarea rows={3} value={form.description} onChange={e=>setForm(s=>({ ...s, description: e.target.value }))}/>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Attachment URL (image/pdf)</label>
        <Input value={form.attachment} onChange={e=>setForm(s=>({ ...s, attachment: e.target.value }))} placeholder="https://…"/>
      </div>

      <div className="flex justify-end">
        <Button onClick={onSubmit} disabled={loading || !form.title}>Save</Button>
      </div>
    </div>
  );
}
