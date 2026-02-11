"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AddAward, { AwardRecord } from "./admin/add-award";
import { Dialog as ShadDialog, DialogContent as ShadContent } from "@/components/ui/dialog";
import { AlertModal } from "@/components/modals/alert-modal"; // ✅ reusable confirm
import { Building2, Calendar, ExternalLink, Pencil, Trash2, Trophy, ZoomIn } from "lucide-react";

type AwardsGalleryProps = { employeeId: string; version?: number };
type Award = {
  id: string;
  title: string;
  issuer?: string | null;
  date: string;                 // ISO
  thumbnail?: string | null;
  fileUrl?: string | null;
  tags: string[];
  description?: string | null;
  
};

function AwardsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
      {[1, 2, 3].map(i => (
        <div key={i} className="rounded-lg border p-3">
          <div className="aspect-[4/3] w-full rounded bg-muted mb-3" />
          <div className="h-4 w-2/3 bg-muted rounded mb-2" />
          <div className="h-3 w-1/3 bg-muted/70 rounded" />
        </div>
      ))}
    </div>
  );
}

export default function AwardsGallery({ employeeId, version = 0 }: AwardsGalleryProps) {
  const [awards, setAwards] = useState<Award[] | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Award | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  // small helpers in AwardsGallery
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


  // confirm modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/public/employees/${employeeId}/awards`)
      .then(r => r.json())
      .then(data => { if (alive) setAwards(Array.isArray(data) ? data : []); })
      .catch(() => { if (alive) setAwards([]); });
    return () => { alive = false; };
  }, [employeeId, version]);

  function upsertLocal(saved: AwardRecord) {
    setAwards(curr => {
      const list = curr ?? [];
      const idx = list.findIndex(a => a.id === saved.id);
      if (idx >= 0) {
        const next = list.slice();
        next[idx] = { ...next[idx], ...saved };
        return next;
      }
      return [saved, ...list];
    });
  }
  function removeLocal(id: string) {
    setAwards(curr => (curr ?? []).filter(a => a.id !== id));
  }

  async function confirmDelete() {
    if (!deletingId) return;
    try {
      setDeleting(true);
      const res = await fetch(
        `/api/admin/employees/${employeeId}/awards/${deletingId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(await res.text());
      removeLocal(deletingId);
      // close modals
      setConfirmOpen(false);
      setOpen(false);
      setEditOpen(false);
      setDeletingId(null);
    } catch (e: any) {
      // optionally toast error here
      console.error(e);
    } finally {
      setDeleting(false);
    }
  }
 
  // ---------- LIST UI ----------
  if (awards === null) return <AwardsSkeleton />;
  if (awards.length === 0) {
    return <p className="text-sm text-muted-foreground">No awards yet.</p>;
  }

  return (
   <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {awards.map(a => {
          const cover = (isImageLike(a.thumbnail) && a.thumbnail) || 
                        (isImageLike(a.fileUrl) && a.fileUrl) || 
                        "/placeholder.svg";

          return (
            <div key={a.id} className="group relative rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-200 transition-all duration-300 flex flex-col">
              {/* Image Header */}
              <div 
                className="relative aspect-[16/10] w-full bg-slate-100 overflow-hidden cursor-pointer"
                onClick={() => { setActive(a); setOpen(true); }}
              >
                {isImageLike(cover) ? (
                  <Image 
                    src={cover} 
                    alt={a.title} 
                    fill 
                    className="object-cover transition-transform duration-500 group-hover:scale-105" 
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-50 text-slate-400">
                    <Trophy className="h-8 w-8 opacity-20" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                   <ZoomIn className="text-white opacity-0 group-hover:opacity-100 h-8 w-8 transition-opacity" />
                </div>
              </div>

              {/* Content */}
              <div className="p-4 flex-grow space-y-3">
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-800 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                    {a.title}
                  </h4>
                  <div className="flex items-center text-[11px] font-medium text-slate-400 gap-1.5">
                    <Building2 className="h-3 w-3" />
                    <span className="truncate">{a.issuer || "No Issuer"}</span>
                  </div>
                </div>

                {a.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {a.tags.slice(0, 3).map(t => (
                      <Badge key={t} variant="secondary" className="bg-slate-100 text-[10px] text-slate-600 border-none font-bold uppercase tracking-tighter">
                        {t}
                      </Badge>
                    ))}
                    {a.tags.length > 3 && <span className="text-[10px] text-slate-400">+{a.tags.length - 3}</span>}
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="px-4 pb-4 flex gap-2 pt-0">
                <Button
                  variant="outline"
                  type="button"
                  size="sm"
                  className="flex-1 rounded-xl h-8 border-slate-200 text-slate-600 hover:bg-slate-50 gap-2 font-bold text-xs"
                  onClick={() => { setActive(a); setEditOpen(true); }}
                >
                  <Pencil className="h-3 w-3" /> Edit
                </Button>
                <Button
                  variant="outline"
                   type="button"
                  size="sm"
                  className="h-8 w-8 rounded-xl border-slate-200 text-rose-500 hover:bg-rose-50 hover:border-rose-100 p-0"
                  onClick={() => { setDeletingId(a.id); setConfirmOpen(true); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* VIEW DIALOG */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl rounded-3xl overflow-hidden p-0 border-none">
          {active && (
            <div className="flex flex-col">
               {/* Cover Image in Modal */}
               <div className="relative w-full aspect-video bg-slate-900">
                  <Image src={(isImageLike(active.thumbnail) && active.thumbnail) || (isImageLike(active.fileUrl) && active.fileUrl) || "/placeholder.svg"} fill className="object-contain" alt={active.title} />
               </div>
               <div className="p-8 space-y-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-widest">
                       <Trophy className="h-3 w-3" /> {active.issuer}
                    </div>
                    <h2 className="text-2xl font-black text-slate-900">{active.title}</h2>
                    <div className="flex items-center text-sm text-slate-400 gap-2">
                       <Calendar className="h-4 w-4" />
                       {new Date(active.date).toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'2-digit' })}
                    </div>
                  </div>

                  {active.description && (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-slate-600 leading-relaxed italic">{active.description}</p>
                    </div>
                  )}

                  {active.fileUrl && (
                    <Button asChild className="w-full bg-slate-900 hover:bg-black text-white rounded-xl gap-2 font-bold">
                       <a href={active.fileUrl} target="_blank" rel="noreferrer">
                         <ExternalLink className="h-4 w-4" /> View Full Certificate
                       </a>
                    </Button>
                  )}
               </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

          {/* EDIT DIALOG */}
     <ShadDialog
  open={editOpen}
  onOpenChange={(o) => {
    setEditOpen(o);
    if (!o) setActive(null);      // prevent re-open / stale initial
  }}
>
  <ShadContent className="max-w-2xl">
    {active && (
      <AddAward
        employeeId={employeeId}
        initial={{ ...active, date: (active.date || "").slice(0,10) }}
        onSaved={(saved) => {
          setAwards(prev => {
            const list = prev ?? [];
            const i = list.findIndex(x => x.id === saved.id);
            const normalized = { ...saved, date: (saved.date||"").slice(0,10) };
            if (i >= 0) { const next = list.slice(); next[i] = normalized; return next; }
            return [normalized, ...list];
          });
          setEditOpen(false);      // 🔥 close the EDIT modal
          setActive(null);         // 🔥 clear selection
        }}
        onDeleted={(id) => {
          setAwards(prev => (prev ?? []).filter(x => x.id !== id));
          setEditOpen(false);      // 🔥 close the EDIT modal
          setActive(null);
        }}
        hideHeader
      />
    )}
  </ShadContent>
</ShadDialog>


      {/* CONFIRM DELETE MODAL */}
      <AlertModal
        isOpen={confirmOpen}
        onClose={() => { if (!deleting) setConfirmOpen(false); }}
        onConfirm={confirmDelete}
        loading={deleting}
      />
    </>
  );
}
