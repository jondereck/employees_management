"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Pencil, Trash } from "lucide-react";

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
      <div className="mb-3 flex items-center justify-between">
        <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
          Suggest new award
        </Button>
      </div>

      {awards.length === 0 ? (
        <p className="text-sm text-muted-foreground">No awards yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {awards.map((a) => {
            const cover = getCover(a) ?? "/placeholder.svg";

            return (
              <div key={a.id} className="rounded-lg border overflow-hidden">
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => {
                    setActive(a);
                    setOpen(true);
                  }}
                >
                  <div className="relative aspect-[4/3] w-full bg-muted">
                    {isImageLike(cover) ? (
                      <Image src={cover} alt={a.title} fill className="object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                        No preview
                        {a.fileUrl && (
                          <a
                            className="underline ml-1"
                            href={a.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Open
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-1">
                    <div className="font-medium ">{a.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {(a.issuer ? `${a.issuer} • ` : "") +
                        new Date(a.givenAt).toLocaleDateString("en-PH", {
                          year: "numeric",
                          month: "short",
                          day: "2-digit",
                        })}
                    </div>
                    {a.tags?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1 truncate">
                        {a.tags.map((t) => (
                          <Badge key={t} variant="secondary">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {a.description && (
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                        {a.description}
                      </p>
                    )}
                  </div>
                </button>

                {/* icon-only actions */}
                <div className="p-3 pt-0 flex gap-2 justify-end">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={() => {
                      setActive(a);
                      setEditOpen(true);
                    }}
                    title="Suggest edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="destructive"
                    className="h-8 w-8"
                    onClick={() => {
                      setActive(a);
                      setDeleteOpen(true);
                    }}
                    title="Request delete"
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
