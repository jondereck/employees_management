"use client";

import { GitCommit, History, ChevronRight } from "lucide-react";
import { Employees } from "@/app/(dashboard)/[departmentId]/(routes)/(frontend)/view/types";
import { formatDate } from "@/utils/utils";
import { cn } from "@/lib/utils";

interface Props {
  events?: Employees["employmentEvents"];
}

// Map event types to specific colors for better visual grouping
const EVENT_THEMES: Record<string, { color: string; bg: string }> = {
  HIRED: { color: "text-emerald-600", bg: "bg-emerald-500" },
  PROMOTION: { color: "text-indigo-600", bg: "bg-indigo-500" },
  TRANSFER: { color: "text-amber-600", bg: "bg-amber-500" },
  REGULARIZATION: { color: "text-blue-600", bg: "bg-blue-500" },
  DEFAULT: { color: "text-slate-600", bg: "bg-slate-400" },
};

const EmploymentEventPreview = ({ events }: Props) => {
  if (!events || events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 p-10 text-center">
        <History className="h-10 w-10 text-slate-300 mb-3" />
        <p className="text-sm font-medium text-slate-500">No employment history available</p>
      </div>
    );
  }

  // Sort events by date descending to ensure the latest is on top
  const sortedEvents = [...events].sort((a, b) => 
    new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* HEADER */}
      <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-indigo-500" />
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Employment History
          </h2>
        </div>
      </div>

      {/* TIMELINE CONTENT */}
      <div className="p-6 relative">
        {/* The Vertical Line Connector */}
        <div className="absolute left-[31px] top-8 bottom-8 w-px bg-slate-100" />

        <div className="space-y-8 relative">
          {sortedEvents.slice(0, 5).map((event, i) => {
            const theme = EVENT_THEMES[event.type?.toUpperCase()] || EVENT_THEMES.DEFAULT;
            
            return (
              <div key={event.id} className="relative pl-10 group">
                {/* Timeline Dot with Outer Glow on Hover */}
                <span className={cn(
                  "absolute left-0 top-1 h-3 w-3 rounded-full border-2 border-white ring-4 ring-slate-50 z-10 transition-transform group-hover:scale-125",
                  theme.bg
                )} />

                <div className="flex flex-col md:flex-row md:items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[10px] font-black uppercase tracking-widest", theme.color)}>
                        {event.type}
                      </span>
                      {i === 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-[9px] font-bold text-emerald-600 uppercase">
                          Latest
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-sm font-bold text-slate-900 leading-none">
                      {event.details || "Status Update"}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-bold text-slate-400">
                      {formatDate(String(event.occurredAt))}
                    </span>
                    <ChevronRight className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>

                {/* Optional: Add a subtle card background for the detail on hover */}
                <div className="mt-2 text-xs text-slate-500 leading-relaxed max-w-prose">
                  {/* If you have more metadata like 'department' or 'position' in details, it renders here */}
                  History record created for this {event.type.toLowerCase()} event.
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {events.length > 5 && (
        <div className="p-4 bg-slate-50/50 border-t border-slate-100 text-center">
          <button className="text-xs font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-widest">
            View Full Career Timeline
          </button>
        </div>
      )}
    </div>
  );
};

export default EmploymentEventPreview;