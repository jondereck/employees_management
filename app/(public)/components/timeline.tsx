"use client";

import { useEffect, useState } from "react";
import { CalendarIcon, Award as AwardIcon, ArrowUpRight, Landmark, GraduationCap, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type Event = {
  id: string;
  type: "HIRED"|"PROMOTION"|"TRANSFER"|"TRAINING"|"AWARD"|"RECOGNITION"|"SEPARATION";
  title: string;
  description?: string | null;
  date: string;          // ISO
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

export default function Timeline({ employeeId }: { employeeId: string }) {
  const [items, setItems] = useState<Event[]|null>(null);

  useEffect(() => {
    fetch(`/api/public/employees/${employeeId}/timeline`)
      .then(r => r.json()).then(setItems).catch(() => setItems([]));
  }, [employeeId]);

  if (!items) {
    return <div className="animate-pulse h-32 rounded-md bg-muted/50" />;
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No timeline data yet.</p>;
  }

  return (
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
          </div>
          {e.description && (
            <p className="mt-1 text-sm text-muted-foreground">{e.description}</p>
          )}
          {e.attachment && (
            <a
              href={e.attachment}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-xs underline hover:opacity-80"
            >
              View attachment
            </a>
          )}
        </li>
      ))}
    </ol>
  );
}
