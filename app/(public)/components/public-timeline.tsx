"use client";

import { useEffect, useState } from "react";
import { CalendarIcon, Award as AwardIcon, ArrowUpRight, Landmark, GraduationCap, UserCheck, Pencil, Trash, Plus, Calendar, CalendarCheck, BadgeCheck, Building2, FileEdit, MoveRight, Gift, RefreshCcw, ShieldEllipsisIcon, BookOpen, Paperclip } from "lucide-react";
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
import { FaEllipsisV } from "react-icons/fa";
import { Separator } from "@/components/ui/separator";

type EmploymentEventType = "HIRED" | "PROMOTED" | "TRANSFERRED" | "REASSIGNED" | "AWARDED" | "CONTRACT_RENEWAL" | "TERMINATED" | "OTHER";

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
  type: "HIRED" | "PROMOTION" | "TRANSFER" | "TRAINING" | "AWARD" | "RECOGNITION" | "SEPARATION" | "OTHER";
  title: string;
  description?: string | null;
  occurredAt: string;              // YYYY-MM-DD
  attachment?: string | null;

  // NEW/normalized
  issuer?: string | null;
  thumbnail?: string | null;
  tags?: string[];                 // always array for convenience

  // keep if you still rely on legacy parsing elsewhere
  details?: string | null;
};


const iconMap: Record<PublicItem["type"], JSX.Element> = {
  HIRED: <UserCheck className="h-4 w-4" />,
  PROMOTION: <ArrowUpRight className="h-4 w-4" />,
  TRANSFER: <Landmark className="h-4 w-4" />,
  TRAINING: <BookOpen className="h-4 w-4" />,
  AWARD: <AwardIcon className="h-4 w-4" />,
  RECOGNITION: <AwardIcon className="h-4 w-4" />,
  SEPARATION: <CalendarIcon className="h-4 w-4" />,
  OTHER: <FaEllipsisV className="h-4 w-4" />,
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

  const byDateDesc = (a: { occurredAt: string }, b: { occurredAt: string }) =>
    new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();

  function normalizeTags(x: unknown): string[] {
    if (Array.isArray(x)) return (x as unknown[])
      .map((t) => String(t).trim())
      .filter((s): s is string => Boolean(s));
    if (typeof x === "string") return x
      .split(",")
      .map((s: string) => s.trim())
      .filter((s): s is string => Boolean(s));
    return [];
  }

  useEffect(() => {
    let alive = true;
    // Use the merged admin-style endpoint so awards appear in the timeline too
    fetch(`/api/public/employees/${employeeId}/timeline`)
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        const list = Array.isArray(data) ? data : [];

        const normalized: PublicItem[] = list.map((e: any) => {
          const ymd = ((e.occurredAt ?? e.date) || "").slice(0, 10);

          // Try parsing details ONLY as a fallback, never show raw JSON
          let d: any = {};
          if (typeof e?.details === "string") {
            try { d = JSON.parse(e.details); } catch { d = {}; }
          }

          // title: prefer e.title; if blank/undefined, try details.title; else "Event"
          const title =
            (typeof e?.title === "string" && e.title.trim()) ? e.title.trim()
              : (typeof d?.title === "string" && d.title.trim()) ? d.title.trim()
                : "Event";

          // description: prefer e.description; fallback to details.description; else null
          const description =
            (typeof e?.description === "string" && e.description.length ? e.description : undefined) ??
            (typeof d?.description === "string" && d.description.length ? d.description : undefined) ??
            null;

          // attachment: prefer e.attachment; fallback details.attachment; else null
          const attachment =
            (typeof e?.attachment === "string" && e.attachment) ? e.attachment
              : (typeof d?.attachment === "string" && d.attachment) ? d.attachment
                : null;

          // issuer / thumbnail
          const issuer =
            (typeof e?.issuer === "string" && e.issuer.trim()) ? e.issuer.trim()
              : (typeof d?.issuer === "string" && d.issuer.trim()) ? d.issuer.trim()
                : null;

          const thumbnail =
            (typeof e?.thumbnail === "string" && e.thumbnail.trim()) ? e.thumbnail.trim()
              : (typeof d?.thumbnail === "string" && d.thumbnail.trim()) ? d.thumbnail.trim()
                : null;

          // tags → always array<string>
          let tags = normalizeTags(e?.tags);
          if (tags.length === 0) tags = normalizeTags(d?.tags);

          return {
            id: e.id,
            type: e.type,
            title,
            description,
            occurredAt: ymd,
            attachment,
            issuer,
            thumbnail,
            tags,
            // keep details if you still need it elsewhere (optional)
            // details: typeof e?.details === "string" ? e.details : null,
          };
        });

        const cleaned = normalized.filter(it =>
          it.title !== "Event" || it.description || it.attachment
        );
        setItems(cleaned.sort(byDateDesc));
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



  function parseDetails(d: unknown) {
    try {
      const obj = typeof d === "string" ? JSON.parse(d) : (d ?? {});
      const title = (obj?.title ?? "").toString().trim();
      const description = (obj?.description ?? "").toString().trim();
      const attachment = (obj?.attachment ?? "").toString().trim();

      const issuer = (obj?.issuer ?? "").toString().trim() || undefined;
      const thumbnail = (obj?.thumbnail ?? "").toString().trim() || undefined;

      let tags: string[] = [];
      if (Array.isArray(obj?.tags)) {
        tags = obj.tags.map((t: any) => String(t).trim()).filter(Boolean);
      } else if (typeof obj?.tags === "string") {
        tags = obj.tags.split(",").map((s: string) => s.trim()).filter(Boolean);
      }

      return { title, description, attachment, issuer, thumbnail, tags };
    } catch {
      return { title: "", description: "", attachment: "", issuer: undefined, thumbnail: undefined, tags: [] };
    }
  }

  const fromTimeline =
    isAwardType(active?.type as any) && active
      ? {
        id: active.id,
        title: active.title ?? "",
        description: active.description ?? undefined,
        givenAt: active.occurredAt,      // either works now
        fileUrl: active.attachment ?? undefined,
        thumbnail: active.thumbnail ?? undefined,        // ✅ now comes from API
        issuer: active.issuer ?? undefined,              // ✅
        tags: active.tags ?? [],                         // ✅
      }
      : null;





  return (
    <>
      <>
        <div className="mb-6 flex items-center justify-between">

          <div className="h-px flex-1 bg-gradient-to-r from-slate-200 dark:from-slate-800 to-transparent ml-4" />
        </div>
        <div className="relative pl-6 sm:pl-8">

          {/* The Timeline Spine: A liquid gradient stroke */}
          <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-gradient-to-b from-emerald-500 via-indigo-500 to-slate-200 dark:to-slate-800 rounded-full opacity-40" />

          <ol className="space-y-4">
            {items.map((e, idx) => (
              <li key={e.id} className="relative pl-10 group">
                {/* Floating Droplet (The Icon Node) */}
                <span className="absolute -left-[13px] top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-lg group-hover:scale-110 group-hover:border-emerald-500/50 transition-all duration-500">
                  <div className="absolute inset-0 bg-emerald-500/5 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="relative z-10 scale-75 text-slate-600 dark:text-slate-300 group-hover:text-emerald-500 transition-colors">
                    {iconMap[e.type]}
                  </span>
                </span>

                <div className="flex flex-col gap-1 p-2 rounded-[22px] border border-transparent hover:border-white/40 hover:bg-white/30 dark:hover:bg-white/[0.02] hover:backdrop-blur-md transition-all duration-500">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <h4 className="font-bold text-slate-800 dark:text-white leading-tight">
                        {e.title}
                      </h4>
                      <time className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                        {new Date(e.occurredAt).toLocaleDateString("en-PH", {
                          year: "numeric",
                          month: "short",
                          day: "2-digit"
                        })}
                      </time>
                    </div>

                    {/* Action Bubbles: Visible on hover */}
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-full bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border border-white/20 shadow-sm hover:text-emerald-600"
                        onClick={() => {
                          setActive(e);
                          isAwardType(e.type) ? setAwardEditOpen(true) : setEditOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600 hover:bg-rose-500 hover:text-white"
                        onClick={() => {
                          setActive(e);
                          isAwardType(e.type) ? setAwardDeleteOpen(true) : setDeleteOpen(true);
                        }}
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {e.description && (
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-prose">
                      {e.description}
                    </p>
                  )}

                  {e.attachment && (
                    <div className="mt-3">
                      <a
                        href={e.attachment}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-600 transition-colors"
                      >
                        <Paperclip className="h-3 w-3" />
                        View Reference
                      </a>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Integrated Suggestion Section */}
        <Separator className="mb-2" />

        <div className="flex flex-col items-center text-center">


          <SuggestionTabs onCreate={() => setCreateOpen(true)} />

        </div>

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
        award={fromTimeline}
        open={awardEditOpen}
        onOpenChange={(o) => { setAwardEditOpen(o); if (!o) setActive(null); }}
      />
      <AwardDeleteModal
        employeeId={employeeId}
        awardId={isAwardType(active?.type as any) ? active?.id ?? null : null}
        open={awardDeleteOpen}
        onOpenChange={(o) => { setAwardDeleteOpen(o); if (!o) setActive(null); }}
      />

    </>
  );
}