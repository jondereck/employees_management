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
  limit?: number; // Optional limit of how many to show
}

export const UpcomingBirthdays = ({
  celebrantsUpcoming,
  onOpenPreview,
  closeParentModal,
  limit = 5,
}: UpcomingBirthdaysProps) => {
  const handleOpen = (emp: EmployeesColumn) => {
    onOpenPreview?.(emp);
     if (closeParentModal) closeParentModal();
    usePreviewModal.getState().onOpen(emp);
  };

  const list = celebrantsUpcoming.slice(0, limit);

  return (
    <div className="p-2 mt-8">
      {list.length > 0 ? (
        <ul className="space-y-2">
          {list.map((emp, index) => {
            const birthday = addOneDay(new Date(emp.birthday));
            const formatted = getFormattedDate(birthday);
            return (
              <li
                key={index}
                className="flex items-center justify-between p-2 border-b border-gray-200 hover:bg-gray-50 rounded-md"
              >
                <button
                  onClick={() => handleOpen(emp)}
                  className="text-sm text-blue-600 font-medium hover:underline focus:outline-none"
                >
                  {emp.firstName} {emp.lastName}
                </button>
                <span className="text-xs text-gray-500">{formatted}</span>
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
