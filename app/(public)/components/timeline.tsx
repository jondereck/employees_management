// Timeline.tsx
"use client";
import { useEffect, useState } from "react";
import { CalendarIcon, Award as AwardIcon, ArrowUpRight, Landmark, GraduationCap, UserCheck, Pencil, Trash } from "lucide-react";
import { cn } from "@/lib/utils";
import AddTimelineEvent, { TimelineRecord } from "@/app/(public)/components/admin/add-timeline-event";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AlertModal } from "@/components/modals/alert-modal"; // ✅ your reusable modal
import { TimelineSkeleton } from "./timeline-skeleton";

type Event = {
  id: string;
  type: "HIRED"|"PROMOTION"|"TRANSFER"|"TRAINING"|"AWARD"|"RECOGNITION"|"SEPARATION";
  title: string;
  description?: string | null;
  date: string;               // "YYYY-MM-DD"
  attachment?: string | null;
};

const iconMap: Record<Event["type"], JSX.Element> = {
  HIRED: <UserCheck className="h-4 w-4" />,
  PROMOTION: <ArrowUpRight className="h-4 w-4" />,
  TRANSFER: <Landmark className="h-4 w-4" />,
  TRAINING: <GraduationCap className="h-4 w-4" />,
  AWARD: <AwardIcon className="h-4 w-4" />,
  RECOGNITION: <AwardIcon className="h-4 w-4" />,
  SEPARATION: <CalendarIcon className="h-4 w-4" />,
};

export default function Timeline({
  employeeId,
  editable = true,
  version = 0,
}: { employeeId: string; editable?: boolean; version?: number }) {

  const [items, setItems] = useState<Event[] | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);

  // -- Confirm delete modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/public/employees/${employeeId}/timeline`)
      .then(r => r.json())
      .then(data => { if (alive) setItems(Array.isArray(data) ? data : []); })
      .catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [employeeId, version]);

  function upsertLocal(saved: TimelineRecord) {
    setItems(curr => {
      const list = curr ?? [];
      const idx = list.findIndex(e => e.id === saved.id);
      if (idx >= 0) {
        const next = list.slice();
        next[idx] = { ...next[idx], ...saved };
        return next.sort((a,b)=> a.date.localeCompare(b.date));
      }
      return [saved, ...list].sort((a,b)=> a.date.localeCompare(b.date));
    });
  }
  function removeLocal(id: string) {
    setItems(curr => (curr ?? []).filter(e => e.id !== id));
  }

  async function confirmDelete() {
    if (!deletingId) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/admin/employees/${employeeId}/timeline/${deletingId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      removeLocal(deletingId);
      toast.success("Event deleted");
      setConfirmOpen(false);
      setDeletingId(null);
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

 if (!items) return <TimelineSkeleton/>;    // ✅ show skeleton
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No timeline data yet.</p>;

  return (
    <>
      <ol className="relative ml-3 border-l pl-5">
        {items.map((e, idx) => (
          <li key={e.id} className={cn("mb-6", idx === items.length - 1 && "mb-0")}>
            <span className="absolute -left-3 mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
              {iconMap[e.type]}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-medium">{e.title}</h4>
              <time className="text-xs text-muted-foreground">
                {new Date(e.date).toLocaleDateString()}
              </time>

              {editable && (
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => { setEditing(e); setEditOpen(true); }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    type="button"
                    onClick={() => { setDeletingId(e.id); setConfirmOpen(true); }} // ✅ open confirm
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>

            {e.description && <p className="mt-1 text-sm text-muted-foreground">{e.description}</p>}
            {e.attachment && (
              <a href={e.attachment} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs underline hover:opacity-80">
                View attachment
              </a>
            )}
          </li>
        ))}
      </ol>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          {editing && (
            <AddTimelineEvent
              employeeId={employeeId}
              initial={editing}
              onSaved={(saved) => { upsertLocal(saved); setEditOpen(false); }}
              onDeleted={(deletedId) => { removeLocal(deletedId); setEditOpen(false); }}
              hideHeader
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Reusable confirm modal for delete */}
      <AlertModal
        isOpen={confirmOpen}
        onClose={() => { if (!deleting) setConfirmOpen(false); }}
        onConfirm={confirmDelete}
        loading={deleting}
      />
    </>
  );
}
