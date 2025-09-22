"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Award = {
  id: string;
  title: string;
  issuer?: string | null;
  date: string;          // ISO
  thumbnail?: string | null;
  fileUrl?: string | null;
  tags: string[];
};

export default function AwardsGallery({ employeeId }: { employeeId: string }) {
  const [awards, setAwards] = useState<Award[]|null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Award | null>(null);

  useEffect(() => {
    fetch(`/api/public/employees/${employeeId}/awards`)
      .then(r => r.json()).then(setAwards).catch(() => setAwards([]));
  }, [employeeId]);

  if (!awards) return <div className="animate-pulse h-40 rounded-md bg-muted/50" />;

  if (awards.length === 0) {
    return <p className="text-sm text-muted-foreground">No awards yet.</p>;
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {awards.map(a => (
          <button
            key={a.id}
            onClick={() => { setActive(a); setOpen(true); }}
            className="group relative overflow-hidden rounded-xl border hover:shadow"
            aria-label={`Open ${a.title}`}
          >
            <div className="relative aspect-[4/3]">
              {a.thumbnail ? (
                <Image src={a.thumbnail} alt={a.title} fill className="object-cover" />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
                  No preview
                </div>
              )}
            </div>
            <div className="p-2 text-left">
              <div className="line-clamp-1 text-sm font-medium">{a.title}</div>
              <div className="text-xs text-muted-foreground">
                {a.issuer ? `${a.issuer} • ` : ""}{new Date(a.date).toLocaleDateString()}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {a.tags?.slice(0,3).map(t => <Badge key={t} variant="secondary">{t}</Badge>)}
              </div>
            </div>
          </button>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          {active && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold">{active.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {active.issuer ? `${active.issuer} • ` : ""}{new Date(active.date).toLocaleDateString()}
                  </p>
                </div>
                {active.fileUrl && (
                  <Button asChild size="sm" variant="outline">
                    <a href={active.fileUrl} target="_blank" rel="noreferrer">Open file</a>
                  </Button>
                )}
              </div>

              {active.fileUrl || active.thumbnail ? (
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border">
                  <Image
                    src={active.fileUrl || active.thumbnail!}
                    alt={active.title}
                    fill
                    className="object-contain bg-black/5"
                    priority
                  />
                </div>
              ) : (
                <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
                  No preview available.
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
