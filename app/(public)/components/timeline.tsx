// Timeline.tsx
"use client";
import { useEffect, useState } from "react";
import { CalendarIcon, Award as AwardIcon, ArrowUpRight, Landmark, GraduationCap, UserCheck, Pencil, Trash, Badge, FileText } from "lucide-react";
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



const iconConfig: Record<Event["type"], { icon: JSX.Element; color: string; bgColor: string }> = {
  HIRED: { icon: <UserCheck className="h-3.5 w-3.5" />, color: "text-emerald-600", bgColor: "bg-emerald-100" },
  PROMOTION: { icon: <ArrowUpRight className="h-3.5 w-3.5" />, color: "text-blue-600", bgColor: "bg-blue-100" },
  TRANSFER: { icon: <Landmark className="h-3.5 w-3.5" />, color: "text-purple-600", bgColor: "bg-purple-100" },
  TRAINING: { icon: <GraduationCap className="h-3.5 w-3.5" />, color: "text-amber-600", bgColor: "bg-amber-100" },
  AWARD: { icon: <AwardIcon className="h-3.5 w-3.5" />, color: "text-yellow-600", bgColor: "bg-yellow-100" },
  RECOGNITION: { icon: <AwardIcon className="h-3.5 w-3.5" />, color: "text-pink-600", bgColor: "bg-pink-100" },
  SEPARATION: { icon: <CalendarIcon className="h-3.5 w-3.5" />, color: "text-rose-600", bgColor: "bg-rose-100" },
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

  // helpers (top of file)
const byDateDesc = (a: {date: string}, b: {date: string}) =>
  new Date(b.date).getTime() - new Date(a.date).getTime();



useEffect(() => {
  let alive = true;
  fetch(`/api/public/employees/${employeeId}/timeline`)
    .then(r => r.json())
    .then(data => { if (alive) setItems(Array.isArray(data) ? [...data].map(d => ({...d, date: (d.date||"").slice(0,10)})).sort(byDateDesc) : []); })
    .catch(() => { if (alive) setItems([]); });
  return () => { alive = false; };
}, [employeeId, version]);

function upsertLocal(saved: TimelineRecord) {
  const normalized = { ...saved, date: (saved.date||"").slice(0,10) };
  setItems(curr => {
    const list = curr ?? [];
    const idx = list.findIndex(e => e.id === normalized.id);
    if (idx >= 0) {
      const next = list.slice();
      next[idx] = { ...next[idx], ...normalized };
      return next.sort(byDateDesc);    // 🔥 newest-first after edit
    }
    return [normalized, ...list].sort(byDateDesc); // 🔥 newest-first after add
  });
}
  function removeLocal(id: string) {
    setItems(curr => (curr ?? []).filter(e => e.id !== id));
  }
// Timeline.tsx
async function confirmDelete() {
  if (!deletingId) return;
  try {
    setDeleting(true);

    // Find the item so we know what endpoint to hit
    const item = (items ?? []).find(i => i.id === deletingId);
    if (!item) throw new Error("Item not found");

    // Pick endpoint by type
    const url =
      item.type === "AWARD"
        ? `/api/admin/employees/${employeeId}/awards/${deletingId}`
        : `/api/admin/employees/${employeeId}/timeline/${deletingId}`;

    let res = await fetch(url, { method: "DELETE" });

    // Optional fallback: if we guessed wrong, try the other endpoint
    if (res.status === 404) {
      const altUrl =
        item.type === "AWARD"
          ? `/api/admin/employees/${employeeId}/timeline/${deletingId}`
          : `/api/admin/employees/${employeeId}/awards/${deletingId}`;
      res = await fetch(altUrl, { method: "DELETE" });
    }

    if (!res.ok && res.status !== 204) {
      throw new Error(await res.text());
    }

    removeLocal(deletingId);
    toast.success("Deleted");
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
      <div className="relative space-y-1">
        {items.map((e, idx) => {
         const config = iconConfig[e.type] || iconConfig["TRAINING"];
          return (
            <div key={e.id} className="relative pl-8 pb-8 group">
              {/* The Vertical Line */}
              {idx !== items.length - 1 && (
                <div className="absolute left-[11px] top-7 bottom-0 w-[2px] bg-slate-100 group-hover:bg-slate-200 transition-colors" />
              )}
              
              {/* The Icon Dot */}
              <div className={cn(
                "absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white shadow-sm z-10 transition-transform group-hover:scale-110",
                config.bgColor,
                config.color
              )}>
                {config.icon}
              </div>

              {/* Content Card */}
              <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-slate-200 transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-800 leading-none">{e.title}</h4>
                    
                    </div>
                    <div className="flex items-center text-[11px] font-medium text-slate-400">
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {new Date(e.date).toLocaleDateString(undefined, { dateStyle: 'long' })}
                    </div>
                  </div>

                  {editable && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        type="button"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                        onClick={() => { setEditing(e); setEditOpen(true); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                         type="button"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        onClick={() => { setDeletingId(e.id); setConfirmOpen(true); }}
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {e.description && (
                  <p className="mt-2 text-sm text-slate-500 leading-relaxed border-l-2 border-slate-100 pl-3">
                    {e.description}
                  </p>
                )}

                {e.attachment && (
                  <a 
                    href={e.attachment} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md transition-colors"
                  >
                    <FileText className="h-3 w-3" />
                    VIEW ATTACHMENT
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
