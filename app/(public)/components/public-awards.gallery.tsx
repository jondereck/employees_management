"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ExternalLink, FileText, Pencil, Plus, ShieldCheck, Trash, Trophy } from "lucide-react";

// Public modals (suggest-only)
import AwardCreateModal from "@/app/(public)/components/modals/award-create-modal";
import AwardEditModal from "@/app/(public)/components/modals/award-edit-modal";
import AwardDeleteModal from "@/app/(public)/components/modals/award-delete-modal";

export type PublicAwardsGalleryProps = { employeeId: string; version?: number };

export type PublicAward = {
  id: string;
  title: string;
  issuer?: string | null;
  givenAt: string; // ISO or YYYY-MM-DD
  thumbnail?: string | null;
  fileUrl?: string | null;
  tags: string[];
  description?: string | null;
};

function AwardsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border p-3">
          <div className="aspect-[4/3] w-full rounded bg-muted mb-3" />
          <div className="h-4 w-2/3 bg-muted rounded mb-2" />
          <div className="h-3 w-1/3 bg-muted/70 rounded" />
        </div>
      ))}
    </div>
  );
}

function isImageLike(u?: string | null) {
  if (!u) return false;
  try {
    const url = new URL(u);
    if (/^lh\d+\.googleusercontent\.com$/i.test(url.hostname)) return true; // Google Photos
    return /(\.png|\.jpe?g|\.webp|\.gif|\.svg)$/i.test(url.pathname.split("?")[0]);
  } catch {
    return false;
  }
}

function getCover(a: PublicAward) {
  const cover =
    (isImageLike(a.thumbnail) && a.thumbnail) ||
    (isImageLike(a.fileUrl) && a.fileUrl) ||
    null;
  return cover;
}



export default function PublicAwardsGallery({ employeeId, version = 0 }: PublicAwardsGalleryProps) {
  const [awards, setAwards] = useState<PublicAward[] | null>(null);

  // view dialog
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<PublicAward | null>(null);

  // public modals
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);


  useEffect(() => {
    let alive = true;
    fetch(`/api/public/employees/${employeeId}/awards-list`)
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        const list = Array.isArray(data) ? data : [];
        // Normalize: support legacy 'date' → 'givenAt'
        const normalized: PublicAward[] = list.map((a: any) => ({
          ...a,
          givenAt: (a.givenAt ?? a.date ?? "").slice(0, 10),
          tags: Array.isArray(a.tags) ? a.tags : [],
        }));
        setAwards(normalized);
      })
      .catch(() => {
        if (alive) setAwards([]);
      });
    return () => {
      alive = false;
    };
  }, [employeeId, version]);

  if (awards === null) return <AwardsSkeleton />;

  return (
  <>
  <div className="mb-6 flex items-center justify-between">
    <Button 
      size="sm" 
      variant="ghost" 
      onClick={() => setCreateOpen(true)}
      className="rounded-full bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold transition-all active:scale-95"
    >
      <Plus className="h-4 w-4 mr-2" />
      Suggest new award
    </Button>
  </div>

  {awards.length === 0 ? (
    <div className="flex flex-col items-center justify-center py-10 rounded-[32px] border border-dashed border-white/20 bg-white/5 backdrop-blur-sm">
      <Trophy className="h-10 w-10 text-slate-300 mb-2 opacity-20" />
      <p className="text-sm font-medium text-slate-400">No awards yet.</p>
    </div>
  ) : (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {awards.map((a) => {
        const cover = getCover(a) ?? "/placeholder.svg";

        return (
          <div 
            key={a.id} 
            className="group relative rounded-[28px] border border-white/30 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)] hover:border-emerald-500/30"
          >
            {/* Subtle light beam that appears on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <button
              type="button"
              className="w-full text-left"
              onClick={() => {
                setActive(a);
                setOpen(true);
              }}
            >
              <div className="relative aspect-[4/3] w-full bg-slate-200/50 dark:bg-slate-800/50 overflow-hidden">
                {isImageLike(cover) ? (
                  <Image 
                    src={cover} 
                    alt={a.title} 
                    fill 
                    className="object-cover transition-transform duration-700 group-hover:scale-110" 
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    <FileText className="h-8 w-8 opacity-20" />
                    No preview
                  </div>
                )}
                {/* Frosted overlay on bottom of image */}
                <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </div>

              <div className="p-4 relative z-10">
                <div className="font-bold text-slate-800 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  {a.title}
                </div>
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mt-1">
                  {a.issuer || "Local Government Unit"}
                </div>
                
                {a.tags?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {a.tags.slice(0, 2).map((t) => (
                      <Badge key={t} className="bg-white/50 dark:bg-white/5 border-none text-[9px] h-4 text-slate-500">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </button>

            {/* Hover Actions: Liquid Glass floating buttons */}
            <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
              <Button
                size="icon"
                variant="secondary"
                className="h-8 w-8 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-lg border-none hover:scale-110"
                onClick={(e) => {
                  e.stopPropagation();
                  setActive(a);
                  setEditOpen(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="destructive"
                className="h-8 w-8 rounded-full bg-rose-500/90 shadow-lg border-none hover:scale-110"
                onClick={(e) => {
                  e.stopPropagation();
                  setActive(a);
                  setDeleteOpen(true);
                }}
              >
                <Trash className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  )}

  {/* VIEW DIALOG: Deep Glassmorphism */}
  <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent className="max-w-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border-white/30 dark:border-white/10 rounded-[40px] shadow-[0_50px_100px_rgba(0,0,0,0.3)]">
      {active && (
        <div className="space-y-6">
          <div className="relative w-full overflow-hidden rounded-[24px] bg-slate-100 dark:bg-slate-800 border border-white/20">
            {getCover(active) ? (
              <div className="relative aspect-video w-full">
                <Image
                  src={getCover(active)!}
                  alt={active.title}
                  fill
                  className="object-contain p-4"
                  priority
                />
              </div>
            ) : (
              <div className="aspect-video w-full flex items-center justify-center text-xs text-muted-foreground uppercase tracking-widest font-bold">
                Digital Record Only
              </div>
            )}
          </div>

          <div className="px-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  {active.title}
                </h3>
                <p className="text-emerald-600 dark:text-emerald-400 font-bold text-sm mt-1">
                  Issued by {active.issuer || "LGU Lingayen"}
                </p>
              </div>
              <div className="text-right">
                <time className="text-xs font-black uppercase tracking-widest text-slate-400">
                  {new Date(active.givenAt).toLocaleDateString("en-PH", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
              </div>
            </div>

            {active.description && (
              <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300 bg-white/30 dark:bg-white/5 p-4 rounded-2xl border border-white/40 dark:border-white/5 shadow-inner italic">
                "{active.description}"
              </p>
            )}

            {active.fileUrl && (
              <div className="mt-6 flex justify-center">
                <a
                  href={active.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center px-6 py-2.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black uppercase tracking-widest hover:scale-105 transition-transform"
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-2" />
                  View Original Certificate
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </DialogContent>
  </Dialog>

  {/* Footer Info */}
  <div className="mt-6 flex items-center gap-2 px-2 py-2 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
    <ShieldCheck className="h-4 w-4 text-emerald-500" />
    <p className="text-[10px] font-bold text-emerald-700/70 dark:text-emerald-400/70 uppercase tracking-tight">
      Self-service verification system • HRMO Approval Required
    </p>
  </div>

    {/* VIEW DIALOG */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          {active && (
            <div className="space-y-3">
              {/* Preview */}
              <div className="relative w-full overflow-hidden rounded-md bg-muted">
                {getCover(active) ? (
                  <div className="relative aspect-[4/3] w-full">
                    <Image
                      src={getCover(active)!}
                      alt={active.title}
                      fill
                      className="object-cover"
                      priority
                    />
                  </div>
                ) : (
                  <div className="aspect-[4/3] w-full flex items-center justify-center text-xs text-muted-foreground">
                    No preview
                    {active.fileUrl && (
                      <a
                        href={active.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline ml-1"
                      >
                        Open
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">{active.title}</h3>
                <time className="text-xs text-muted-foreground">
                  {new Date(active.givenAt).toLocaleDateString("en-PH", {
                    year: "numeric",
                    month: "short",
                    day: "2-digit",
                  })}
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


      {/* Suggest Modals */}
      <AwardCreateModal
        employeeId={employeeId}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
      <AwardEditModal
        employeeId={employeeId}
        award={active}
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) setActive(null);
        }}
      />
      <AwardDeleteModal
        employeeId={employeeId}
        awardId={active?.id ?? null}
        open={deleteOpen}
        onOpenChange={(o) => {
          setDeleteOpen(o);
          if (!o) setActive(null);
        }}
      />

      <p className="mt-3 text-[11px] text-muted-foreground">
        Changes appear only after HRMO approval.
      </p>
</>
  );
}
