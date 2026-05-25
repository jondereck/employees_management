"use client";
import { Bell } from "lucide-react";

export default function NotificationBell({ hasDot }: { hasDot: boolean }) {
  return (
    <div className="relative inline-flex h-4 w-4 items-center justify-center">
      <Bell className="h-4 w-4 text-slate-600" />
      {hasDot && (
        <span className="absolute -right-1 -top-1 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
      )}
    </div>
  );
}
