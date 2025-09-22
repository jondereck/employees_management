"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function AddAward({ employeeId }: { employeeId: string }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    issuer: "Municipality of Lingayen",
    date: new Date().toISOString().slice(0,10),
    thumbnail: "",
    fileUrl: "",
    tags: "",
  });

  async function onSubmit() {
    try {
      setLoading(true);
      const body = {
        ...form,
        tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      };
      const res = await fetch(`/api/admin/employees/${employeeId}/awards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Award added");
      setForm(f => ({ ...f, title: "", thumbnail: "", fileUrl: "", tags: "" }));
    } catch (e: any) {
      toast.error(e.message || "Failed to add award");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="font-medium">Add Award / Recognition</div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Title</label>
          <Input value={form.title} onChange={e=>setForm(s=>({ ...s, title: e.target.value }))} placeholder="Commendation for Public Service"/>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Issuer</label>
          <Input value={form.issuer} onChange={e=>setForm(s=>({ ...s, issuer: e.target.value }))}/>
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
        <Input value={form.thumbnail} onChange={e=>setForm(s=>({ ...s, thumbnail: e.target.value }))} placeholder="https://…/thumb.jpg"/>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Certificate URL (image/pdf)</label>
        <Input value={form.fileUrl} onChange={e=>setForm(s=>({ ...s, fileUrl: e.target.value }))} placeholder="https://…/full.jpg"/>
      </div>

      <div className="flex justify-end">
        <Button onClick={onSubmit} disabled={loading || !form.title}>Save</Button>
      </div>
    </div>
  );
}
