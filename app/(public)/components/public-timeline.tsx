"use client";

import { useEffect, useState } from "react";
import { CalendarIcon, Award as AwardIcon, ArrowUpRight, Landmark, GraduationCap, UserCheck, Pencil, Trash, Plus, Calendar, CalendarCheck, BadgeCheck, Building2, FileEdit, MoveRight, Gift, RefreshCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

import TimelineCreateModal from "@/app/(public)/components/modals/timeline-create-modal";
import TimelineEditModal from "@/app/(public)/components/modals/timeline-edit-modal";
import TimelineDeleteModal from "@/app/(public)/components/modals/timeline-delete-modal";
import AwardEditModal from "@/app/(public)/components/modals/award-edit-modal";
import AwardDeleteModal from "@/app/(public)/components/modals/award-delete-modal";
import { toast } from "sonner";
import { SuggestionTabs } from "./suggestions-tabs";

type EmploymentEventType = "HIRED"|"PROMOTED"|"TRANSFERRED"|"REASSIGNED"|"AWARDED"|"CONTRACT_RENEWAL"|"TERMINATED"|"OTHER";

type Basics = {
  dateHired: string;       // ISO from API
  position: string;
  officeName: string;
  employeeTypeName: string;
};

type Prefill = {
  type: "HIRED" | "PROMOTED" | "TRANSFERRED" | "REASSIGNED" | "AWARDED" | "CONTRACT_RENEWAL" | "TERMINATED" | "OTHER";
  occurredAt: string;      // YYYY-MM-DD for <input type="date">
  details: string;
  note?: string;
};

function toDateInputValue(iso: string) {
  try { return new Date(iso).toISOString().slice(0, 10); } catch { return ""; }
}
function toISOAtMidnight(dateStrYYYYMMDD: string) {
  return new Date(`${dateStrYYYYMMDD}T00:00:00.000Z`).toISOString();
}

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

const [prefill, setPrefill] = useState<Prefill | null>(null);
const [quickLoading, setQuickLoading] = useState(false);

useEffect(() => {
  let ignore = false;
  (async () => {
    try {
      const res = await fetch(`/api/public/employees/${employeeId}/basics`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load employee basics");
      const b: Basics = await res.json();

      if (ignore) return;
      const occurredAt = toDateInputValue(b.dateHired);
      const details = `Hired as ${b.position} (${b.employeeTypeName}) in ${b.officeName}.`;
      setPrefill({ type: "HIRED", occurredAt, details });
    } catch {
      setPrefill(null); // okay lang kahit di ma-load; may CTA pa rin
    }
  })();
  return () => { ignore = true; };
}, [employeeId]);

const quickCreate = async () => {
  if (!prefill?.occurredAt) {
    setCreateOpen(true); // kung walang prefill, buksan na lang modal
    return;
  }
  try {
    setQuickLoading(true);
    const res = await fetch(`/api/public/employees/${employeeId}/timeline/request-create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "HIRED",
        occurredAt: toISOAtMidnight(prefill.occurredAt),
        details: prefill.details,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j?.error || "Submit failed");

    toast.success("Submitted default ‘HIRED’ entry for HRMO approval");
    // TODO: refetch timeline here kung may SWR/React Query ka; or window.location.reload()
  } catch (e: any) {
    toast.error(e?.message || "Something went wrong");
  } finally {
    setQuickLoading(false);
  }
};

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

  async function quickAdd(type: EmploymentEventType, details: string) {
  setQuickLoading(true);
  try {
    await fetch(`/api/public/employees/${employeeId}/timeline/request-create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        details,
        // optionally occurredAt: new Date().toISOString(),
      }),
    });
    // refresh list / toast success
  } finally {
    setQuickLoading(false);
  }
}






  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold">Service Timeline</h3>

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
  <>
    <div className="mb-3 flex items-center justify-between">
      <span className="text-xs text-muted-foreground">
        Keep your record up to date — submissions go to HRMO for approval.
      </span>
    </div>

    <SuggestionTabs onCreate={() => setCreateOpen(true)} />
  </>
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