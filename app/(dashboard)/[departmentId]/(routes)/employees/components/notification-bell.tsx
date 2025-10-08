"use client";
import { Bell } from "lucide-react";

export default function NotificationBell({ hasDot }: { hasDot: boolean }) {
  return (
    <div className="relative cursor-pointer">
      <Bell className="w-6 h-6 text-gray-700" />
      {hasDot && (
        <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
      )}
    </div>
  );
}
