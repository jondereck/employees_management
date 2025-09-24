"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AddAward, { AwardRecord } from "./admin/add-award";
import { Dialog as ShadDialog, DialogContent as ShadContent } from "@/components/ui/dialog";
import { AlertModal } from "@/components/modals/alert-modal"; // ✅ reusable confirm

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

const isGooglePhotosShare = (u?: string) =>
  !!u && /^(https?:\/\/)?(photos\.app\.goo\.gl|photos\.google\.com)\//i.test(u);


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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {awards.map(a => {
        const cover =
  (isImageLike(a.thumbnail) && a.thumbnail) ||
  (isImageLike(a.fileUrl) && a.fileUrl) ||
  "/placeholder.svg";

{isImageLike(cover) ? (
  <Image src={cover} alt={a.title} fill className="object-cover" />
) : (
  <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
    No preview • {a.fileUrl && (
      <a className="underline ml-1" href={a.fileUrl} target="_blank" rel="noreferrer">Open</a>
    )}
  </div>
)}

          return (
            <div key={a.id} className="rounded-lg border overflow-hidden">
              <button
                type="button"
                className="w-full text-left"
                onClick={() => { setActive(a); setOpen(true); }}
              >
                <div className="relative aspect-[4/3] w-full bg-muted">
                  <Image src={cover} alt={a.title} fill className="object-cover" />
                </div>
                <div className="p-3 space-y-1">
                  <div className="font-medium line-clamp-1">{a.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {(a.issuer ? `${a.issuer} • ` : "") + new Date(a.date).toLocaleDateString()}
                  </div>
                  {a.tags?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {a.tags.map(t => <Badge key={t} variant="secondary">{t}</Badge>)}
                    </div>
                  )}
                  {(a.description || a.issuer) && (
  <div className="px-3 pb-3">
 
    {a.description && (
      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
        {a.description}
      </p>
    )}
  </div>
)}


                </div>
              </button>
              <div className="p-3 pt-0 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => { setActive(a); setEditOpen(true); }}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => { setDeletingId(a.id); setConfirmOpen(true); }}
                >
                  Delete
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* VIEW DIALOG */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
        {active && (
  <div className="space-y-2">
    <div className="flex items-center justify-between gap-3">
      <h3 className="font-semibold">{active.title}</h3>
      <time className="text-xs text-muted-foreground">
        {new Date(active.date).toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'2-digit' })}
      </time>
    </div>

    {active.issuer && (
      <p className="text-xs text-muted-foreground">Issuer: {active.issuer}</p>
    )}

    {active.description && (
      <p className="text-sm leading-relaxed">{active.description}</p>
    )}

    {active.fileUrl && (
      <a
        href={active.fileUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-block text-xs underline hover:opacity-80"
      >
        Open certificate
      </a>
    )}
  </div>
)}
        </DialogContent>
      </Dialog>

      {/* EDIT DIALOG */}
      <ShadDialog open={editOpen} onOpenChange={setEditOpen}>
        <ShadContent className="max-w-2xl">
          {active && (
            <AddAward
              employeeId={employeeId}
              initial={active}
              onSaved={(saved) => { upsertLocal(saved); setEditOpen(false); setOpen(false); }}
              onDeleted={(deletedId) => { removeLocal(deletedId); setEditOpen(false); setOpen(false); }}
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
