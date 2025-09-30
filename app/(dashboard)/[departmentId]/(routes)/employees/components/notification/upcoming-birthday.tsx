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
                className="flex items-center justify-between p-2 border-b border-gray-200 hover:bg-gray-50 rounded-md"
              >
                <button
                  onClick={() => handleOpen(emp)}
                  className="text-sm text-blue-600 font-medium hover:underline focus:outline-none flex items-center gap-2"
                >
                  <Calendar className="h-4 w-4 opacity-60" />
                  <span>{emp.firstName} {emp.lastName}</span>
                </button>
                <span className="text-xs text-gray-500">{displayDate}</span>
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
