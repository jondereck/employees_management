"use client";

import { CalendarClock, BadgeCheck, Clock, CalendarDays } from "lucide-react";
import { Employees } from "@/app/(dashboard)/[departmentId]/(routes)/(frontend)/view/types";
import { formatDate } from "@/utils/utils";
import { cn } from "@/lib/utils";

interface Props {
  schedules?: Employees["workSchedules"];
}

const WEEK_DAYS = [
  { label: "M", full: "Monday", short: "Mon", value: 1 },
  { label: "T", full: "Tuesday", short: "Tue", value: 2 },
  { label: "W", full: "Wednesday", short: "Wed", value: 3 },
  { label: "T", full: "Thursday", short: "Thu", value: 4 },
  { label: "F", full: "Friday", short: "Fri", value: 5 },
  { label: "S", full: "Saturday", short: "Sat", value: 6 },
  { label: "S", full: "Sunday", short: "Sun", value: 0 },
];

const isCurrent = (s: any) => {
  if (!s.effectiveFrom) return false;
  const now = Date.now();
  const from = new Date(s.effectiveFrom).getTime();
  const to = s.effectiveTo ? new Date(s.effectiveTo).getTime() : Infinity;
  return now >= from && now <= to;
};

const WorkSchedulePreview = ({ schedules }: Props) => {
  // 1. Find the active schedule
  const activeSchedule = schedules?.find(isCurrent) || schedules?.[0];

  // 2. UI FALLBACK: If no schedule exists, we use these defaults
  const current = activeSchedule || {
    startTime: "08:00",
    endTime: "17:00",
    type: "Fixed Schedule",
    weeklyPattern: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    effectiveFrom: new Date().toISOString(),
    effectiveTo: null,
  };

  // 3. Normalization with fallback to Mon-Fri if pattern is empty
  const getActiveDays = (): string[] => {
    const pattern = current.weeklyPattern;
    if (!pattern || (Array.isArray(pattern) && pattern.length === 0)) {
        // Default to Mon-Fri if the DB has no days set
        return ["monday", "tuesday", "wednesday", "thursday", "friday"];
    }
    if (Array.isArray(pattern)) return pattern.map((d) => String(d).toLowerCase());
    if (typeof pattern === "string") return pattern.split(",").map((d) => d.trim().toLowerCase());
    return ["monday", "tuesday", "wednesday", "thursday", "friday"];
  };

  const activeDaysList = getActiveDays();

  const isDayActive = (day: typeof WEEK_DAYS[0]) => {
    return activeDaysList.some((activeDay: string) => 
      activeDay === day.full.toLowerCase() || 
      activeDay === day.short.toLowerCase() || 
      activeDay === String(day.value)
    );
  };

  const activeDayLabels = WEEK_DAYS.filter(isDayActive);
  
  // Logic to show range text
  const dayRangeText = activeDayLabels.length > 0 
    ? `${activeDayLabels[0].full.slice(0, 3)} — ${activeDayLabels[activeDayLabels.length - 1].full.slice(0, 3)}`
    : "Standard Shift";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* HEADER */}
      <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-indigo-500" />
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Work Schedule
          </h2>
        </div>

        {activeSchedule && isCurrent(activeSchedule) ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 uppercase tracking-tight">
            <BadgeCheck className="h-3 w-3" />
            Current Active
          </span>
        ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-500 uppercase tracking-tight">
            Default View
          </span>
        )}
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Shift Time Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-500">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Shift Duration</span>
            </div>
            
            <div className="flex flex-col">
              <span className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1">
                {current.startTime || "08:00"} <span className="text-slate-300 font-light mx-1">to</span> {current.endTime || "17:00"}
              </span>
              <p className="text-sm text-slate-500 font-medium">{current.type || "Fixed Schedule"}</p>
            </div>
          </div>

          {/* Validity Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-500">
              <CalendarDays className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Effectivity</span>
            </div>
            
            <div className="flex flex-col">
               <span className="text-sm font-bold text-slate-700">
                Started: {formatDate(String(current.effectiveFrom))}
              </span>
              <p className="text-xs text-slate-400">
                Ends: {current.effectiveTo ? formatDate(String(current.effectiveTo)) : "Until Revoked"}
              </p>
            </div>
          </div>
        </div>

        {/* Weekly Breakdown */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">
            <span>{dayRangeText}</span>
            <div className="flex gap-1.5">
                {WEEK_DAYS.map((day, idx) => {
                    const active = isDayActive(day);
                    return (
                        <span 
                            key={`${day.full}-${idx}`} 
                            className={cn(
                                "h-7 w-7 rounded-md flex items-center justify-center transition-all border font-bold text-[10px]",
                                active 
                                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" 
                                    : "bg-slate-50 text-slate-300 border-slate-100"
                            )}
                        >
                            {day.label}
                        </span>
                    );
                })}
            </div>
        </div>
      </div>
    </div>
  );
};

export default WorkSchedulePreview;