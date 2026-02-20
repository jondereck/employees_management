// components/notifications/UpcomingBirthdays.tsx
"use client";

import { addOneDay, getFormattedDate } from "@/utils/notification-utils";
import usePreviewModal from "../../../(frontend)/view/hooks/use-preview-modal";
import { EmployeesColumn } from "../columns";
import { Calendar } from "lucide-react";

interface UpcomingBirthdaysProps {
  celebrantsUpcoming: EmployeesColumn[];
  onOpenPreview?: (emp: EmployeesColumn) => void;
  closeParentModal?: () => void;
  limit?: number;
}

// Compute the *next* occurrence of the birthday (this year or next)
function getNextBirthdayDate(bdayInput: string | Date | null | undefined) {
  if (!bdayInput) return null;
  const bday = new Date(bdayInput);
  if (isNaN(bday.getTime())) return null;

  const now = new Date();
  // Normalize to midnight for reliable comparisons
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const next = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return next;
}

export const UpcomingBirthdays = ({
  celebrantsUpcoming,
  onOpenPreview,
  closeParentModal,
  limit = 8,
}: UpcomingBirthdaysProps) => {
  const handleOpen = (emp: EmployeesColumn) => {
    onOpenPreview?.(emp);
    if (closeParentModal) closeParentModal();
    usePreviewModal.getState().onOpen(emp);
  };

  // Sort by nearest upcoming date, then take `limit`
  const list = [...celebrantsUpcoming]
    .sort((a, b) => {
      const na = getNextBirthdayDate(a.birthday);
      const nb = getNextBirthdayDate(b.birthday);

      // Push missing/invalid birthdays to the end
      if (!na && !nb) return 0;
      if (!na) return 1;
      if (!nb) return -1;

      return na.getTime() - nb.getTime();
    })
    .slice(0, limit);

  return (
    <div className="p-2 mt-8">
      {list.length > 0 ? (
        <ul className="space-y-2">
          {list.map((emp, index) => {
            const next = getNextBirthdayDate(emp.birthday);
            // Fallback: if somehow invalid, show "-" gracefully
            const displayDate = next ? getFormattedDate(addOneDay(next)) : "-";

            return (
            <li
  key={(emp as any).id ?? `${emp.firstName}-${emp.lastName}-${index}`}
  className="group flex items-center justify-between p-3 bg-white/30 backdrop-blur-md border border-white/40 rounded-2xl transition-all duration-300 hover:bg-white/50 active:scale-[0.98]"
>
  {/* Name and Icon Container */}
  <button
    onClick={() => handleOpen(emp)}
    className="flex items-center gap-3 text-left focus:outline-none min-w-0 flex-1 group"
  >

    {/* SINGLE LINE NAME WITH ELLIPSIS */}
    <span className="text-sm font-bold text-slate-700 truncate group-hover:text-indigo-600 transition-colors">
      {emp.firstName} {emp.lastName}
    </span>
  </button>

  {/* Date Badge */}
  <div className="ml-3 shrink-0">
    <span className="inline-flex items-center rounded-full bg-slate-900/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500 border border-slate-200/50">
      {displayDate}
    </span>
  </div>
</li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 text-center">No upcoming birthdays</p>
      )}
    </div>
  );
};
