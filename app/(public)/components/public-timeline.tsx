"use client";

import { useEffect, useState } from "react";
import { CalendarIcon, Award as AwardIcon, ArrowUpRight, Landmark, GraduationCap, UserCheck, Pencil, Trash } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

import TimelineCreateModal from "@/app/(public)/components/modals/timeline-create-modal";
import TimelineEditModal from "@/app/(public)/components/modals/timeline-edit-modal";
import TimelineDeleteModal from "@/app/(public)/components/modals/timeline-delete-modal";
import AwardEditModal from "@/app/(public)/components/modals/award-edit-modal";
import AwardDeleteModal from "@/app/(public)/components/modals/award-delete-modal";

export type PublicTimelineProps = { employeeId: string; version?: number };
export type PublicItem = {
  id: string;
  type: "HIRED"|"PROMOTION"|"TRANSFER"|"TRAINING"|"AWARD"|"RECOGNITION"|"SEPARATION";
  title: string;
  description?: string | null;
  occurredAt: string; // ISO or YYYY-MM-DD
  attachment?: string | null;
};

const iconMap: Record<PublicItem["type"], JSX.Element> = {
  HIRED: <UserCheck className="h-4 w-4" />,
  PROMOTION: <ArrowUpRight className="h-4 w-4" />,
  TRANSFER: <Landmark className="h-4 w-4" />,
  TRAINING: <GraduationCap className="h-4 w-4" />,
  AWARD: <AwardIcon className="h-4 w-4" />,
  RECOGNITION: <AwardIcon className="h-4 w-4" />,
  SEPARATION: <CalendarIcon className="h-4 w-4" />,
};

function TimelineSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-10 bg-muted rounded" />
      ))}
    </div>
  );
}

const isAwardType = (t: PublicItem["type"]) => t === "AWARD" || t === "RECOGNITION";

export default function PublicTimeline({ employeeId, version = 0 }: PublicTimelineProps) {
  const [items, setItems] = useState<PublicItem[] | null>(null);

  // Suggest modals
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [awardEditOpen, setAwardEditOpen] = useState(false);
  const [awardDeleteOpen, setAwardDeleteOpen] = useState(false);
  const [active, setActive] = useState<PublicItem | null>(null);

  const byDateDesc = (a: {occurredAt: string}, b: {occurredAt: string}) =>
    new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();

  useEffect(() => {
    let alive = true;
    // Use the merged admin-style endpoint so awards appear in the timeline too
    fetch(`/api/public/employees/${employeeId}/timeline`)
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        const list = Array.isArray(data) ? data : [];
        // Normalize to the shape this component expects
        const normalized: PublicItem[] = list.map((e: any) => ({
          id: e.id,
          type: e.type,
          title: e.title ?? "Event",
          description: e.description ?? e.details ?? null,
          occurredAt: (e.occurredAt ?? e.date ?? "").slice(0,10),
          attachment: e.attachment ?? e.fileUrl ?? null,
        }));
        setItems(normalized.sort(byDateDesc));
      })
      .catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [employeeId, version]);

  if (items === null) return <TimelineSkeleton />;
  if (items.length === 0) return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>Suggest new timeline</Button>
      </div>
      <p className="text-sm text-muted-foreground">No timeline data yet.</p>
      <TimelineCreateModal employeeId={employeeId} open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
    
        <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>Suggest new timeline</Button>
      </div>

      <ol className="relative ml-3 border-l pl-5">
        {items.map((e, idx) => (
          <li key={e.id} className={cn("mb-6", idx === items.length - 1 && "mb-0")}> 
            <span className="absolute -left-3 mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
              {iconMap[e.type]}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-semibold">{e.title}</h4>
              <time className="text-xs text-muted-foreground">{new Date(e.occurredAt).toLocaleDateString()}</time>
              <div className="ml-auto flex items-center gap-2">
                {/* Icon-only buttons like admin */}
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() => {
                    setActive(e);
                    isAwardType(e.type) ? setAwardEditOpen(true) : setEditOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="destructive"
                  className="h-8 w-8"
                  onClick={() => {
                    setActive(e);
                    isAwardType(e.type) ? setAwardDeleteOpen(true) : setDeleteOpen(true);
                  }}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
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

      {/* VIEW dialog */}
      <Dialog open={!!active && !editOpen && !deleteOpen && !awardEditOpen && !awardDeleteOpen} onOpenChange={(o) => { if (!o) setActive(null); }}>
        <DialogContent className="max-w-lg">
          {active && (
            <div>
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">{active.title}</h4>
                <time className="text-xs text-muted-foreground">
                  {new Date(active.occurredAt).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "2-digit" })}
                </time>
              </div>
              {active.description && <p className="mt-2 text-sm">{active.description}</p>}
              {active.attachment && (
                <a href={active.attachment} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs underline hover:opacity-80">
                  View attachment
                </a>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Suggest Modals: timeline vs award based on item type */}
      <TimelineCreateModal employeeId={employeeId} open={createOpen} onOpenChange={setCreateOpen} />

      <TimelineEditModal
        employeeId={employeeId}
        event={isAwardType(active?.type as any) ? null : (active as any)}
        open={editOpen}
        onOpenChange={(o) => { setEditOpen(o); if (!o) setActive(null); }}
      />
      <TimelineDeleteModal
        employeeId={employeeId}
        eventId={!isAwardType(active?.type as any) ? active?.id ?? null : null}
        open={deleteOpen}
        onOpenChange={(o) => { setDeleteOpen(o); if (!o) setActive(null); }}
      />

      <AwardEditModal
        employeeId={employeeId}
        award={isAwardType(active?.type as any) && active ? {
          id: active.id,
          title: active.title,
          description: active.description ?? undefined,
          givenAt: active.occurredAt, // modal will convert to ISO if needed
          fileUrl: active.attachment ?? undefined,
          thumbnail: undefined,
          issuer: undefined,
          tags: [],
        } : null}
        open={awardEditOpen}
        onOpenChange={(o) => { setAwardEditOpen(o); if (!o) setActive(null); }}
      />
      <AwardDeleteModal
        employeeId={employeeId}
        awardId={isAwardType(active?.type as any) ? active?.id ?? null : null}
        open={awardDeleteOpen}
        onOpenChange={(o) => { setAwardDeleteOpen(o); if (!o) setActive(null); }}
      />

      <p className="mt-3 text-[11px] text-muted-foreground">Changes appear only after HRMO approval.</p>
    </>
  );
}